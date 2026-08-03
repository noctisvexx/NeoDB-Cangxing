// 简单的进程内内存缓存：热门榜单这类变化慢的数据用短 TTL 缓存，
// 避免每次刷新都打几十个上游请求

const store = new Map<string, { expires: number; value: unknown }>();

export async function cached<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
): Promise<T> {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.expires > now) {
    return hit.value as T;
  }
  const value = await loader();
  // 空列表不缓存（网络失败可能返回空数组，下次重试）
  if (!(Array.isArray(value) && value.length === 0)) {
    store.set(key, { expires: now + ttlMs, value });
  }
  return value;
}

export function clearCache(keyPrefix?: string): void {
  if (!keyPrefix) {
    store.clear();
    return;
  }
  for (const key of store.keys()) {
    if (key.startsWith(keyPrefix)) store.delete(key);
  }
}
