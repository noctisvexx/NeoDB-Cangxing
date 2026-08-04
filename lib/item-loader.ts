// 条目详情数据加载器：解析各种来源的 uuid → NeoDB 条目，
// 核心信息（条目本体 + 候选）与评分 / 评论 / 相似作品分板块加载，
// 各板块独立走本地 SWR 缓存，互不阻塞，单平台失败不影响其他板块
import {
  NeoDBFetchPendingError,
  fetchItemByUrl,
  getItem,
  getItemPosts,
  getSimilar,
  searchCatalog,
} from "./neodb";
import { getBangumiRating, getBangumiSubject } from "./bangumi";
import { getTmdbItem, getTmdbRating, posterUrl } from "./tmdb";
import { getImdbRating } from "./omdb";
import { lookupItunes } from "./itunes";
import { getWereadBookInfo } from "./weread";
import { hasTmdb, wereadApiKey } from "./config";
import { ITEM_TTL, getCachedByKey } from "./item-cache";
import {
  itemTitleMatches,
  pickTitle,
  sameWork,
} from "./utils";
import type { NeoDBItem, Paged, NeoDBPost } from "./types";

export interface ItemCore {
  item: NeoDBItem | null;
  pending: boolean;
  pendingUrl: string | null;
  pendingLabel: string;
  candidates: NeoDBItem[];
  fallback: {
    title: string;
    cover: string | null;
    url: string;
    searchQuery: string;
  } | null;
}

export interface ItemBundle extends ItemCore {
  reviewPage: Paged<NeoDBPost> | null;
  commentPage: Paged<NeoDBPost> | null;
  similar: Awaited<ReturnType<typeof getSimilar>> | null;
  bangumi: Awaited<ReturnType<typeof getBangumiRating>> | null;
  tmdb: Awaited<ReturnType<typeof getTmdbRating>> | null;
  imdb: Awaited<ReturnType<typeof getImdbRating>> | null;
}

