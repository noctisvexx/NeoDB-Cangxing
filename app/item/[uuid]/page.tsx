import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import AddToShelf from "@/components/AddToShelf";
import ItemCard from "@/components/ItemCard";
import Rating from "@/components/Rating";
import { hasTmdb, neoDbToken } from "@/lib/config";
import { loadMarks } from "@/lib/local-marks";
import { getItem, getMyMark } from "@/lib/neodb";
import { cached } from "@/lib/cache";
import {
  getItemCoreCached,
  getRatingsCached,
  getReviewsCached,
  getSimilarCached,
} from "@/lib/item-loader";
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
  asArray,
  cleanCommentText,
  compactItem,
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
    // 页面标题只用于浏览器标签页，短时缓存即可，避免每次进入都打 NeoDB
    const item = await cached(`meta-item-${uuid}`, 6 * 60 * 60_000, () =>
      getItem(uuid),
    );
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

function RatingsSkeleton() {
  return (
    <div className="mt-6">
      <div className="mb-2 h-4 w-24 animate-pulse rounded bg-zinc-800/70" />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-16 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/60"
          />
        ))}
      </div>
    </div>
  );
}

function ReviewsSkeleton() {
  return (
    <section className="mt-10">
      <div className="mb-3 h-5 w-28 animate-pulse rounded bg-zinc-800/70" />
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/40"
          />
        ))}
      </div>
    </section>
  );
}

function SimilarSkeleton() {
  return (
    <section className="mt-10">
      <div className="mb-3 h-5 w-28 animate-pulse rounded bg-zinc-800/70" />
      <div className="space-y-2">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/40"
          />
        ))}
      </div>
    </section>
  );
}

