import { tmdbApiKey } from "./config";
import { cached } from "./cache";
import type { NeoDBItem } from "./types";

const TMDB_BASE = "https://api.themoviedb.org/3";

export class TmdbUnconfiguredError extends Error {
  constructor() {
    super("TMDB_API_KEY 未配置");
    this.name = "TmdbUnconfiguredError";
  }
}

export interface TMDBItem {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  overview?: string;
  vote_average?: number;
  vote_count?: number;
  release_date?: string;
  first_air_date?: string;
  genre_ids?: number[];
  media_type?: string;
}

interface TMDBListResponse {
  results: TMDBItem[];
  total_results: number;
}

async function tmdbGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const key = await tmdbApiKey();
  if (!key) {
    throw new TmdbUnconfiguredError();
  }
  // TMDB 两种凭据都支持：API Key (v3) 用 api_key 参数；
  // API Read Access Token (v4, eyJ 开头的 JWT) 用 Authorization 头
  const isJwt = key.startsWith("eyJ");
  const headers = new Headers();
  if (isJwt) {
    headers.set("Authorization", `Bearer ${key}`);
  }
  const qs = new URLSearchParams({ language: "zh-CN", ...params });
  if (!isJwt) {
    qs.set("api_key", key);
  }
  const url = `${TMDB_BASE}${path}?${qs.toString()}`;
  const res = await fetch(url, {
    headers,
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) {
    let detail = "";
    try {
      detail = (await res.text()).slice(0, 200);
    } catch {
      // 忽略
    }
    throw new Error(`TMDB 请求失败：${res.status} ${path} ${detail}`);
  }
  return (await res.json()) as T;
}

