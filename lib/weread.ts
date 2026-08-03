// 微信读书：通过 Agent API Gateway 获取"为你推荐"书单（需要 wrk- 开头的 Key）
import type { NeoDBItem } from "./types";
import { cached } from "./cache";

const GATEWAY = "https://i.weread.qq.com/api/agent/gateway";

export interface WereadBook {
  bookId: string;
  title: string;
  author: string;
  cover: string;
  intro: string;
  rating: number | null; // 0-100
  ratingCount: number | null;
}

async function gateway<T>(
  apiKey: string,
  body: Record<string, unknown>,
): Promise<T | null> {
  try {
    const res = await fetch(GATEWAY, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ skill_version: "1.0.3", ...body }),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { errcode?: number };
    if (data.errcode) return null;
    return data as T;
  } catch {
    return null;
  }
}

function mapBook(raw: unknown): WereadBook | null {
  const b = raw as {
    bookId?: string;
    title?: string;
    author?: string;
    cover?: string;
    intro?: string;
    newRating?: number;
    newRatingCount?: number;
  };
  if (!b.bookId || !b.title) return null;
  return {
    bookId: String(b.bookId),
    title: b.title,
    author: b.author ?? "",
    cover: b.cover ?? "",
    intro: b.intro ?? "",
    rating: typeof b.newRating === "number" ? b.newRating : null,
    ratingCount: typeof b.newRatingCount === "number" ? b.newRatingCount : null,
  };
}

/** 微信读书「为你推荐」（基于用户阅读记录） */
export async function getWereadRecommendations(
  apiKey: string,
  count = 12,
): Promise<WereadBook[]> {
  const data = await gateway<{ books?: unknown[] }>(apiKey, {
    api_name: "/book/recommend",
    count,
  });
  return (data?.books ?? []).map(mapBook).filter((b): b is WereadBook => !!b);
}

/** 微信读书「我看过的书」（书架中已读完的） */
export async function getWereadReadBooks(
  apiKey: string,
  limit = 24,
): Promise<WereadBook[]> {
  return cached("weread-shelf", 30 * 60_000, async () => {
    const data = await gateway<{ books?: unknown[] }>(apiKey, {
      api_name: "/shelf/sync",
    });
    const books = (data?.books ?? [])
      .filter((b) => (b as { finishReading?: number }).finishReading === 1)
      .map(mapBook)
      .filter((b): b is WereadBook => !!b);
    return books.slice(0, limit);
  });
}

/** 单本书信息（详情页解析用） */
export async function getWereadBookInfo(
  apiKey: string,
  bookId: string,
): Promise<WereadBook | null> {
  const data = await gateway<{ bookInfo?: unknown }>(apiKey, {
    api_name: "/book/info",
    bookId,
  });
  // 字段平铺在顶层（部分版本在 bookInfo 子对象里），两种都兼容
  return mapBook(data?.bookInfo ?? data);
}

export function wereadBookToCard(b: WereadBook): NeoDBItem {
  return {
    uuid: `weread-${b.bookId}`,
    type: "book",
    category: "book",
    display_title: b.title,
    orig_title: b.title,
    brief: b.author,
    cover_image_url: b.cover || undefined,
    rating: b.rating != null ? b.rating / 10 : null,
    rating_count: b.ratingCount ?? 0,
  };
}
