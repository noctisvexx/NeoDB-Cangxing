// Steam 官方公开接口（无需密钥）：热销榜 + 封面
import type { NeoDBItem } from "./types";
import { cached } from "./cache";

export interface SteamTopItem {
  id: number;
  name: string;
  cover: string | null;
  currentPlayers?: number;
}

const STEAM_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36";

/** Steam 热销榜（商店首页 top sellers，官方公开 JSON 接口） */
export async function getSteamTopSellers(limit = 10): Promise<SteamTopItem[]> {
  return cached(`steam-sellers-${limit}`, 30 * 60_000, async () => {
    try {
    const res = await fetch(
      "https://store.steampowered.com/api/featuredcategories/",
      {
        headers: { "User-Agent": STEAM_UA },
        cache: "no-store",
        signal: AbortSignal.timeout(12000),
      },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as {
      top_sellers?: {
        items?: {
          id?: number | string;
          name?: string;
          large_capsule_image?: string;
          small_capsule_image?: string;
        }[];
      };
    };
    const seen = new Set<number>();
    const out: SteamTopItem[] = [];
    for (const it of data.top_sellers?.items ?? []) {
      const id = Number(it.id);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push({
        id,
        name: it.name ?? "",
        // 接口自带的胶囊封面保证可用（header.jpg 对新条目经常 404）
        cover:
          it.large_capsule_image ?? it.small_capsule_image ?? null,
      });
      if (out.length >= limit) break;
    }
      return out;
    } catch {
      return [];
    }
  });
}

/** Steam 免费游玩榜（商店搜索按热销 + 免费过滤） */
export async function getSteamFreeToPlay(
  limit = 12,
): Promise<SteamTopItem[]> {
  return cached(`steam-f2p-${limit}`, 30 * 60_000, async () => {
    try {
    const res = await fetch(
      "https://store.steampowered.com/search/?query=&start=0&count=24&filter=topsellers&maxprice=0&category1=998&cc=us&l=english",
      {
      headers: { "User-Agent": STEAM_UA },
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
      },
    );
    if (!res.ok) return [];
    const html = await res.text();
    const out: SteamTopItem[] = [];
    const rowRe =
      /data-ds-appid="(\d+)"[\s\S]*?<span class="title">([^<]+)<\/span>/g;
    let m: RegExpExecArray | null;
    while ((m = rowRe.exec(html)) !== null && out.length < limit) {
      const id = Number(m[1]);
      const name = m[2].trim();
      if (!id || !name) continue;
      if (!name) continue;
      out.push({
        id,
        name,
        cover: `https://cdn.akamai.steamstatic.com/steam/apps/${id}/header.jpg`,
      });
    }
      return out;
    } catch {
      return [];
    }
  });
}

/** 榜单条目转成站内卡片（uuid 用 steam-{appid}，详情页解析到 NeoDB） */
export function steamItemToCard(it: SteamTopItem): NeoDBItem {
  return {
    uuid: `steam-${it.id}`,
    type: "game",
    category: "game",
    display_title: it.name,
    orig_title: it.name,
    cover_image_url: it.cover ?? undefined,
    brief: it.currentPlayers
      ? `当前在线 ${it.currentPlayers.toLocaleString()} 人`
      : undefined,
  };
}