export function posterUrl(
  path: string | null | undefined,
  size = "w342",
): string | null {
  if (!path) return null;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

/** 把 TMDB 条目转成站点内的卡片数据（uuid 用 tmdb-{type}-{id}，详情页再解析为 NeoDB 条目） */
export function tmdbItemToCard(
  item: TMDBItem,
  type: "movie" | "tv",
): import("./types").NeoDBItem {
  const date = item.release_date ?? item.first_air_date ?? "";
  const year = date.slice(0, 4);
  return {
    uuid: `tmdb-${type}-${item.id}`,
    type,
    category: type,
    display_title: item.title ?? item.name ?? "",
    orig_title: item.original_title ?? item.original_name ?? "",
    brief: item.overview ?? "",
    cover_image_url: posterUrl(item.poster_path, "w500") ?? undefined,
    rating: item.vote_average ?? null,
    rating_count: item.vote_count ?? 0,
    year: year ? Number(year) : null,
  };
}

export async function getTrendingTmdb(
  mediaType: "movie" | "tv",
  timeWindow: "day" | "week" = "week",
): Promise<TMDBItem[]> {
  return cached(
    `tmdb-trend-${mediaType}-${timeWindow}`,
    30 * 60_000,
    async () => {
      const data = await tmdbGet<TMDBListResponse>(
        `/trending/${mediaType}/${timeWindow}`,
        {},
      );
      return data.results ?? [];
    },
  );
}

/** 热门日本动画（TMDB：日语动画剧集，按热度排序） */
export async function getTrendingAnime(): Promise<TMDBItem[]> {
  return cached("tmdb-anime", 30 * 60_000, async () => {
    const data = await tmdbGet<TMDBListResponse>("/discover/tv", {
      with_genres: "16",
      with_original_language: "ja",
      sort_by: "popularity.desc",
      "vote_count.gte": "50",
    });
    return data.results ?? [];
  });
}

/** 热门华语剧集（中文原创剧，TMDB 发现接口） */
export async function getTrendingChineseTv(): Promise<TMDBItem[]> {
  return cached("tmdb-chinese-tv", 30 * 60_000, async () => {
    const year = new Date().getFullYear();
    const data = await tmdbGet<TMDBListResponse>("/discover/tv", {
      with_original_language: "zh",
      sort_by: "popularity.desc",
      "vote_count.gte": "20",
      "primary_release_date.gte": `${year - 2}-01-01`,
    });
    return data.results ?? [];
  });
}

/** TMDB 高分榜（近 5 年、评分人数足够） */
export async function getTopRatedTmdb(
  mediaType: "movie" | "tv",
): Promise<TMDBItem[]> {
  return cached(`tmdb-toprated-${mediaType}`, 30 * 60_000, async () => {
    const year = new Date().getFullYear();
    const data = await tmdbGet<TMDBListResponse>(`/discover/${mediaType}`, {
      sort_by: "vote_average.desc",
      "vote_count.gte": mediaType === "movie" ? "2000" : "1000",
      [mediaType === "movie"
        ? "primary_release_date.gte"
        : "first_air_date.gte"]: `${year - 5}-01-01`,
    });
    return data.results ?? [];
  });
}

/** TMDB 流行榜（按人气/热度综合） */
export async function getPopularTmdb(
  mediaType: "movie" | "tv",
): Promise<TMDBItem[]> {
  return cached(`tmdb-popular-${mediaType}`, 30 * 60_000, async () => {
    const data = await tmdbGet<TMDBListResponse>(`/${mediaType}/popular`, {});
    return data.results ?? [];
  });
}

/** TMDB 今日趋势 */
export async function getTrendingDayTmdb(
  mediaType: "movie" | "tv",
): Promise<TMDBItem[]> {
  return cached(`tmdb-trend-day-${mediaType}`, 60 * 60_000, async () => {
    const data = await tmdbGet<TMDBListResponse>(
      `/trending/${mediaType}/day`,
      {},
    );
    return data.results ?? [];
  });
}

/** 即将上映电影 */
export async function getUpcomingTmdb(): Promise<TMDBItem[]> {
  return cached("tmdb-upcoming", 60 * 60_000, async () => {
    const data = await tmdbGet<TMDBListResponse>("/movie/upcoming", {});
    return data.results ?? [];
  });
}

/** 正在上映电影 */
export async function getNowPlayingTmdb(): Promise<TMDBItem[]> {
  return cached("tmdb-nowplaying", 60 * 60_000, async () => {
    const data = await tmdbGet<TMDBListResponse>("/movie/now_playing", {});
    return data.results ?? [];
  });
}

/** 今日更新剧集 */
export async function getAiringTodayTv(): Promise<TMDBItem[]> {
  return cached("tmdb-airing-today", 60 * 60_000, async () => {
    const data = await tmdbGet<TMDBListResponse>("/tv/airing_today", {});
    return data.results ?? [];
  });
}

/** 按 id 取 TMDB 条目详情（用于未收录时按名搜 NeoDB） */
export async function getTmdbItem(
  id: number,
  type: "movie" | "tv",
): Promise<TMDBItem | null> {
  try {
    return await tmdbGet<TMDBItem>(`/${type}/${id}`, {});
  } catch {
    return null;
  }
}

export async function searchTmdb(query: string): Promise<TMDBItem[]> {
  const data = await tmdbGet<TMDBListResponse>("/search/multi", { query });
  return data.results ?? [];
}

export function parseTmdbUrl(
  url: string,
): { id: number; type: "movie" | "tv" } | null {
  try {
    const u = new URL(url);
    if (!u.hostname.endsWith("themoviedb.org")) return null;
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    const type = parts[0] === "tv" ? "tv" : parts[0] === "movie" ? "movie" : null;
    if (!type) return null;
    const id = Number(parts[1]);
    if (!Number.isInteger(id) || id <= 0) return null;
    return { id, type };
  } catch {
    return null;
  }
}

export interface TMDBRatingInfo {
  id: number;
  type: "movie" | "tv";
  title: string;
  year?: string;
  rating: number;
  voteCount: number;
  poster: string | null;
  url: string;
}

/** 从 NeoDB 条目的外部链接中找到 TMDB 条目并取评分 */
export async function getTmdbRating(item: NeoDBItem): Promise<TMDBRatingInfo | null> {
  const links = item.external_resources?.map((r) => r.url) ?? [];
  for (const link of links) {
    const parsed = parseTmdbUrl(link);
    if (!parsed) continue;
    const data = await tmdbGet<TMDBItem>(`/${parsed.type}/${parsed.id}`, {});
    return {
      id: parsed.id,
      type: parsed.type,
      title: data.title ?? data.name ?? "",
      year: (data.release_date ?? data.first_air_date ?? "").slice(0, 4) || undefined,
      rating: data.vote_average ?? 0,
      voteCount: data.vote_count ?? 0,
      poster: posterUrl(data.poster_path, "w342"),
      url: `https://www.themoviedb.org/${parsed.type}/${parsed.id}`,
    };
  }
  return null;
}
