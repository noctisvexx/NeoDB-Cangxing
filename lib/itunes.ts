// iTunes / Apple 排行榜（经典 RSS 接口，无需密钥）：
// 美国区音乐专辑榜 + 中国区中文播客榜，可进一步解析到 NeoDB
import type { NeoDBItem } from "./types";
import { cached } from "./cache";

export interface ItunesEntry {
  id: number;
  name: string;
  artist: string;
  artwork: string | null;
  url: string;
}

interface ItunesRawEntry {
  id?: { label?: string; attributes?: { "im:id"?: string } };
  "im:name"?: { label?: string };
  "im:artist"?: { label?: string };
  "im:image"?: { label?: string }[];
  link?: { attributes?: { href?: string } };
}

interface ItunesFeed {
  feed?: { entry?: ItunesRawEntry[] };
}

async function itunesGet<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function parseRssEntries(feed: ItunesFeed): ItunesEntry[] {
  const entries = feed.feed?.entry ?? [];
  const out: ItunesEntry[] = [];
  for (const e of entries) {
    const id = Number(e.id?.attributes?.["im:id"]);
    const name = e["im:name"]?.label;
    if (!id || !name) continue;
    const img = e["im:image"]?.[2]?.label ?? e["im:image"]?.[0]?.label;
    out.push({
      id,
      name,
      artist: e["im:artist"]?.label ?? "",
      artwork: img ? img.replace(/\/\d+x\d+bb\./, "/600x600bb.") : null,
      url: e.link?.attributes?.href ?? `https://itunes.apple.com/${e.id?.label ?? ""}`,
    });
  }
  return out;
}

/** 美国区专辑榜（真实商业榜单） */
export async function getItunesTopAlbums(limit = 12): Promise<ItunesEntry[]> {
  return cached(`itunes-albums-${limit}`, 60 * 60_000, async () => {
    const data = await itunesGet<ItunesFeed>(
      `https://itunes.apple.com/us/rss/topalbums/limit=${limit}/json`,
    );
    return data ? parseRssEntries(data) : [];
  });
}

/** 播客榜：us 为全球榜，cn 为中文播客榜 */
export async function getItunesTopPodcasts(
  country: "us" | "cn" = "cn",
  limit = 12,
): Promise<ItunesEntry[]> {
  return cached(`itunes-podcasts-${country}-${limit}`, 60 * 60_000, async () => {
    const data = await itunesGet<ItunesFeed>(
      `https://itunes.apple.com/${country}/rss/toppodcasts/limit=${limit}/json`,
    );
    return data ? parseRssEntries(data) : [];
  });
}

/** 按 id 查询 iTunes 条目信息（详情页解析用） */
export async function lookupItunes(
  id: number,
  country: "us" | "cn",
): Promise<ItunesEntry | null> {
  const data = await itunesGet<{
    results?: {
      collectionName?: string;
      trackName?: string;
      artistName?: string;
      artworkUrl100?: string;
      collectionViewUrl?: string;
      trackViewUrl?: string;
    }[];
  }>(`https://itunes.apple.com/lookup?id=${id}&country=${country}`);
  const r = data?.results?.[0];
  if (!r) return null;
  const name = r.collectionName ?? r.trackName ?? r.artistName ?? "";
  if (!name) return null;
  return {
    id,
    name,
    artist: r.artistName ?? "",
    artwork: r.artworkUrl100
      ? r.artworkUrl100.replace("/100x100bb.", "/600x600bb.")
      : null,
    url: r.collectionViewUrl ?? r.trackViewUrl ?? "https://music.apple.com/",
  };
}

/** 榜单条目转成站内卡片（uuid 用 itunes-{type}-{id}，详情页解析到 NeoDB） */
export function itunesEntryToCard(
  e: ItunesEntry,
  type: "music" | "podcast",
): NeoDBItem {
  return {
    uuid: `itunes-${type}-${e.id}`,
    type,
    category: type,
    display_title: e.name,
    orig_title: e.name,
    brief: e.artist,
    cover_image_url: e.artwork ?? undefined,
  };
}
