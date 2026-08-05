// 首页栏目数据加载：每个栏目独立加载、独立落盘缓存（home:section:<key>），
// 页面用 Suspense 流式渲染时各栏目可并发抓取、先到先渲染，不再互相等待。
// 数据结构与原版 home:data 单次全量加载保持一致。
import type { SourceOption } from "@/components/SourceSection";
import type { NeoDBItem } from "./types";
import { getCachedByKey } from "./item-cache";
import { hasTmdb, wereadApiKey } from "./config";
import {
  bangumiSubjectToCard,
  enrichBangumiRatings,
  getBangumiAiring,
  getBangumiHotAnime,
  getBangumiRanking,
  getBangumiTrending,
} from "./bangumi";
import { getTrending } from "./neodb";
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
} from "./tmdb";
import {
  getItunesTopAlbums,
  getItunesTopPodcasts,
  itunesEntryToCard,
} from "./itunes";
import {
  getSteamFreeToPlay,
  getSteamTopSellers,
  steamItemToCard,
} from "./steam";
import { getWereadReadBooks, wereadBookToCard } from "./weread";
import { compactItem } from "./utils";

/** 栏目 TTL：与原版 home:data 一致（20 分钟） */
const SECTION_TTL = 20 * 60_000;

export const SECTION_META: Record<string, { title: string }> = {
  movie: { title: "热门电影" },
  tv: { title: "热门剧集" },
  anime: { title: "热门动漫" },
  book: { title: "热门书籍" },
  game: { title: "热门游戏" },
  music: { title: "热门音乐" },
  podcast: { title: "热门播客" },
};

export const DEFAULT_ORDER = [
  "movie",
  "tv",
  "anime",
  "book",
  "game",
  "music",
  "podcast",
];

export interface HomeSectionData {
  options: SourceOption[];
  /** 栏目顶部错误提示（如 TMDB 不可用 / Bangumi 不可用） */
  error?: string | null;
}

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

/** 电影：TMDB 多榜 + NeoDB */
async function loadMovie(): Promise<HomeSectionData> {
  const [neodbMovies, tmdbConfigured] = await Promise.all([
    getTrending("movie", 24).catch(() => []),
    hasTmdb(),
  ]);
  const compactMovies = neodbMovies.map(compactItem);
  if (!tmdbConfigured) {
    return { options: [{ label: "NeoDB", items: compactMovies }] };
  }
  const [tmdbMovies, popularMovies, topMovies, dayMovies, upcoming, nowPlaying] =
    await Promise.all([
      tmdbTrendingCards("movie"),
      getPopularTmdb("movie")
        .then((l) => l.slice(0, 12).map((it) => tmdbItemToCard(it, "movie")))
        .catch(() => []),
      getTopRatedTmdb("movie")
        .then((l) => l.slice(0, 12).map((it) => tmdbItemToCard(it, "movie")))
        .catch(() => []),
      getTrendingDayTmdb("movie")
        .then((l) => l.slice(0, 12).map((it) => tmdbItemToCard(it, "movie")))
        .catch(() => []),
      getUpcomingTmdb()
        .then((l) =>
          l
            .filter(
              (it) =>
                it.release_date &&
                new Date(`${it.release_date}T00:00:00`) > new Date(),
            )
            .slice(0, 12)
            .map((it) => tmdbItemToCard(it, "movie")),
        )
        .catch(() => []),
      getNowPlayingTmdb()
        .then((l) => l.slice(0, 12).map((it) => tmdbItemToCard(it, "movie")))
        .catch(() => []),
    ]);
  const movies = tmdbMovies.items.length > 0 ? tmdbMovies.items : neodbMovies;
  return {
    options: [
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
    // 电影与剧集共用同一 TMDB Key，电影侧失败即可提示
    error: tmdbMovies.error,
  };
}

/** 剧集：TMDB 多榜 + 华语 + NeoDB */
async function loadTv(): Promise<HomeSectionData> {
  const [neodbTvs, tmdbConfigured] = await Promise.all([
    getTrending("tv", 24).catch(() => []),
    hasTmdb(),
  ]);
  const compactTvs = neodbTvs.map(compactItem);
  if (!tmdbConfigured) {
    return { options: [{ label: "NeoDB", items: compactTvs }] };
  }
  const [tmdbTvs, popularTvs, topTvs, dayTvs, airingToday, chineseTv] =
    await Promise.all([
      tmdbTrendingCards("tv"),
      getPopularTmdb("tv")
        .then((l) => l.slice(0, 12).map((it) => tmdbItemToCard(it, "tv")))
        .catch(() => []),
      getTopRatedTmdb("tv")
        .then((l) => l.slice(0, 12).map((it) => tmdbItemToCard(it, "tv")))
        .catch(() => []),
      getTrendingDayTmdb("tv")
        .then((l) => l.slice(0, 12).map((it) => tmdbItemToCard(it, "tv")))
        .catch(() => []),
      getAiringTodayTv()
        .then((l) => l.slice(0, 12).map((it) => tmdbItemToCard(it, "tv")))
        .catch(() => []),
      getTrendingChineseTv()
        .then((l) =>
          l.slice(0, 12).map((it) => tmdbItemToCard(it, "tv")),
        )
        .catch(() => []),
    ]);
  const tvs = tmdbTvs.items.length > 0 ? tmdbTvs.items : neodbTvs;
  return {
    options: [
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
  };
}

/** 动漫：Bangumi 趋势 / 本周在播 / 总榜（TMDB 兜底） */
async function loadAnime(): Promise<HomeSectionData> {
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
      } else if (await hasTmdb()) {
        anime = await getTrendingAnime()
          .then((l) => l.slice(0, 12).map((it) => tmdbItemToCard(it, "tv")))
          .catch(() => []);
      }
      if (anime.length === 0) {
        animeNote = "Bangumi 与 TMDB 都暂时不可用，可稍后刷新";
      }
    }
  }
  const [bgmAiring, animeHeat] = await Promise.all([
    getBangumiAiring(18)
      .then((l) => l.map(bangumiSubjectToCard))
      .catch(() => []),
    getBangumiHotAnime(12)
      .then((l) => l.map(bangumiSubjectToCard))
      .catch(() => []),
  ]);
  return {
    options: [
      { label: "Bangumi 趋势", items: anime },
      { label: "本周在播", items: bgmAiring, note: "本周更新中的新番" },
      { label: "Bangumi 总榜", items: animeHeat, note: "按收藏热度" },
    ],
    error: animeNote ?? null,
  };
}

