import Link from "next/link";
import AiRecommend from "@/components/AiRecommend";
import StarTrail from "@/components/StarTrail";
import SourceSection, {
  type SourceOption,
} from "@/components/SourceSection";
import { getCachedByKey } from "@/lib/item-cache";
import { aiApiKey, hasTmdb, wereadApiKey } from "@/lib/config";
import { loadSettings } from "@/lib/local-settings";
import {
  bangumiSubjectToCard,
  enrichBangumiRatings,
  getBangumiAiring,
  getBangumiHotAnime,
  getBangumiRanking,
  getBangumiTrending,
} from "@/lib/bangumi";
import { getTrending } from "@/lib/neodb";
import {
  getTrendingAnime,
  getTrendingChineseTv,
  getTrendingTmdb,
  getTopRatedTmdb,
  getPopularTmdb,
  getTrendingDayTmdb,
  getUpcomingTmdb,
  getNowPlayingTmdb,
  getAiringTodayTv,
  tmdbItemToCard,
} from "@/lib/tmdb";
import {
  getItunesTopAlbums,
  getItunesTopPodcasts,
  itunesEntryToCard,
} from "@/lib/itunes";
import {
  getSteamFreeToPlay,
  getSteamTopSellers,
  steamItemToCard,
} from "@/lib/steam";
import {
  getWereadReadBooks,
  wereadBookToCard,
} from "@/lib/weread";
import type { NeoDBItem } from "@/lib/types";
import { compactItem } from "@/lib/utils";

export const dynamic = "force-dynamic";

const SECTION_META: Record<string, { title: string }> = {
  movie: { title: "热门电影" },
  tv: { title: "热门剧集" },
  anime: { title: "热门动漫" },
  book: { title: "热门书籍" },
  game: { title: "热门游戏" },
  music: { title: "热门音乐" },
  podcast: { title: "热门播客" },
};

const DEFAULT_ORDER = [
  "movie",
  "tv",
  "anime",
  "book",
  "game",
  "music",
  "podcast",
];

async function tmdbTrendingCards(
  mediaType: "movie" | "tv",
): Promise<{ items: NeoDBItem[]; error: string | null }> {
  try {
    const list = await getTrendingTmdb(mediaType, "week");
    return {
      items: list.slice(0, 12).map((it) => tmdbItemToCard(it, mediaType)),
      error: null,
    };
  } catch (e) {
    return {
      items: [],
      error: e instanceof Error ? e.message : "TMDB 请求失败",
    };
  }
}