/** 解析 uuid 并选出信息最完整的条目（含标题修正与相同条目候选） */
export async function loadItemCore(uuid: string): Promise<ItemCore> {
  // TMDB / Bangumi / Apple / Steam 解析型卡片需要先解析成 NeoDB 条目
  let item: NeoDBItem | null = null;
  let pending = false;
  let pendingUrl: string | null = null;
  let pendingLabel = "在源站查看";
  let fallback: ItemCore["fallback"] = null;

  async function findByName(name: string, category: string) {
    const search = await searchCatalog(name, category, 1).catch(() => null);
    const match = (search?.data ?? []).find(
      (it) => itemTitleMatches(it, name),
    );
    if (match) {
      item = match;
      return true;
    }
    return false;
  }

  async function findBestByName(
    name: string,
    category: string,
    year?: number,
  ): Promise<NeoDBItem | null> {
    const search = await searchCatalog(name.slice(0, 60), category, 1).catch(
      () => null,
    );
    const matches = (search?.data ?? []).filter((c) => {
      const cTitles = [
        c.display_title ?? "",
        c.title ?? "",
        c.orig_title ?? "",
      ].filter(Boolean);
      if (!cTitles.some((t) => sameWork(t, name))) return false;
      const cy = c.year ?? null;
      if (cy != null && year != null && cy !== year) return false;
      return true;
    });
    const score = (it: NeoDBItem) =>
      (it.cover_image_url ? 1 : 0) +
      ((it.rating_count ?? 0) > 0 ? 1 : 0) +
      Math.min((it.rating_count ?? 0) / 100, 100) +
      (it.year != null ? 1 : 0);
    let best: NeoDBItem | null = null;
    let bs = -1;
    for (const c of matches) {
      const s = score(c);
      if (s > bs) {
        bs = s;
        best = c;
      }
    }
    return best;
  }

  if (uuid.startsWith("tmdb-")) {
    const m = uuid.match(/^tmdb-(movie|tv)-(\d+)$/);
    if (m) {
      pendingUrl = `https://www.themoviedb.org/${m[1]}/${m[2]}`;
      pendingLabel = "在 TMDB 查看";
      const info = await getTmdbItem(Number(m[2]), m[1] as "movie" | "tv");
      const name = info?.title ?? info?.name ?? "";
      const infoYear =
        Number((info?.release_date ?? info?.first_air_date ?? "").slice(0, 4)) ||
        undefined;
      if (name) {
        // 先按标题匹配 NeoDB 已有条目，找不到再用桥接解析
        const byTitle = await findBestByName(
          name,
          m[1] === "movie" ? "movie" : "tv",
          infoYear,
        );
        if (byTitle) {
          item = byTitle;
        } else {
          try {
            item = await fetchItemByUrl(pendingUrl);
          } catch (err) {
            if (err instanceof NeoDBFetchPendingError) {
              fallback = {
                title: name,
                cover: info?.poster_path ? posterUrl(info.poster_path) : null,
                url: pendingUrl,
                searchQuery: name,
              };
            } else {
              pending = true;
            }
          }
        }
      } else {
        try {
          item = await fetchItemByUrl(pendingUrl);
        } catch {
          pending = true;
        }
      }
    }
  } else if (uuid.startsWith("bgm-")) {
    const id = uuid.slice(4);
    if (/^\d+$/.test(id)) {
      pendingUrl = `https://bgm.tv/subject/${id}`;
      pendingLabel = "在 Bangumi 查看";
      const info = await getBangumiSubject(Number(id));
      const name = info?.name_cn || info?.name || "";
      const infoYear = Number((info?.date ?? "").slice(0, 4)) || undefined;
      if (name) {
        const byTitle = await findBestByName(name, "tv", infoYear);
        if (byTitle) {
          item = byTitle;
        } else {
          try {
            item = await fetchItemByUrl(pendingUrl);
          } catch (err) {
            if (err instanceof NeoDBFetchPendingError) {
              fallback = {
                title: name,
                cover: info?.images?.common ?? info?.images?.large ?? null,
                url: pendingUrl,
                searchQuery: name,
              };
            } else {
              pending = true;
            }
          }
        }
      } else {
        try {
          item = await fetchItemByUrl(pendingUrl);
        } catch {
          pending = true;
        }
      }
    }
  } else if (uuid.startsWith("itunes-")) {
    const m = uuid.match(/^itunes-(music|podcast)-(\d+)$/);
    if (m) {
      const mediaType = m[1] as "music" | "podcast";
      const itunesId = Number(m[2]);
      const entry = await lookupItunes(
        itunesId,
        mediaType === "podcast" ? "cn" : "us",
      ).catch(() => null);
      if (entry) {
        pendingUrl = entry.url;
        pendingLabel = "在 Apple 查看";
        const search = await searchCatalog(
          entry.name,
          mediaType === "podcast" ? "podcast" : "music",
          1,
        ).catch(() => null);
        const match = (search?.data ?? []).find(
          (it) => itemTitleMatches(it, entry.name),
        );
        if (match) {
          item = match;
        } else {
          try {
            item = await fetchItemByUrl(entry.url);
          } catch (err) {
            if (err instanceof NeoDBFetchPendingError) {
              const ok = await findByName(
                entry.name,
                mediaType === "podcast" ? "podcast" : "music",
              );
              if (!ok) {
                fallback = {
                  title: entry.name,
                  cover: entry.artwork,
                  url: entry.url,
                  searchQuery: entry.name,
                };
              }
            } else {
              pending = true;
            }
          }
        }
      }
    }
  } else if (uuid.startsWith("steam-")) {
    const id = uuid.slice(6);
    if (/^\d+$/.test(id)) {
      pendingUrl = `https://store.steampowered.com/app/${id}`;
      pendingLabel = "在 Steam 查看";
      try {
        item = await fetchItemByUrl(pendingUrl);
      } catch (err) {
        if (err instanceof NeoDBFetchPendingError) {
          // NeoDB 未收录：用 Steam 官方接口拿游戏名，按名搜 NeoDB
          try {
            const res = await fetch(
              `https://store.steampowered.com/api/appdetails?appids=${id}`,
              {
                headers: {
                  "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126 Safari/537.36",
                },
                cache: "no-store",
                signal: AbortSignal.timeout(10000),
              },
            );
            const data = (await res.json()) as Record<
              string,
              {
                success?: boolean;
                data?: { name?: string; header_image?: string };
              }
            >;
            const name = data[id]?.data?.name;
            if (name) {
              const search = await searchCatalog(name, "game", 1).catch(
                () => null,
              );
              const match = (search?.data ?? []).find(
                (it) => itemTitleMatches(it, name),
              );
              if (match) {
                item = match;
              } else {
                fallback = {
                  title: name,
                  cover: data[id]?.data?.header_image ?? null,
                  url: pendingUrl,
                  searchQuery: name,
                };
              }
            } else {
              pending = true;
            }
          } catch {
            pending = true;
          }
        } else {
          pending = true;
        }
      }
    }
  } else if (uuid.startsWith("weread-")) {
    const bookId = uuid.slice(7);
    if (bookId) {
      const key = await wereadApiKey();
      const book = key
        ? await getWereadBookInfo(key, bookId).catch(() => null)
        : null;
      if (book) {
        pendingUrl = `https://weread.qq.com/web/bookDetail/${book.bookId}`;
        pendingLabel = "在微信读书查看";
        const search = await searchCatalog(book.title, "book", 1).catch(
          () => null,
        );
        const match = (search?.data ?? []).find(
          (it) => itemTitleMatches(it, book.title),
        );
        if (match) {
          item = match;
        } else {
          fallback = {
            title: book.title,
            cover: book.cover,
            url: pendingUrl,
            searchQuery: book.title,
          };
        }
      }
    }
  }
  if (!item && !pending) {
    item = await getItem(uuid).catch(() => null);
  }

  if (pending || !item) {
    return {
      item,
      pending,
      pendingUrl,
      pendingLabel,
      candidates: [] as NeoDBItem[],
      fallback,
    };
  }

  let itemUuid = item.uuid;
  let currentItem = item;

  // 先算"相同条目"候选，默认选中信息最完整的一条（封面/评分/年份齐全优先）
  const queries = [
    currentItem.display_title,
    currentItem.title,
    currentItem.orig_title,
    pickTitle(currentItem),
  ].filter((q): q is string => !!q && q.length > 0);
  const uniqueQueries = [...new Set(queries)].slice(0, 2);
  const searches = await Promise.all(
    uniqueQueries.map((q) =>
      searchCatalog(q.slice(0, 60), currentItem.category, 1).catch(
        () => null,
      ),
    ),
  );
  const baseTitles = [
    currentItem.display_title ?? "",
    currentItem.title ?? "",
    currentItem.orig_title ?? "",
    pickTitle(currentItem),
  ].filter(Boolean);
  const seenCandidate = new Set<string>();
  const candidates: NeoDBItem[] = searches
    .flatMap((s) => s?.data ?? [])
    .filter((c) => {
      if (c.uuid === itemUuid || seenCandidate.has(c.uuid)) return false;
      seenCandidate.add(c.uuid);
      return true;
    })
    .filter((c) => {
      const cTitles = [
        c.display_title ?? "",
        c.title ?? "",
        c.orig_title ?? "",
      ].filter(Boolean);
      const titleOk = cTitles.some((t) =>
        baseTitles.some((b) => sameWork(t, b)),
      );
      if (!titleOk) return false;
      const cy = c.year ?? null;
      const by = currentItem.year ?? null;
      return cy == null || by == null || cy === by;
    })
    .slice(0, 8);
  const scoreItem = (it: NeoDBItem) =>
    (it.cover_image_url ? 1 : 0) +
    ((it.rating_count ?? 0) > 0 ? 1 : 0) +
    Math.min((it.rating_count ?? 0) / 100, 100) +
    (it.year != null ? 1 : 0);
  let best = item;
  let bestScore = scoreItem(item);
  for (const c of candidates) {
    const s = scoreItem(c);
    if (s > bestScore) {
      best = c;
      bestScore = s;
    }
  }
  item = best;
  itemUuid = best.uuid;
  currentItem = best;

  return {
    item,
    pending,
    pendingUrl,
    pendingLabel,
    candidates,
    fallback,
  };
}

