import { neoDbInstance, neoDbToken } from "./config";
import { cached } from "./cache";
import type {
  NeoDBItem,
  NeoDBMark,
  NeoDBPost,
  NeoDBUser,
  NeoDBCategory,
  Paged,
  ShelfType,
} from "./types";

export class NeoDBError extends Error {
  status: number;
  detail: unknown;

  constructor(message: string, status: number, detail?: unknown) {
    super(message);
    this.name = "NeoDBError";
    this.status = status;
    this.detail = detail;
  }
}

/** NeoDB 已受理该条目、正在收录中（202） */
export class NeoDBFetchPendingError extends Error {
  constructor() {
    super("NeoDB 正在收录该条目，请稍后刷新");
    this.name = "NeoDBFetchPendingError";
  }
}

const ITEM_CATEGORIES: NeoDBCategory[] = [
  "movie",
  "tv",
  "book",
  "game",
  "music",
  "podcast",
  "performance",
];

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await neoDbToken();
  const headers = new Headers(init?.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const res = await fetch(`${neoDbInstance()}${path}`, {
    ...init,
    headers,
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    let detail: unknown = null;
    try {
      detail = await res.json();
    } catch {
      // 401 等错误通常没有 body
    }
    const message =
      res.status === 401
        ? "NeoDB 令牌不可用（401）：可能已过期、无效，或当前令牌没有写入权限（测试令牌通常只读）。请到「我的」页面用 OAuth 重新连接。"
        : `NeoDB 请求失败：${res.status} ${path}`;
    throw new NeoDBError(message, res.status, detail);
  }
  return (await res.json()) as T;
}

/** 热门榜单：返回条目数组（NeoDB 接口本身就是数组） */
export function getTrending(category: string, pageSize = 24): Promise<NeoDBItem[]> {
  return cached(
    `neodb-trending-${category}-${pageSize}`,
    30 * 60_000,
    () => request<NeoDBItem[]>(`/api/trending/${category}/?page_size=${pageSize}`),
  );
}

export function searchCatalog(
  query: string,
  category?: string,
  page = 1,
): Promise<Paged<NeoDBItem>> {
  const params = new URLSearchParams({ query, page: String(page) });
  if (category && category !== "all") {
    params.set("category", category);
  }
  return request<Paged<NeoDBItem>>(`/api/catalog/search?${params.toString()}`);
}

/** 通过受支持的站点 URL（如 TMDB）解析出 NeoDB 条目；收录中抛 NeoDBFetchPendingError */
export async function fetchItemByUrl(url: string): Promise<NeoDBItem> {
  const token = await neoDbToken();
  const headers = new Headers();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const res = await fetch(
    `${neoDbInstance()}/api/catalog/fetch?url=${encodeURIComponent(url)}`,
    {
      headers,
      cache: "no-store",
      redirect: "follow",
    },
  );
  if (res.status === 202) throw new NeoDBFetchPendingError();
  if (!res.ok) {
    const message =
      res.status === 401
        ? "NeoDB 令牌无效或已过期（401），请到「我的」页面重新连接 NeoDB 账号。"
        : `NeoDB 请求失败：${res.status}`;
    throw new NeoDBError(message, res.status);
  }
  return (await res.json()) as NeoDBItem;
}

/** 按 uuid 获取条目；未指定类型时依次尝试各分类 */
export async function getItem(uuid: string, category?: string): Promise<NeoDBItem> {
  const candidates = category ? [category] : ITEM_CATEGORIES;
  let lastError: unknown = null;
  for (const c of candidates) {
    try {
      return await request<NeoDBItem>(`/api/${c}/${uuid}`);
    } catch (err) {
      lastError = err;
      if (err instanceof NeoDBError && err.status !== 404) {
        throw err;
      }
    }
  }
  throw lastError instanceof NeoDBError
    ? lastError
    : new NeoDBError(`未找到条目 ${uuid}`, 404);
}

/** 当前用户对某条目的书架标记；未登录或未标记返回 null */
export async function getMyMark(uuid: string): Promise<NeoDBMark | null> {
  if (!(await neoDbToken())) return null;
  try {
    return await request<NeoDBMark>(`/api/me/shelf/item/${uuid}`);
  } catch (err) {
    if (err instanceof NeoDBError && err.status === 404) return null;
    throw err;
  }
}

export function getShelf(
  type: ShelfType,
  page = 1,
  pageSize = 24,
  category?: string,
): Promise<Paged<NeoDBMark>> {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });
  if (category) {
    params.set("category", category);
  }
  // 注意：书架接口路径不带末尾斜杠，带斜杠会 404
  return request<Paged<NeoDBMark>>(`/api/me/shelf/${type}?${params.toString()}`);
}

/** 拉取全部书架（想看/在看/已看/弃了），供导入本地或导出备份使用 */
export async function fetchAllShelfMarks(
  maxPagesPerShelf = 50,
): Promise<{ marks: NeoDBMark[]; errors: string[] }> {
  const shelves: ShelfType[] = ["wishlist", "progress", "complete", "dropped"];
  const errors: string[] = [];
  const out: NeoDBMark[] = [];
  for (const shelf of shelves) {
    for (let page = 1; page <= maxPagesPerShelf; page++) {
      let result: Paged<NeoDBMark> | null = null;
      try {
        result = await getShelf(shelf, page, 100);
      } catch (e) {
        errors.push(
          `${shelf} 第 ${page} 页读取失败：${
            e instanceof Error ? e.message : "未知错误"
          }`,
        );
        break;
      }
      const marks = result?.data ?? [];
      out.push(...marks);
      if (marks.length < 100) break;
    }
  }
  return { marks: out, errors };
}

export function markItem(
  uuid: string,
  body: {
    shelf_type: ShelfType;
    rating_grade?: number;
    comment_text?: string;
    visibility?: number;
    tags?: string[];
  },
): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/api/me/shelf/item/${uuid}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ visibility: 0, ...body }),
  });
}

export function deleteMark(uuid: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/api/me/shelf/item/${uuid}`, {
    method: "DELETE",
  });
}

/** 条目下的动态：type 可传 review 过滤长评；不传则返回全部（含短评） */
export function getItemPosts(
  uuid: string,
  type?: string,
  page = 1,
): Promise<Paged<NeoDBPost>> {
  const params = new URLSearchParams({ page: String(page) });
  if (type) {
    params.set("type", type);
  }
  return request<Paged<NeoDBPost>>(`/api/item/${uuid}/posts/?${params.toString()}`);
}

export function getSimilar(
  uuid: string,
  limit = 12,
): Promise<{ data: NeoDBItem[]; count: number }> {
  return request<{ data: NeoDBItem[]; count: number }>(
    `/api/catalog/item/${uuid}/similar?limit=${limit}`,
  );
}

export function getMe(): Promise<NeoDBUser> {
  return request<NeoDBUser>("/api/me");
}

export function getRecommendations(
  limit = 24,
): Promise<{ data: NeoDBItem[]; count: number }> {
  return request<{ data: NeoDBItem[]; count: number }>(
    `/api/me/recommendations?limit=${limit}`,
  );
}
