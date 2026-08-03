// Bangumi 开放 API（无需密钥）：动漫热门榜 + 从 bgm 链接取评分
import type { NeoDBItem } from "./types";
import { cached } from "./cache";

export interface BangumiRatingInfo {
  id: number;
  score: number | null;
  total: number | null;
  rank: number | null;
  url: string;
}

export interface BangumiSubject {
  id: number;
  name: string;
  name_cn?: string;
  date?: string;
  summary?: string;
  images?: { common?: string; large?: string; medium?: string };
  rating?: { score?: number | null; total?: number | null; rank?: number | null };
}

const BGM_UA = "DiscoverySea/0.1 (local personal discovery tool)";
const BGM_BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

/**
 * 网站「趋势」榜：与 bgm.tv/anime/browser?sort=trends 一致。
 * 注意路径不能带尾斜杠（带斜杠会 403）。
 */
export async function getBangumiTrending(
  limit = 18,
): Promise<BangumiSubject[]> {
  return cached(`bgm-trends-${limit}`, 30 * 60_000, async () => {
    try {
    const res = await fetch("https://bgm.tv/anime/browser?sort=trends", {
      headers: {
        "User-Agent": BGM_BROWSER_UA,
        Accept: "text/html,application/xhtml+xml",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return [];
    const html = await res.text();
    const items: BangumiSubject[] = [];
    const blockRe = /<li id="item_(\d+)"[\s\S]*?<\/li>/g;
    let m: RegExpExecArray | null;
    while ((m = blockRe.exec(html)) !== null && items.length < limit) {
      const block = m[0];
      const coverM = block.match(/src="(\/\/lain\.bgm\.tv[^"]+)"/);
      const titleM = block.match(/class="l">([^<]+)</);
      const infoM = block.match(/<p class="info tip">\s*([^<]+)/);
      const title = titleM ? decodeEntities(titleM[1].trim()) : "";
      if (!title) continue;
      const info = infoM ? decodeEntities(infoM[1].trim()) : "";
      const yearM = info.match(/(20\d{2})/);
      items.push({
        id: Number(m[1]),
        name_cn: title,
        name: title,
        images: { common: coverM ? `https:${coverM[1]}` : undefined },
        date: yearM ? `${yearM[1]}-01-01` : undefined,
      });
    }
      return items;
    } catch {
      return [];
    }
  });
}

export function parseBgmId(url: string): number | null {
  try {
    const u = new URL(url);
    if (!u.hostname.endsWith("bgm.tv")) return null;
    const m = u.pathname.match(/\/subject\/(\d+)/);
    return m ? Number(m[1]) : null;
  } catch {
    return null;
  }
}

/** 热门动漫（搜索接口按热度排序） */
export async function getBangumiHotAnime(limit = 18): Promise<BangumiSubject[]> {
  try {
    const res = await fetch("https://api.bgm.tv/v0/search/subjects", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": BGM_UA,
      },
      body: JSON.stringify({ sort: "heat", filter: { type: [2] } }),
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { data?: BangumiSubject[] };
    return (data.data ?? []).slice(0, limit);
  } catch {
    return [];
  }
}

/** 高分动漫排行榜（备用） */
export async function getBangumiRanking(limit = 18): Promise<BangumiSubject[]> {
  try {
    const res = await fetch(
      `https://api.bgm.tv/v0/subjects?type=2&sort=rank&limit=${limit}`,
      {
        headers: { "User-Agent": BGM_UA },
        cache: "no-store",
        signal: AbortSignal.timeout(12000),
      },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { data?: BangumiSubject[] };
    return data.data ?? [];
  } catch {
    return [];
  }
}

/** 本周在播（每日放送）：当前周更新中的新番 */
export async function getBangumiAiring(limit = 18): Promise<BangumiSubject[]> {
  return cached(`bgm-airing-${limit}`, 30 * 60_000, async () => {
    try {
    const res = await fetch("https://api.bgm.tv/calendar", {
      headers: { "User-Agent": BGM_UA },
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { items?: BangumiSubject[] }[];
    const seen = new Set<number>();
    const out: BangumiSubject[] = [];
    for (const day of data) {
      for (const it of day.items ?? []) {
        if (!seen.has(it.id)) {
          seen.add(it.id);
          out.push(it);
        }
      }
    }
      return out.slice(0, limit);
    } catch {
      return [];
    }
  });
}

/** 批量补齐评分（趋势榜条目本身不带评分，逐个拉取详情） */
export async function enrichBangumiRatings(
  items: BangumiSubject[],
  limit = 16,
): Promise<BangumiSubject[]> {
  const list = items.slice(0, limit);
  const key = `bgm-enrich-${list
    .slice(0, 6)
    .map((i) => i.id)
    .join("-")}`;
  return cached(key, 30 * 60_000, async () => {
    const results = await Promise.allSettled(
      list.map(async (it) => {
        const res = await fetch(`https://api.bgm.tv/v0/subjects/${it.id}`, {
          headers: { "User-Agent": BGM_UA },
          cache: "no-store",
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) return it;
        const d = (await res.json()) as {
          rating?: { score?: number | null; total?: number | null };
        };
        return {
          ...it,
          rating: {
            score: d.rating?.score ?? null,
            total: d.rating?.total ?? null,
          },
        };
      }),
    );
    return results.map((r, i) =>
      r.status === "fulfilled" ? r.value : list[i],
    );
  });
}

/** 按 id 取 Bangumi 条目（用于未收录时按名搜 NeoDB） */
export async function getBangumiSubject(
  id: number,
): Promise<{
  name?: string;
  name_cn?: string;
  date?: string;
  images?: { common?: string; large?: string };
} | null> {
  try {
    const res = await fetch(`https://api.bgm.tv/v0/subjects/${id}`, {
      headers: { "User-Agent": BGM_UA },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return (await res.json()) as {
      name?: string;
      name_cn?: string;
      date?: string;
      images?: { common?: string; large?: string };
    };
  } catch {
    return null;
  }
}

/** 把 Bangumi 条目转成站点内卡片（uuid 用 bgm-{id}，详情页再解析为 NeoDB 条目） */
export function bangumiSubjectToCard(s: BangumiSubject): NeoDBItem {
  const year = (s.date ?? "").slice(0, 4);
  return {
    uuid: `bgm-${s.id}`,
    type: "tv",
    category: "tv",
    display_title: s.name_cn || s.name,
    orig_title: s.name,
    brief: s.summary ?? "",
    cover_image_url: s.images?.common ?? s.images?.large ?? undefined,
    rating: s.rating?.score ?? null,
    rating_count: s.rating?.total ?? 0,
    year: year ? Number(year) : null,
  };
}

export async function getBangumiRating(
  item: NeoDBItem,
): Promise<BangumiRatingInfo | null> {
  const links = item.external_resources?.map((r) => r.url) ?? [];
  for (const link of links) {
    const id = parseBgmId(link);
    if (!id) continue;
    try {
      const res = await fetch(`https://api.bgm.tv/v0/subjects/${id}`, {
        headers: { "User-Agent": BGM_UA },
        cache: "no-store",
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as {
        rating?: {
          score?: number | null;
          total?: number | null;
          rank?: number | null;
        };
      };
      return {
        id,
        score: data.rating?.score ?? null,
        total: data.rating?.total ?? null,
        rank: data.rating?.rank ?? null,
        url: `https://bgm.tv/subject/${id}`,
      };
    } catch {
      return null;
    }
  }
  return null;
}