export default async function HomePage() {
  const { value: data } = await getCachedByKey(
    "home:data",
    20 * 60_000,
    async () => {
    const [neodbMovies, neodbTvs, books, games, neodbMusic, neodbPodcasts] =
      await Promise.all([
        getTrending("movie", 24).catch(() => []),
        getTrending("tv", 24).catch(() => []),
        getTrending("book", 24).catch(() => []),
        getTrending("game", 24).catch(() => []),
        getTrending("music", 24).catch(() => []),
        getTrending("podcast", 24).catch(() => []),
      ]);

    const tmdbConfigured = await hasTmdb();
    let movies: NeoDBItem[] = neodbMovies;
    let tvs: NeoDBItem[] = neodbTvs;
    let tmdbError: string | null = null;

    if (tmdbConfigured) {
      const [tmdbMovies, tmdbTvs] = await Promise.all([
        tmdbTrendingCards("movie"),
        tmdbTrendingCards("tv"),
      ]);
      if (tmdbMovies.items.length > 0) movies = tmdbMovies.items;
      if (tmdbTvs.items.length > 0) tvs = tmdbTvs.items;
      // 只有电影和剧集都失败才提示，单边失败不打扰
      tmdbError =
        tmdbMovies.error && tmdbTvs.error ? tmdbMovies.error : null;
    }

    // 华语剧集（近期中文原创剧）
    const chineseTv = tmdbConfigured
      ? await getTrendingChineseTv()
          .then((list) =>
            list.slice(0, 12).map((it) => tmdbItemToCard(it, "tv")),
          )
          .catch(() => [])
      : [];

    // TMDB 高分电影/剧集
    const [
      topMovies,
      topTvs,
      popularMovies,
      popularTvs,
      dayMovies,
      dayTvs,
      upcoming,
      nowPlaying,
      airingToday,
    ] = await Promise.all([
      tmdbConfigured
        ? getTopRatedTmdb("movie")
            .then((list) =>
              list.slice(0, 12).map((it) => tmdbItemToCard(it, "movie")),
            )
            .catch(() => [])
        : Promise.resolve([]),
      tmdbConfigured
        ? getTopRatedTmdb("tv")
            .then((list) =>
              list.slice(0, 12).map((it) => tmdbItemToCard(it, "tv")),
            )
            .catch(() => [])
        : Promise.resolve([]),
      tmdbConfigured
        ? getPopularTmdb("movie")
            .then((list) =>
              list.slice(0, 12).map((it) => tmdbItemToCard(it, "movie")),
            )
            .catch(() => [])
        : Promise.resolve([]),
      tmdbConfigured
        ? getPopularTmdb("tv")
            .then((list) =>
              list.slice(0, 12).map((it) => tmdbItemToCard(it, "tv")),
            )
            .catch(() => [])
        : Promise.resolve([]),
      tmdbConfigured
        ? getTrendingDayTmdb("movie")
            .then((list) =>
              list.slice(0, 12).map((it) => tmdbItemToCard(it, "movie")),
            )
            .catch(() => [])
        : Promise.resolve([]),
      tmdbConfigured
        ? getTrendingDayTmdb("tv")
            .then((list) =>
              list.slice(0, 12).map((it) => tmdbItemToCard(it, "tv")),
            )
            .catch(() => [])
        : Promise.resolve([]),
      tmdbConfigured
        ? getUpcomingTmdb()
            .then((list) =>
              list
                .filter(
                  (it) =>
                    it.release_date &&
                    new Date(`${it.release_date}T00:00:00`) > new Date(),
                )
                .slice(0, 12)
                .map((it) => tmdbItemToCard(it, "movie")),
            )
            .catch(() => [])
        : Promise.resolve([]),
      tmdbConfigured
        ? getNowPlayingTmdb()
            .then((list) =>
              list.slice(0, 12).map((it) => tmdbItemToCard(it, "movie")),
            )
            .catch(() => [])
        : Promise.resolve([]),
      tmdbConfigured
        ? getAiringTodayTv()
            .then((list) =>
              list.slice(0, 12).map((it) => tmdbItemToCard(it, "tv")),
            )
            .catch(() => [])
        : Promise.resolve([]),
    ]);

    // 动漫：趋势（优先） / 本周在播 / 总榜
    let anime: NeoDBItem[] = [];
    let animeNote: string | undefined;
    const bgmTrend = await getBangumiTrending(18).catch(() => []);
    if (bgmTrend.length > 0) {
      const enriched = await enrichBangumiRatings(bgmTrend, 12).catch(
        () => bgmTrend,
      );
      anime = enriched.map(bangumiSubjectToCard);
    } else {
      const bgmHot = await getBangumiHotAnime(18).catch(() => []);
      if (bgmHot.length > 0) {
        anime = bgmHot.map(bangumiSubjectToCard);
      } else {
        const bgmRank = await getBangumiRanking(18).catch(() => []);
        if (bgmRank.length > 0) {
          anime = bgmRank.map(bangumiSubjectToCard);
        } else if (tmdbConfigured) {
          anime = await getTrendingAnime()
            .then((list) =>
              list.slice(0, 12).map((it) => tmdbItemToCard(it, "tv")),
            )
            .catch(() => []);
        }
        if (anime.length === 0) {
          animeNote = "Bangumi 与 TMDB 都暂时不可用，可稍后刷新";
        }
      }
    }
    const bgmAiring = (await getBangumiAiring(18).catch(() => [])).map(
      bangumiSubjectToCard,
    );
    const animeHeat = (await getBangumiHotAnime(12).catch(() => [])).map(
      bangumiSubjectToCard,
    );

    // 微信读书 / Apple / Steam 榜单
    const wereadKey = await wereadApiKey();
    const wereadBooks = wereadKey
      ? await getWereadReadBooks(wereadKey, 24).catch(() => [])
      : [];
    const wereadCards = wereadBooks.map(wereadBookToCard);

    const [itunesAlbums, itunesPodcasts] = await Promise.all([
      getItunesTopAlbums(12).catch(() => []),
      getItunesTopPodcasts("cn", 12).catch(() => []),
    ]);
    const musicCards = itunesAlbums.map((e) => itunesEntryToCard(e, "music"));
    const podcastCards = itunesPodcasts.map((e) =>
      itunesEntryToCard(e, "podcast"),
    );

    const steamGames = await getSteamTopSellers(12).catch(() => []);
    const gameCards = steamGames.map(steamItemToCard);
    const steamPlaying = await getSteamFreeToPlay(12).catch(() => []);
    const playingCards = steamPlaying.map(steamItemToCard);

    const compactMovies = neodbMovies.map(compactItem);
    const compactTvs = neodbTvs.map(compactItem);
    const compactBooks = books.map(compactItem);
    const compactGames = games.map(compactItem);
    const compactMusic = neodbMusic.map(compactItem);
    const compactPodcasts = neodbPodcasts.map(compactItem);

    const sections: Record<string, SourceOption[]> = {
      movie: [
        {
          label: "TMDB",
          items: movies,
          tabs: [
            { label: "热度", items: movies },
            { label: "人数", items: popularMovies },
            { label: "评分", items: topMovies },
            { label: "今日", items: dayMovies },
            { label: "即将上映", items: upcoming },
            { label: "热映", items: nowPlaying },
          ],
        },
        { label: "NeoDB", items: compactMovies, note: "按近期收藏排序" },
      ],
      tv: [
        {
          label: "TMDB",
          items: tvs,
          tabs: [
            { label: "热度", items: tvs },
            { label: "人数", items: popularTvs },
            { label: "评分", items: topTvs },
            { label: "今日", items: dayTvs },
            { label: "在播", items: airingToday },
          ],
        },
        { label: "TMDB 华语", items: chineseTv, note: "近期中文原创剧" },
        { label: "NeoDB", items: compactTvs, note: "按近期收藏排序" },
      ],
      anime: [
        { label: "Bangumi 趋势", items: anime },
        { label: "本周在播", items: bgmAiring, note: "本周更新中的新番" },
        { label: "Bangumi 总榜", items: animeHeat, note: "按收藏热度" },
      ],
      book: [
        { label: "NeoDB", items: compactBooks },
        {
          label: "微信读书·我看过",
          items: wereadCards,
          note: "我的微信读书书架中已读完的书，点击可去 NeoDB 标记",
        },
      ],
      game: [
        {
          label: "Steam 免费游玩",
          items: playingCards,
          note: "免费游戏按当前在线人数（SteamCharts）",
        },
        { label: "Steam 热卖", items: gameCards, note: "Steam 官方热销榜" },
        { label: "NeoDB", items: compactGames },
      ],
      music: [
        {
          label: "Apple 音乐榜",
          items: musicCards,
          note: "美区 iTunes 专辑榜",
          square: true,
        },
        { label: "NeoDB", items: compactMusic, square: true },
      ],
      podcast: [
        {
          label: "Apple 播客榜",
          items: podcastCards,
          note: "中文播客（Apple Podcasts 中国区）",
          square: true,
        },
        { label: "NeoDB", items: compactPodcasts, square: true },
      ],
    };

      return { tmdbConfigured, tmdbError, animeNote, sections };
    },
  );

  const { tmdbConfigured, tmdbError, animeNote, sections } = data;
  // AI 配置不缓存，保证填完 Key 刷新立即生效
  const aiConfigured = !!(await aiApiKey());

  // 栏目顺序：设置页可手动调整
  const settings = await loadSettings();
  const savedOrder = settings.sectionOrder ?? [];
  const orderedKeys = [
    ...savedOrder.filter((k) => sections[k]),
    ...DEFAULT_ORDER.filter((k) => !savedOrder.includes(k) && sections[k]),
  ];

  return (
    <div>
      <StarTrail />
      <section className="relative overflow-hidden border-b border-white/5">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% -20%, var(--accent-soft), transparent)",
          }}
        />
        <div className="relative mx-auto w-full max-w-5xl px-4 py-10 text-center">
          <p className="mb-2 text-sm tracking-widest text-amber-400/90">
            藏星 · CANGXING
          </p>
          <div className="relative mx-auto mt-4 w-fit px-12">
            <div
              className="hero-glow pointer-events-none absolute inset-0 -z-10 rounded-full"
              style={{
                background:
                  "radial-gradient(ellipse 60% 130% at 50% 50%, var(--accent-soft), transparent 72%)",
              }}
            />
            <span
              className="sparkle"
              style={{ left: "-30px", top: "50%", animationDelay: "0s" }}
            >
              <svg viewBox="0 0 24 24">
                <path d="M12 2c1.2 5.5 4.3 8.8 10 10-5.7 1.2-8.8 4.5-10 10-1.2-5.5-4.3-8.8-10-10 5.7-1.2 8.8-4.5 10-10Z" />
              </svg>
            </span>
            <span
              className="sparkle"
              style={{ right: "-36px", top: "8%", animationDelay: "0.8s" }}
            >
              <svg viewBox="0 0 24 24">
                <path d="M12 2c1.2 5.5 4.3 8.8 10 10-5.7 1.2-8.8 4.5-10 10-1.2-5.5-4.3-8.8-10-10 5.7-1.2 8.8-4.5 10-10Z" />
              </svg>
            </span>
            <span
              className="sparkle sparkle-sm"
              style={{ left: "-48px", bottom: "-4px", animationDelay: "1.5s" }}
            >
              <svg viewBox="0 0 24 24">
                <path d="M12 2c1.2 5.5 4.3 8.8 10 10-5.7 1.2-8.8 4.5-10 10-1.2-5.5-4.3-8.8-10-10 5.7-1.2 8.8-4.5 10-10Z" />
              </svg>
            </span>
            <span
              className="sparkle sparkle-sm"
              style={{ right: "-52px", bottom: "-10px", animationDelay: "2.1s" }}
            >
              <svg viewBox="0 0 24 24">
                <path d="M12 2c1.2 5.5 4.3 8.8 10 10-5.7 1.2-8.8 4.5-10 10-1.2-5.5-4.3-8.8-10-10 5.7-1.2 8.8-4.5 10-10Z" />
              </svg>
            </span>
            <span
              className="sparkle sparkle-xs"
              style={{ left: "14%", top: "-28px", animationDelay: "0.4s" }}
            >
              <svg viewBox="0 0 24 24">
                <path d="M12 2c1.2 5.5 4.3 8.8 10 10-5.7 1.2-8.8 4.5-10 10-1.2-5.5-4.3-8.8-10-10 5.7-1.2 8.8-4.5 10-10Z" />
              </svg>
            </span>
            <span
              className="sparkle sparkle-xs"
              style={{ right: "12%", top: "-32px", animationDelay: "1.1s" }}
            >
              <svg viewBox="0 0 24 24">
                <path d="M12 2c1.2 5.5 4.3 8.8 10 10-5.7 1.2-8.8 4.5-10 10-1.2-5.5-4.3-8.8-10-10 5.7-1.2 8.8-4.5 10-10Z" />
              </svg>
            </span>
            <h1 className="hero-title text-3xl font-bold sm:text-4xl">
              发现正在闪耀的作品
            </h1>
          </div>
          <p className="mx-auto mt-3 max-w-xl text-sm text-zinc-400">
            探索电影、剧集、游戏、音乐与播客的最新趋势。
          </p>
        </div>
      </section>

      <AiRecommend aiConfigured={aiConfigured} />

      <form
        action="/search"
        method="GET"
        className="mx-auto mt-6 flex w-full max-w-5xl gap-2 px-4"
      >
        <input
          name="q"
          placeholder="搜索电影、剧集、动漫、书籍、游戏、播客…"
          className="w-full rounded-full border border-zinc-700/70 bg-zinc-900/70 px-4 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-amber-500 focus:outline-none"
        />
        <button
          type="submit"
          className="shrink-0 rounded-full bg-amber-500 px-5 py-2 text-sm font-medium text-zinc-950 transition hover:bg-amber-400"
        >
          搜索
        </button>
      </form>

      {tmdbError && (
        <div className="mx-auto w-full max-w-7xl px-4 pt-5">
          <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            TMDB 暂时无法访问（可能是网络原因），已自动回退 NeoDB 热门。可在
            <Link href="/settings" className="mx-1 underline">
              设置页
            </Link>
            检查 Key。
          </p>
        </div>
      )}

      {orderedKeys.map((k) => (
        <SourceSection
          key={k}
          title={SECTION_META[k].title}
          options={sections[k]}
        />
      ))}

      {animeNote && (
        <div className="mx-auto w-full max-w-5xl px-4 pt-5">
          <p className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-400">
            🌸 {animeNote}
          </p>
        </div>
      )}

      {!tmdbConfigured && (
        <div className="mx-auto w-full max-w-5xl px-4 py-5">
          <p className="rounded-xl border border-dashed border-zinc-800 px-4 py-3 text-xs text-zinc-500">
            🎬 配置 TMDB Key 后，电影与剧集栏目会多出 TMDB 数据源选项；动漫数据来自
            Bangumi 开放 API。
          </p>
        </div>
      )}
    </div>
  );
}
