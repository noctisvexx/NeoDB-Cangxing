// 本地持久化缓存（SWR 策略）：
// 命中时先秒开返回旧数据，同时在后台刷新；未命中时单飞加载，
// 让「预热」与「页面请求」共享同一次上游请求，避免重复打接口。
// 条目详情、首页榜单等变化慢的数据都通过这里落盘到 data/cache.json。
import { promises as fs } from "node:fs";
import path from "node:path";

export interface ItemCacheEntry<T> {
  savedAt: number;
  value: T;
}

/** 条目详情各板块的过期时间（音乐/游戏等评价相对固定 3 天，NeoDB 评论 4 小时） */
export const ITEM_TTL = {
  core: 3 * 24 * 60 * 60_000,
  posts: 4 * 60 * 60_000,
  ratings: 3 * 24 * 60 * 60_000,
  similar: 3 * 24 * 60 * 60_000,
};

const store = new Map<string, ItemCacheEntry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();
const revalidating = new Set<string>();
let loaded = false;
let writeQueue: Promise<void> = Promise.resolve();

function cacheFilePath(): string {
  const root = process.env.CANGXING_DATA_DIR || process.cwd();
  return path.join(root, "data", "cache.json");
}

async function ensureLoaded(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await fs.readFile(cacheFilePath(), "utf8");
    const data = JSON.parse(raw) as Record<string, ItemCacheEntry<unknown>>;
    for (const [key, entry] of Object.entries(data)) {
      if (
        entry &&
        typeof entry === "object" &&
        entry.value !== undefined &&
        typeof entry.savedAt === "number"
      ) {
        store.set(key, entry);
      }
    }
  } catch {
    // 首次运行或文件尚未生成，直接使用空缓存
  }
}

/** 串行写盘，避免并发写坏文件；写失败不影响页面 */
function persist(): void {
  writeQueue = writeQueue
    .then(async () => {
      try {
        const file = cacheFilePath();
        await fs.mkdir(path.dirname(file), { recursive: true });
        const payload: Record<string, ItemCacheEntry<unknown>> = {};
        for (const [key, entry] of store) payload[key] = entry;
        await fs.writeFile(file, JSON.stringify(payload), "utf8");
      } catch {
        // 忽略写入错误
      }
    })
    .catch(() => {});
}

async function readEntry<T>(key: string, ttlMs: number): Promise<{
  hit: boolean;
  fresh: boolean;
  value: T | null;
}> {
  await ensureLoaded();
  const entry = store.get(key) as ItemCacheEntry<T> | undefined;
  if (!entry) {
    return { hit: false, fresh: false, value: null };
  }
  return {
    hit: true,
    fresh: Date.now() - entry.savedAt <= ttlMs,
    value: entry.value,
  };
}

function writeEntry<T>(key: string, value: T): void {
  store.set(key, { savedAt: Date.now(), value });
  persist();
}

/** 按 key + TTL 的 SWR 读取：新鲜直接返回；过期先返回旧数据并后台刷新；未命中则加载并写入 */
export async function getCachedByKey<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
  shouldCache?: (value: T) => boolean,
): Promise<{ value: T; fromCache: boolean; revalidating: boolean }> {
  const hit = await readEntry<T>(key, ttlMs);
  if (hit.hit && hit.value != null) {
    if (hit.fresh) {
      return { value: hit.value, fromCache: true, revalidating: false };
    }
    // SWR：不阻塞渲染，后台刷新，下次访问即为新数据
    void revalidateByKey(key, loader, shouldCache);
    return { value: hit.value, fromCache: true, revalidating: true };
  }

  const existing = inFlight.get(key);
  if (existing) {
    const value = (await existing) as T;
    return { value, fromCache: false, revalidating: true };
  }

  const task = (async () => {
    const value = await loader();
    if (!shouldCache || shouldCache(value)) {
      writeEntry(key, value);
    }
    return value;
  })();
  inFlight.set(key, task);
  try {
    const value = await task;
    return { value, fromCache: false, revalidating: false };
  } finally {
    inFlight.delete(key);
  }
}

/** 后台刷新单个条目（带单飞保护，并发触发时只刷一次） */
export async function revalidateByKey<T>(
  key: string,
  loader: () => Promise<T>,
  shouldCache?: (value: T) => boolean,
): Promise<void> {
  if (revalidating.has(key)) return;
  revalidating.add(key);
  try {
    const value = await loader();
    if (!shouldCache || shouldCache(value)) {
      writeEntry(key, value);
    }
  } catch {
    // 后台刷新失败时保留旧缓存，下次访问再试
  } finally {
    revalidating.delete(key);
  }
}

/** 配置变化（如标题修正、更换 Key）后清空全部本地缓存，下次访问重新拉取 */
export function clearPersistentCache(): void {
  store.clear();
  loaded = true;
  inFlight.clear();
  revalidating.clear();
  persist();
}
