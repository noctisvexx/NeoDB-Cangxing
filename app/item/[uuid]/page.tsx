import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cached } from "@/lib/cache";
import AddToShelf from "@/components/AddToShelf";
import ItemCard from "@/components/ItemCard";
import Rating from "@/components/Rating";
import { hasTmdb, wereadApiKey } from "@/lib/config";
import { loadSettings } from "@/lib/local-settings";
import {
  NeoDBFetchPendingError,
  fetchItemByUrl,
  getItem,
  getItemPosts,
  getMyMark,
  searchCatalog,
  getSimilar,
} from "@/lib/neodb";
import { getBangumiRating, getBangumiSubject } from "@/lib/bangumi";
import { getTmdbItem, getTmdbRating, posterUrl } from "@/lib/tmdb";
import { getImdbRating } from "@/lib/omdb";
import { lookupItunes } from "@/lib/itunes";
import { getWereadBookInfo } from "@/lib/weread";
import { CATEGORY_META } from "@/lib/categories";
import {
  externalLink,
  formatDate,
  joinList,
  listZhTitles,
  pickActors,
  pickDescription,
  pickOriginalTitle,
  pickByRole,
  pickTitle,
  itemTitleMatches,
  asArray,
  cleanCommentText,
  compactItem,
  applyTitleOverrides,
  sameWork,
  isMarkText,
  stripHtml,
} from "@/lib/utils";
import type { NeoDBItem, NeoDBReview } from "@/lib/types";
import ItemSwitcher from "@/components/ItemSwitcher";
import AiVerdict from "@/components/AiVerdict";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ uuid: string }>;
}): Promise<Metadata> {
  const { uuid } = await params;
  try {
    const item = await getItem(uuid);
    return {
      title: pickTitle(item),
      description: pickDescription(item).slice(0, 120),
    };
  } catch {
    return { title: "作品 · 发现海" };
  }
}

function RatingBars({ distribution }: { distribution?: number[] }) {
  if (!distribution || distribution.length !== 5) return null;
  const max = Math.max(...distribution, 1);
  const labels = ["1★", "2★", "3★", "4★", "5★"];
  return (
    <div className="mt-3 space-y-1.5">
      {distribution.map((count, i) => (
        <div key={labels[i]} className="flex items-center gap-2 text-xs">
          <span className="w-7 shrink-0 text-zinc-500">{labels[i]}</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-amber-500/80"
              style={{ width: `${Math.round((count / max) * 100)}%` }}
            />
          </div>
          <span className="w-8 shrink-0 text-right text-zinc-500">{count}</span>
        </div>
      ))}
    </div>
  );
}

async function loadItemBundle(uuid: string) {
  // TMDB / Bangumi / Apple / Steam 解析型卡片需要先解析成 NeoDB 条目
  let item: NeoDBItem | null = null;
  let pending = false;
  let pendingUrl: string | null = null;
  let pendingLabel = "在源站查看";
  let fallback: {
    title: string;
    cover: string | null;
    url: string;
    searchQuery: string;
  } | null = null;

  async function findByName(name: string, category: string, url: string) {
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
        } catch (err) {
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
        } catch (err) {
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
                entry.url,
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
              { success?: boolean; data?: { name?: string; header_image?: string } }
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
      reviewPage: null,
      commentPage: null,
      similar: null,
      bangumi: null,
      tmdb: null,
      imdb: null,
      candidates: [] as NeoDBItem[],
      fallback,
    };
  }

  let itemUuid = item.uuid;
  let currentItem = item;
  const localSettings = await loadSettings();
  const overrides = localSettings.titleOverrides ?? {};

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
  let candidates: NeoDBItem[] = searches
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
  candidates = candidates.map((c) => applyTitleOverrides(c, overrides));
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
  applyTitleOverrides(item, overrides);
  let reviewPage = await getItemPosts(itemUuid, "review", 1).catch(() => null);
  let commentPage = await getItemPosts(itemUuid, "comment", 1).catch(() => null);
  const [similar, bangumi] = await Promise.all([
    getSimilar(itemUuid, 12).catch(() => null),
    getBangumiRating(item).catch(() => null),
  ]);
  if (similar) {
    similar.data = similar.data.map((s) => applyTitleOverrides(s, overrides));
  }
  // 分类接口为空时退回全部动态，尽量展示短评
  if (!reviewPage || (reviewPage.data ?? []).length === 0) {
    reviewPage = await getItemPosts(itemUuid, undefined, 1).catch(
      () => reviewPage,
    );
  }
  if (!commentPage || (commentPage.data ?? []).length === 0) {
    commentPage = await getItemPosts(itemUuid, undefined, 1).catch(
      () => commentPage,
    );
  }
  const tmdbConfigured = await hasTmdb();
  const [tmdb, imdb] = await Promise.all([
    tmdbConfigured
      ? getTmdbRating(item).catch(() => null)
      : Promise.resolve(null),
    getImdbRating(item).catch(() => null),
  ]);

  return {
    item,
    pending,
    pendingUrl,
    pendingLabel,
    reviewPage,
    commentPage,
    similar,
    bangumi,
    tmdb,
    imdb,
    candidates,
    fallback,
  };
}