/** 书籍：NeoDB + 微信读书 */
async function loadBook(): Promise<HomeSectionData> {
  const [neodbBooks, wereadKey] = await Promise.all([
    getTrending("book", 24).catch(() => []),
    wereadApiKey(),
  ]);
  const compactBooks = neodbBooks.map(compactItem);
  const wereadBooks = wereadKey
    ? await getWereadReadBooks(wereadKey, 24).catch(() => [])
    : [];
  const wereadCards = wereadBooks.map(wereadBookToCard);
  return {
    options: [
      { label: "NeoDB", items: compactBooks },
      {
        label: "微信读书·我看过",
        items: wereadCards,
        note: "我的微信读书书架中已读完的书，点击可去 NeoDB 标记",
      },
    ],
  };
}

/** 游戏：Steam 免费 / 热卖 + NeoDB */
async function loadGame(): Promise<HomeSectionData> {
  const [neodbGames, steamGames, steamPlaying] = await Promise.all([
    getTrending("game", 24).catch(() => []),
    getSteamTopSellers(12).catch(() => []),
    getSteamFreeToPlay(12).catch(() => []),
  ]);
  return {
    options: [
      {
        label: "Steam 免费游玩",
        items: steamPlaying.map(steamItemToCard),
        note: "免费游戏按当前在线人数（SteamCharts）",
      },
      {
        label: "Steam 热卖",
        items: steamGames.map(steamItemToCard),
        note: "Steam 官方热销榜",
      },
      { label: "NeoDB", items: neodbGames.map(compactItem) },
    ],
  };
}

/** 音乐：Apple 专辑榜 + NeoDB */
async function loadMusic(): Promise<HomeSectionData> {
  const [neodbMusic, itunesAlbums] = await Promise.all([
    getTrending("music", 24).catch(() => []),
    getItunesTopAlbums(12).catch(() => []),
  ]);
  return {
    options: [
      {
        label: "Apple 音乐榜",
        items: itunesAlbums.map((e) => itunesEntryToCard(e, "music")),
        note: "美区 iTunes 专辑榜",
        square: true,
      },
      { label: "NeoDB", items: neodbMusic.map(compactItem), square: true },
    ],
  };
}

/** 播客：Apple 播客榜 + NeoDB */
async function loadPodcast(): Promise<HomeSectionData> {
  const [neodbPodcasts, itunesPodcasts] = await Promise.all([
    getTrending("podcast", 24).catch(() => []),
    getItunesTopPodcasts("cn", 12).catch(() => []),
  ]);
  return {
    options: [
      {
        label: "Apple 播客榜",
        items: itunesPodcasts.map((e) => itunesEntryToCard(e, "podcast")),
        note: "中文播客（Apple Podcasts 中国区）",
        square: true,
      },
      { label: "NeoDB", items: neodbPodcasts.map(compactItem), square: true },
    ],
  };
}

const LOADERS: Record<string, () => Promise<HomeSectionData>> = {
  movie: loadMovie,
  tv: loadTv,
  anime: loadAnime,
  book: loadBook,
  game: loadGame,
  music: loadMusic,
  podcast: loadPodcast,
};

/** 读取某个栏目数据：SWR 缓存（20 分钟），命中旧值秒开、后台刷新 */
export async function loadHomeSection(key: string): Promise<HomeSectionData> {
  const loader = LOADERS[key];
  if (!loader) return { options: [] };
  const { value } = await getCachedByKey(
    `home:section:${key}`,
    SECTION_TTL,
    loader,
    (v) => v.options.length > 0,
  );
  return value;
}

/** 计算栏目渲染顺序：设置页的手动排序在前，其余按默认顺序补齐 */
export function orderSections(savedOrder: string[]): string[] {
  return [
    ...savedOrder.filter((k) => SECTION_META[k]),
    ...DEFAULT_ORDER.filter((k) => !savedOrder.includes(k)),
  ];
}