/** 帖子接口每页固定 20 条（page_size 参数不生效）；详情页只展示最多 10 条，取首页即可 */
const MAX_POST_PAGES = 1;

/** 拉取某类型动态的若干页（NeoDB 帖子接口 page_size 不生效，只能逐页取） */
async function fetchAllPosts(
  itemUuid: string,
  type: "review" | "comment" | undefined,
  maxPages = MAX_POST_PAGES,
): Promise<Paged<NeoDBPost> | null> {
  const first = await getItemPosts(itemUuid, type, 1).catch(() => null);
  if (!first) return null;
  const totalPages = Math.min(Math.max(first.pages ?? 1, 1), maxPages);
  const rest = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, i) =>
      getItemPosts(itemUuid, type, i + 2).catch(() => null),
    ),
  );
  const all = [first, ...rest.filter((p): p is Paged<NeoDBPost> => !!p)]
    .flatMap((p) => p.data ?? []);
  // 分页边界可能重复，按 id 去重
  const seen = new Set<string>();
  const deduped = all.filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
  return {
    data: deduped,
    pages: totalPages,
    count: first.count ?? deduped.length,
  };
}

/** 长评 / 短评：并行拉取（各取多页），为空时才退回「全部动态」 */
export async function loadItemReviews(
  itemUuid: string,
): Promise<{
  reviewPage: Paged<NeoDBPost> | null;
  commentPage: Paged<NeoDBPost> | null;
}> {
  const [reviewPage, commentPage] = await Promise.all([
    fetchAllPosts(itemUuid, "review"),
    fetchAllPosts(itemUuid, "comment"),
  ]);
  const reviewEmpty = !reviewPage || (reviewPage.data ?? []).length === 0;
  const commentEmpty = !commentPage || (commentPage.data ?? []).length === 0;
  if (reviewEmpty && commentEmpty) {
    const generic = await fetchAllPosts(itemUuid, undefined, 1).catch(
      () => reviewPage ?? commentPage ?? null,
    );
    return { reviewPage: generic, commentPage: generic };
  }
  if (reviewEmpty) {
    const generic = await fetchAllPosts(itemUuid, undefined, 1).catch(
      () => reviewPage,
    );
    return { reviewPage: generic, commentPage };
  }
  if (commentEmpty) {
    const generic = await fetchAllPosts(itemUuid, undefined, 1).catch(
      () => commentPage,
    );
    return { reviewPage, commentPage: generic };
  }
  return { reviewPage, commentPage };
}