export default async function ItemPage({
  params,
}: {
  params: Promise<{ uuid: string }>;
}) {
  const { uuid } = await params;

  const bundle = await cached(`item-${uuid}`, 30 * 60_000, () =>
    loadItemBundle(uuid),
  );
  const {
    item,
    pending,
    pendingUrl,
    pendingLabel,
    reviewPage,
    commentPage,
    similar,
    bangumi,
    tmdb,
    imdb,
    candidates,
    fallback,
  } = bundle;
  const compactCandidates = candidates.map(compactItem);

  if (fallback) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-16 text-center">
        {fallback.cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={fallback.cover}
            alt={fallback.title}
            className="mx-auto h-52 w-36 rounded-xl object-cover shadow-lg"
          />
        )}
        <h1 className="mt-5 text-xl font-semibold text-zinc-100">
          {fallback.title}
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          这本书还没有收录到 NeoDB，暂时无法直接标记，可以先去微信读书看看。
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <a
            href={fallback.url}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-amber-400"
          >
            在微信读书查看
          </a>
          <Link
            href={`/search?q=${encodeURIComponent(fallback.searchQuery)}`}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-500"
          >
            在 NeoDB 搜索
          </Link>
          <Link
            href="/"
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-500"
          >
            返回发现
          </Link>
        </div>
      </div>
    );
  }

  if (pending) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-16 text-center">
        <p className="text-4xl">⏳</p>
        <h1 className="mt-4 text-xl font-semibold text-zinc-100">
          NeoDB 正在收录这个条目
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">
          该作品还没有收录进 NeoDB，收录一般只需几秒到几分钟。
          稍后刷新本页即可看到完整详情，也可以先去 TMDB 看看。
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <a
            href={pendingUrl ?? "#"}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-amber-400"
          >
            {pendingLabel}
          </a>
          <Link
            href="/"
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-500"
          >
            返回发现
          </Link>
        </div>
      </div>
    );
  }
  if (!item) notFound();

  const itemUuid = item.uuid;
  const mark = await getMyMark(itemUuid).catch(() => null); // 书架状态实时获取
  const posts = commentPage ?? reviewPage;
  const tmdbConfigured = await hasTmdb();

  const doubanUrl = externalLink(item, "movie.douban.com");
  const imdbUrl = externalLink(item, "www.imdb.com");
  const letterboxdUrl = externalLink(item, "letterboxd.com");
  const bgmUrl = externalLink(item, "bgm.tv");
  const neodbUrl = `https://neodb.social${item.url ?? `/item/${itemUuid}`}`;

  const category =
    CATEGORY_META[item.category ?? ""] ?? {
      label: item.category ?? "作品",
      emoji: "🏷️",
    };
  const title = pickTitle(item);
  const orig = pickOriginalTitle(item);
  const zhTitles = listZhTitles(item);
  const desc = pickDescription(item);

  const reviewItems: { review: NeoDBReview; sourceUrl: string | null }[] =
    (reviewPage?.data ?? [])
      .flatMap((p) =>
        asArray(p.ext_neodb?.relatedWith as NeoDBReview | NeoDBReview[] | undefined).map(
          (r) => ({
            review: r,
            sourceUrl: p.url || p.uri || null,
          }),
        ),
      )
      .filter(({ review }) => stripHtml(review.content).length >= 20)
      .slice(0, 6);
  const shortComments = (commentPage?.data ?? [])
    .filter((p) => asArray(p.ext_neodb?.relatedWith).length === 0)
    .map((p) => ({
      post: p,
      text: cleanCommentText(stripHtml(p.content || p.text || "")),
    }))
    .filter(({ text }) => text.length >= 2 && !isMarkText(text))
    .sort(
      (a, b) => (b.post.favourites_count ?? 0) - (a.post.favourites_count ?? 0),
    )
    .slice(0, 12);

  const deltas: { key: string; text: string }[] = [];
  if (item.rating != null && tmdb?.rating) {
    const d = Number((item.rating - tmdb.rating).toFixed(1));
    deltas.push({
      key: "tmdb",
      text:
        Math.abs(d) < 0.3
          ? `评分差异：NeoDB ${item.rating.toFixed(1)} vs TMDB ${tmdb.rating.toFixed(1)} —— 口碑比较一致。`
          : d > 0
            ? `评分差异：NeoDB ${item.rating.toFixed(1)} vs TMDB ${tmdb.rating.toFixed(1)} —— 中文社区评分更高。`
            : `评分差异：NeoDB ${item.rating.toFixed(1)} vs TMDB ${tmdb.rating.toFixed(1)} —— 国际观众评分更高。`,
    });
  }
  if (item.rating != null && bangumi?.score != null) {
    const d = Number((item.rating - bangumi.score).toFixed(1));
    deltas.push({
      key: "bgm",
      text:
        Math.abs(d) < 0.3
          ? `评分差异：NeoDB ${item.rating.toFixed(1)} vs Bangumi ${bangumi.score.toFixed(1)} —— 比较接近。`
          : d > 0
            ? `评分差异：NeoDB ${item.rating.toFixed(1)} vs Bangumi ${bangumi.score.toFixed(1)} —— NeoDB 用户评分更高。`
            : `评分差异：NeoDB ${item.rating.toFixed(1)} vs Bangumi ${bangumi.score.toFixed(1)} —— Bangumi 用户评分更高。`,
    });
  }
  if (item.rating != null && imdb?.rating != null) {
    const d = Number((item.rating - imdb.rating).toFixed(1));
    deltas.push({
      key: "imdb",
      text:
        Math.abs(d) < 0.3
          ? `评分差异：NeoDB ${item.rating.toFixed(1)} vs IMDb ${imdb.rating.toFixed(1)} —— 比较接近。`
          : d > 0
            ? `评分差异：NeoDB ${item.rating.toFixed(1)} vs IMDb ${imdb.rating.toFixed(1)} —— NeoDB 用户评分更高。`
            : `评分差异：NeoDB ${item.rating.toFixed(1)} vs IMDb ${imdb.rating.toFixed(1)} —— IMDb 评分更高。`,
    });
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <Link
        href="/"
        className="mb-5 inline-block text-sm text-zinc-400 transition hover:text-zinc-100"
      >
        ← 返回发现
      </Link>

      <div className="grid gap-8 lg:grid-cols-[360px_1fr]">
        <div className="mx-auto w-64 shrink-0 lg:mx-0 lg:w-full">
          <div className="sticky top-20 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
            {item.cover_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.cover_image_url}
                alt={title}
                className="aspect-[2/3] w-full object-cover"
              />
            ) : (
              <div className="flex aspect-[2/3] w-full items-center justify-center text-6xl">
                📖
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-zinc-300">
              {category.emoji} {category.label}
            </span>
            {item.year != null && (
              <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-zinc-300">
                {item.year}
              </span>
            )}
            {(item.genre ?? []).slice(0, 4).map((g) => (
              <span
                key={g}
                className="rounded-full bg-zinc-900 px-2.5 py-1 text-zinc-500"
              >
                {g}
              </span>
            ))}
          </div>

          <h1 className="text-2xl font-bold text-zinc-50 sm:text-3xl">{title}</h1>
          {orig && (
            <p className="mt-1 text-sm text-zinc-500">
              原名：{orig}
              {item.language && item.language.length > 0
                ? ` · ${joinList(item.language).toUpperCase()}`
                : ""}
            </p>
          )}
          {zhTitles.length > 1 && (
            <p className="mt-1 text-xs text-zinc-600">
              译名：{zhTitles.slice(0, 6).join(" / ")}
            </p>
          )}

          <Rating
            value={item.rating}
            count={item.rating_count}
            className="mt-3 text-base"
          />
          <RatingBars distribution={item.rating_distribution} />

          {pickByRole(item, "director", item.director).length > 0 && (
            <p className="mt-4 text-sm text-zinc-400">
              <span className="text-zinc-600">导演：</span>
              {joinList(pickByRole(item, "director", item.director))}
            </p>
          )}
          {pickByRole(item, "playwright", item.playwright).length > 0 && (
            <p className="mt-1 text-sm text-zinc-400">
              <span className="text-zinc-600">编剧：</span>
              {joinList(pickByRole(item, "playwright", item.playwright))}
            </p>
          )}
          {pickActors(item).length > 0 && (
            <p className="mt-1 text-sm text-zinc-400">
              <span className="text-zinc-600">主演：</span>
              {joinList(pickActors(item))}
            </p>
          )}
          {item.area && item.area.length > 0 && (
            <p className="mt-1 text-sm text-zinc-400">
              <span className="text-zinc-600">地区：</span>
              {joinList(item.area)}
            </p>
          )}

          {desc && (
            <div className="mt-5">
              <h2 className="title-accent mb-1.5 text-lg font-semibold">简介</h2>
              <p className="max-w-prose text-sm leading-relaxed text-zinc-400">
                {desc}
              </p>
            </div>
          )}

          {item.tags && item.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {item.tags.slice(0, 16).map((t) => (
                <span
                  key={t}
                  className="rounded-md bg-zinc-900 px-2 py-0.5 text-xs text-zinc-500"
                >
                  #{t}
                </span>
              ))}
            </div>
          )}

          <div className="mt-6">
              <h2 className="title-accent mb-2 text-lg font-semibold">
                多平台评分
              </h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <a
                href={neodbUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 transition hover:border-zinc-600"
              >
                <p className="text-xs text-zinc-500">NeoDB ↗</p>
                <Rating value={item.rating} count={item.rating_count} className="mt-1" />
              </a>
              {tmdb && (
                <a
                  href={tmdb.url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 transition hover:border-zinc-600"
                >
                  <p className="text-xs text-zinc-500">TMDB ↗</p>
                  <Rating value={tmdb.rating} count={tmdb.voteCount} className="mt-1" />
                </a>
              )}
              {bangumi && bangumi.score != null && (
                <a
                  href={bangumi.url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 transition hover:border-zinc-600"
                >
                  <p className="text-xs text-zinc-500">Bangumi ↗</p>
                  <Rating value={bangumi.score} count={bangumi.total ?? undefined} className="mt-1" />
                  {bangumi.rank != null && (
                    <p className="mt-0.5 text-[11px] text-zinc-600">
                      全站排名 #{bangumi.rank}
                    </p>
                  )}
                </a>
              )}
              {imdb && imdb.rating != null && (
                <a
                  href={imdb.url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 transition hover:border-zinc-600"
                >
                  <p className="text-xs text-zinc-500">IMDb ↗</p>
                  <Rating value={imdb.rating} count={imdb.votes ?? undefined} className="mt-1" />
                  {imdb.year && (
                    <p className="mt-0.5 text-[11px] text-zinc-600">{imdb.title} ({imdb.year})</p>
                  )}
                </a>
              )}
              {imdbUrl && (!imdb || imdb.rating == null) && (
                <a
                  href={imdbUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 transition hover:border-zinc-600"
                >
                  <p className="text-xs text-zinc-500">IMDb ↗</p>
                  <p className="mt-1 text-xs text-zinc-500">查看条目</p>
                </a>
              )}
              {doubanUrl && (
                <a
                  href={doubanUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 transition hover:border-zinc-600"
                >
                  <p className="text-xs text-zinc-500">豆瓣 ↗</p>
                  <p className="mt-1 text-xs text-zinc-500">查看条目</p>
                </a>
              )}
              {letterboxdUrl && (
                <a
                  href={letterboxdUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 transition hover:border-zinc-600"
                >
                  <p className="text-xs text-zinc-500">Letterboxd ↗</p>
                  <p className="mt-1 text-xs text-zinc-500">查看条目</p>
                </a>
              )}
              {bgmUrl && (!bangumi || bangumi.score == null) && (
                <a
                  href={bgmUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 transition hover:border-zinc-600"
                >
                  <p className="text-xs text-zinc-500">Bangumi ↗</p>
                  <p className="mt-1 text-xs text-zinc-500">查看条目</p>
                </a>
              )}
            </div>
            {deltas.length > 0 && (
              <div className="mt-2 space-y-1.5 rounded-lg bg-zinc-900/50 px-3 py-2.5 text-xs text-zinc-400">
                {deltas.map((d) => (
                  <p key={d.key}>💡 {d.text}</p>
                ))}
              </div>
            )}
            {mark?.shelf_type !== "complete" && (
              <AiVerdict
                title={title}
                type={category.label}
                ratings={[
                  { platform: "NeoDB", score: item.rating },
                  ...(tmdb
                    ? [{ platform: "TMDB", score: tmdb.rating }]
                    : []),
                  ...(bangumi?.score != null
                    ? [{ platform: "Bangumi", score: bangumi.score }]
                    : []),
                  ...(imdb?.rating != null
                    ? [{ platform: "IMDb", score: imdb.rating }]
                    : []),
                ]}
              />
            )}
            {!tmdb && tmdbConfigured && (
              <p className="mt-2 text-xs text-zinc-600">
                该条目暂未在 NeoDB 中关联 TMDB 链接。
              </p>
            )}
          </div>

          <div className="mt-6 max-w-xl">
            <AddToShelf
              itemUuid={itemUuid}
              category={item.category}
              initialMark={{
                shelfType: mark?.shelf_type ?? null,
                ratingGrade: mark?.rating_grade ?? null,
                commentText: mark?.comment_text ?? null,
              }}
            />
            <ItemSwitcher
              currentTitle={title}
              candidates={compactCandidates}
            />
          </div>
        </div>
      </div>

      {(reviewItems.length > 0 || shortComments.length > 0) && (
        <section className="mt-10">
          <h2 className="title-accent mb-3 text-xl font-bold">
            用户评价
            <span className="ml-2 text-xs font-normal text-zinc-500">
              来自 NeoDB 公开动态
            </span>
          </h2>
          {reviewItems.length > 0 && (
            <div className="mb-4 space-y-2">
              {reviewItems.map(({ review, sourceUrl }) => {
                // NeoDB 的 /p/... 短链打不开，回退到发帖地址
                const link =
                  review.href && !review.href.includes("/p/")
                    ? review.href
                    : (sourceUrl ?? review.href);
                return (
                  <a
                    key={review.href}
                    href={link}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 transition hover:border-zinc-600"
                  >
                    <p className="mb-1.5 text-sm font-medium text-zinc-200">
                      {review.name || "长评"}
                    </p>
                    <p className="line-clamp-4 text-sm leading-relaxed text-zinc-400">
                      {stripHtml(review.content)}
                    </p>
                    <p className="mt-2 text-xs text-zinc-600">
                      {review.attributedTo?.split("/").filter(Boolean).pop() ??
                        "NeoDB 用户"}
                      {review.published
                        ? ` · ${formatDate(review.published)}`
                        : ""}
                    </p>
                  </a>
                );
              })}
            </div>
          )}
          {shortComments.length > 0 && (
            <div className="space-y-1.5">
              {shortComments.map(({ post, text }) => {
                const author =
                  post.account?.display_name ||
                  post.account?.username ||
                  "NeoDB 用户";
                return (
                  <a
                    key={post.id}
                    href={post.url || post.uri || "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-lg border border-white/5 bg-zinc-900/40 px-3 py-2 transition hover:border-zinc-600"
                  >
                    <p className="line-clamp-3 text-sm leading-relaxed text-zinc-300">
                      {text}
                    </p>
                    <p className="mt-1 text-xs text-zinc-600">
                      {author} · {formatDate(post.created_at)}
                      {post.favourites_count
                        ? ` · ♥ ${post.favourites_count}`
                        : ""}
                    </p>
                  </a>
                );
              })}
            </div>
          )}
          {posts && posts.count > shortComments.length + reviewItems.length && (
            <p className="mt-3 text-sm text-zinc-600">
              共 {posts.count} 条评价，{" "}
              <a
                href={neodbUrl}
                target="_blank"
                rel="noreferrer"
                className="text-amber-400 hover:underline"
              >
                到 NeoDB 查看全部
              </a>
            </p>
          )}
        </section>
      )}
      {reviewItems.length === 0 && shortComments.length === 0 && (
        <p className="mt-8 text-sm text-zinc-600">
          这个条目暂时还没有文字评价（标记动态可到{" "}
          <a
            href={neodbUrl}
            target="_blank"
            rel="noreferrer"
            className="text-amber-400 hover:underline"
          >
            NeoDB 原文
          </a>{" "}
          查看）。
        </p>
      )}

      {similar && similar.data.length > 0 && (
        <section className="mt-10">
          <h2 className="title-accent mb-3 text-xl font-bold">
            相似作品
          </h2>
          <div className="space-y-2">
            {similar.data.slice(0, 12).map((s) => (
              <ItemCard key={s.uuid} item={compactItem(s)} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