/** 多平台评分：独立板块，数据从缓存读取，未命中时不影响核心内容渲染 */
async function RatingsPanel({
  item,
  markShelfType,
  title,
  categoryLabel,
}: {
  item: NeoDBItem;
  markShelfType?: string | null;
  title: string;
  categoryLabel: string;
}) {
  const { tmdb, bangumi, imdb } = await getRatingsCached(item);
  const tmdbConfigured = await hasTmdb();
  const neodbUrl = `https://neodb.social${item.url ?? `/item/${item.uuid}`}`;
  const doubanUrl = externalLink(item, "movie.douban.com");
  const imdbUrl = externalLink(item, "www.imdb.com");
  const letterboxdUrl = externalLink(item, "letterboxd.com");
  const bgmUrl = externalLink(item, "bgm.tv");

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
    <div className="mt-6">
      <h2 className="title-accent mb-2 text-lg font-semibold">多平台评分</h2>
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
      {markShelfType !== "complete" && (
        <AiVerdict
          title={title}
          type={categoryLabel}
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
  );
}

/** 用户评价：独立板块流式加载（最多展示 10 条，不区分长评 / 短评） */
async function ReviewsPanel({
  itemUuid,
  neodbUrl,
}: {
  itemUuid: string;
  neodbUrl: string;
}) {
  const { reviewPage, commentPage } = await getReviewsCached(itemUuid);
  const posts = commentPage ?? reviewPage;
  type CommentEntry = {
    id: string;
    text: string;
    author: string;
    date?: string;
    url: string;
    favourites: number;
  };
  const reviewEntries: CommentEntry[] = (reviewPage?.data ?? [])
    .flatMap((p) =>
      asArray(
        p.ext_neodb?.relatedWith as NeoDBReview | NeoDBReview[] | undefined,
      ).map((r) => ({
        id: r.href,
        text: stripHtml(r.content),
        author:
          r.attributedTo?.split("/").filter(Boolean).pop() ?? "NeoDB 用户",
        date: r.published,
        // NeoDB 的 /p/... 短链打不开，回退到发帖地址
        url:
          r.href && !r.href.includes("/p/")
            ? r.href
            : (p.url || p.uri || r.href),
        favourites: p.favourites_count ?? 0,
      })),
    )
    .filter((e) => e.text.length >= 20);
  const shortEntries: CommentEntry[] = (commentPage?.data ?? [])
    .map((p) => {
      const related = asArray(p.ext_neodb?.relatedWith);
      // 短评正文在 relatedWith 里的 Comment 对象上；只有 Status/Rating 的帖子就是「仅标记/评分」
      const commentObj = related.find((r) => r.type === "Comment");
      const text = cleanCommentText(
        stripHtml(commentObj?.content || p.content || p.text || ""),
      );
      return {
        id: p.id,
        text,
        author:
          p.account?.display_name || p.account?.username || "NeoDB 用户",
        date: p.created_at,
        url: p.url || p.uri || "#",
        favourites: p.favourites_count ?? 0,
      };
    })
    .filter((e) => e.text.trim().length > 0 && !isMarkText(e.text));
  const comments = [...reviewEntries, ...shortEntries]
    .sort((a, b) => b.favourites - a.favourites)
    .slice(0, 10);

  return (
    <>
      {comments.length > 0 && (
        <section className="mt-10">
          <h2 className="title-accent mb-3 text-xl font-bold">
            用户评价
            <span className="ml-2 text-xs font-normal text-zinc-500">
              来自 NeoDB 公开动态
            </span>
          </h2>
          <div className="space-y-1.5">
            {comments.map((c) => (
              <a
                key={c.id}
                href={c.url}
                target="_blank"
                rel="noreferrer"
                className="block rounded-lg border border-white/5 bg-zinc-900/40 px-3 py-2 transition hover:border-zinc-600"
              >
                <p className="line-clamp-3 text-sm leading-relaxed text-zinc-300">
                  {c.text}
                </p>
                <p className="mt-1 text-xs text-zinc-600">
                  {c.author}
                  {c.date ? ` · ${formatDate(c.date)}` : ""}
                  {c.favourites > 0 ? ` · ♥ ${c.favourites}` : ""}
                </p>
              </a>
            ))}
          </div>
          {posts && posts.count > comments.length && (
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
      {comments.length === 0 && (
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
    </>
  );
}

/** 相似作品：独立板块流式加载 */
async function SimilarPanel({ itemUuid }: { itemUuid: string }) {
  const similar = await getSimilarCached(itemUuid);
  if (!similar || similar.data.length === 0) return null;
  return (
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
  );
}

export default async function ItemPage({
  params,
}: {
  params: Promise<{ uuid: string }>;
}) {
  const { uuid } = await params;

  // 核心信息（条目本体 + 候选）先加载并秒开渲染，
  // 评分 / 评论 / 相似作品由下方 Suspense 板块各自流式加载
  const core = await getItemCoreCached(uuid);
  const {
    item,
    pending,
    pendingUrl,
    pendingLabel,
    candidates,
    fallback,
  } = core;
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
  const neodbEnabled = !!(await neoDbToken());
  const localMark = (await loadMarks().catch(() => [])).find(
    (m) => m.id === uuid,
  );
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
                fetchPriority="high"
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

          <Suspense fallback={<RatingsSkeleton />}>
            <RatingsPanel
              item={item}
              markShelfType={mark?.shelf_type}
              title={title}
              categoryLabel={category.label}
            />
          </Suspense>

          <div className="mt-6 max-w-xl">
            <AddToShelf
              itemUuid={itemUuid}
              category={item.category}
              neodbEnabled={neodbEnabled}
              localItem={{
                id: uuid,
                title,
                category: item.category,
                cover: item.cover_image_url ?? undefined,
                year: item.year ?? undefined,
                sourceUrl: neodbUrl,
              }}
              initialLocalMark={
                localMark
                  ? {
                      shelf: localMark.shelf,
                      rating: localMark.rating ?? null,
                      comment: localMark.comment ?? null,
                    }
                  : null
              }
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

      <Suspense fallback={<ReviewsSkeleton />}>
        <ReviewsPanel itemUuid={itemUuid} neodbUrl={neodbUrl} />
      </Suspense>

      <Suspense fallback={<SimilarSkeleton />}>
        <SimilarPanel itemUuid={itemUuid} />
      </Suspense>
    </div>
  );
}