/** 多平台评分：TMDB / Bangumi / IMDb 并行拉取，任一失败不影响其他 */
export async function loadItemRatings(
  item: NeoDBItem,
): Promise<{
  tmdb: Awaited<ReturnType<typeof getTmdbRating>> | null;
  bangumi: Awaited<ReturnType<typeof getBangumiRating>> | null;
  imdb: Awaited<ReturnType<typeof getImdbRating>> | null;
}> {
  const tmdbConfigured = await hasTmdb();
  const [tmdb, bangumi, imdb] = await Promise.all([
    tmdbConfigured
      ? getTmdbRating(item).catch(() => null)
      : Promise.resolve(null),
    getBangumiRating(item).catch(() => null),
    getImdbRating(item).catch(() => null),
  ]);
  return { tmdb, bangumi, imdb };
}

/** 相似作品（应用标题修正） */
export async function loadItemSimilar(
  itemUuid: string,
): Promise<Awaited<ReturnType<typeof getSimilar>> | null> {
  const similar = await getSimilar(itemUuid, 12).catch(() => null);
  return similar;
}

export async function getItemCoreCached(uuid: string): Promise<ItemCore> {
  const { value } = await getCachedByKey(
    `core:${uuid}`,
    ITEM_TTL.core,
    () => loadItemCore(uuid),
    (core) => !core.pending,
  );
  return value;
}

export async function getReviewsCached(itemUuid: string): Promise<{
  reviewPage: Paged<NeoDBPost> | null;
  commentPage: Paged<NeoDBPost> | null;
}> {
  const { value } = await getCachedByKey(
    `posts:${itemUuid}`,
    ITEM_TTL.posts,
    () => loadItemReviews(itemUuid),
  );
  return value;
}

export async function getRatingsCached(item: NeoDBItem): Promise<{
  tmdb: Awaited<ReturnType<typeof getTmdbRating>> | null;
  bangumi: Awaited<ReturnType<typeof getBangumiRating>> | null;
  imdb: Awaited<ReturnType<typeof getImdbRating>> | null;
}> {
  const { value } = await getCachedByKey(
    `ratings:${item.uuid}`,
    ITEM_TTL.ratings,
    () => loadItemRatings(item),
  );
  return value;
}

export async function getSimilarCached(
  itemUuid: string,
): Promise<Awaited<ReturnType<typeof getSimilar>> | null> {
  const { value } = await getCachedByKey(
    `similar:${itemUuid}`,
    ITEM_TTL.similar,
    () => loadItemSimilar(itemUuid),
  );
  return value;
}

/** 一次性拉齐全部板块（供预热接口使用），与页面板块共用同一缓存 */
export async function loadItemBundle(uuid: string): Promise<ItemBundle> {
  const core = await getItemCoreCached(uuid);
  if (core.pending || !core.item) {
    return {
      ...core,
      reviewPage: null,
      commentPage: null,
      similar: null,
      bangumi: null,
      tmdb: null,
      imdb: null,
    };
  }
  const [reviews, ratings, similar] = await Promise.all([
    getReviewsCached(core.item.uuid),
    getRatingsCached(core.item),
    getSimilarCached(core.item.uuid),
  ]);
  return { ...core, ...reviews, ...ratings, similar };
}
