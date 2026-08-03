// OMDb（第三方开放 API，数据源自 IMDb）：显示 IMDb 评分
// IMDb 官方没有公开 API，OMDb 是常见的免费替代（需要 omdbapi.com 的免费 Key）
import { omdbApiKey } from "./config";
import type { NeoDBItem } from "./types";

export interface ImdbRatingInfo {
  id: string;
  rating: number | null;
  votes: number | null;
  title: string;
  year?: string;
  url: string;
}

export function parseImdbId(item: NeoDBItem): string | null {
  const fromImdbField = typeof item.imdb === "string" ? item.imdb : "";
  const candidates = [
    fromImdbField,
    ...(item.external_resources ?? []).map((r) => r.url),
  ];
  for (const c of candidates) {
    const m = c.match(/tt\d{7,10}/);
    if (m) return m[0];
  }
  return null;
}

export async function getImdbRating(
  item: NeoDBItem,
): Promise<ImdbRatingInfo | null> {
  let key = (await omdbApiKey()) ?? null;
  if (!key) return null;
  // 兼容粘贴了完整申请链接的情况：从 apikey= 参数里提取 Key
  const keyParam = key.match(/apikey=([A-Za-z0-9]+)/);
  if (keyParam) key = keyParam[1];
  else if (key.includes("/") || key.includes("?")) return null;
  const id = parseImdbId(item);
  if (!id) return null;
  try {
    const res = await fetch(
      `https://www.omdbapi.com/?apikey=${encodeURIComponent(key)}&i=${id}&plot=short`,
      {
        cache: "no-store",
        signal: AbortSignal.timeout(3000),
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      Response?: string;
      imdbRating?: string;
      imdbVotes?: string;
      Title?: string;
      Year?: string;
      Error?: string;
    };
    if (data.Response === "False") return null;
    const rating = Number(data.imdbRating);
    return {
      id,
      rating: Number.isFinite(rating) && rating > 0 ? rating : null,
      votes: Number(data.imdbVotes?.replace(/,/g, "")) || null,
      title: data.Title ?? "",
      year: data.Year,
      url: `https://www.imdb.com/title/${id}/`,
    };
  } catch {
    return null;
  }
}
