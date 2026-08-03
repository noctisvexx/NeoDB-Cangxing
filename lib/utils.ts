import type { LocalizedLabel, NeoDBItem } from "./types";

// 中文标题优先级：简体优先，繁体靠后
const ZH_PRIORITY = [
  "zh-cn",
  "zh-hans",
  "zh-sg",
  "zh",
  "zh-hant",
  "zh-tw",
  "zh-hk",
];

/** 按优先级取第一个中文标签 */
export function pickZhLabel(labels?: LocalizedLabel[]): string | null {
  if (!labels) return null;
  for (const lang of ZH_PRIORITY) {
    const hit = labels.find((t) => t.lang.toLowerCase() === lang);
    if (hit?.text?.trim()) return hit.text.trim();
  }
  return null;
}

/** 优先返回简体中文标题，其次是 NeoDB 显示标题 */
export function pickTitle(item: NeoDBItem): string {
  return (
    pickZhLabel(item.localized_title) ||
    item.display_title ||
    item.title ||
    item.orig_title ||
    "未命名作品"
  );
}

/** 返回"原名"（与显示标题不同的原始标题） */
export function pickOriginalTitle(item: NeoDBItem): string | null {
  const current = pickTitle(item);
  if (item.orig_title && item.orig_title !== current) {
    return item.orig_title;
  }
  return null;
}

/** 列出全部中文译名（去重、按优先级排序），用于详情页展示 */
export function listZhTitles(item: NeoDBItem): string[] {
  const labels = item.localized_title ?? [];
  const extraLangs = [
    ...new Set(
      labels
        .map((t) => t.lang.toLowerCase())
        .filter((l) => l.startsWith("zh") && !ZH_PRIORITY.includes(l)),
    ),
  ];
  const langs = [...ZH_PRIORITY, ...extraLangs];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const lang of langs) {
    for (const t of labels) {
      const text = t.text.trim();
      if (t.lang.toLowerCase() === lang && text && !seen.has(text)) {
        seen.add(text);
        out.push(text);
      }
    }
  }
  return out;
}

/** 优先简体中文简介，其次英文简介 */
export function pickDescription(item: NeoDBItem): string {
  return (
    pickZhLabel(item.localized_description) ||
    item.brief ||
    item.description ||
    ""
  );
}

/** 把 10 分制评分转成五星显示 */
export function stars(value: number | null | undefined, max = 5): string {
  if (value == null) return "☆☆☆☆☆";
  const normalized = Math.max(0, Math.min(max, value / 2));
  const full = Math.floor(normalized);
  const half = normalized - full >= 0.5 ? 1 : 0;
  return (
    "★".repeat(full) +
    (half ? "½" : "") +
    "☆".repeat(Math.max(0, max - full - half))
  );
}

export function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export function formatDate(iso?: string | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
    return d.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

/** 从外部资源链接中按域名取 URL */
export function externalLink(item: NeoDBItem, host: string): string | null {
  const url = (item.external_resources ?? [])
    .map((r) => r.url)
    .find((u) => {
      try {
        return new URL(u).hostname === host;
      } catch {
        return false;
      }
    });
  return url ?? null;
}

export function joinList(list?: string[] | null, max = 6): string {
  if (!list || list.length === 0) return "";
  return list.slice(0, max).join(" / ");
}

/** 把大数字格式化为中文单位（1234567 -> 123.5万） */
export function formatCount(n: number): string {
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}亿`;
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`;
  return n.toLocaleString();
}

/** 归一化标题用于模糊匹配（去空格标点、转小写） */
export function normalizeTitle(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

/** 两个标题是否近似匹配（相同，或较长者包含较短者且短标题足够长） */
export function titlesMatch(a: string, b: string): boolean {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const [short, long] = na.length <= nb.length ? [na, nb] : [nb, na];
  // 中文短标题（2-4 字）也允许包含匹配，英文保留 6 字符门槛
  const hasCjk = /[\u4e00-\u9fff]/.test(short) || /[\u4e00-\u9fff]/.test(long);
  const minLen = hasCjk ? 2 : 6;
  return short.length >= minLen && long.includes(short);
}

/** 判断条目是否与某个标题近似匹配（检查显示名/原名/中文译名） */
export function itemTitleMatches(item: NeoDBItem, title: string): boolean {
  const names = [
    item.display_title,
    item.title,
    item.orig_title,
    pickZhLabel(item.localized_title),
  ]
    .filter((n): n is string => !!n && n.length > 0);
  return names.some((n) => titlesMatch(n, title));
}

/** 更严格的"同一作品"判断：标题高度重合才算，避免混入不相关条目 */
export function sameWork(a: string, b: string): boolean {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const [short, long] = na.length <= nb.length ? [na, nb] : [nb, na];
  return short.length / long.length >= 0.5 && long.includes(short);
}

/** 精简条目：传给客户端组件前只保留卡片所需字段，避免序列化巨大对象 */
export function compactItem(item: NeoDBItem): NeoDBItem {
  return {
    uuid: item.uuid,
    display_title: item.display_title,
    title: item.title,
    orig_title: item.orig_title,
    year: item.year,
    rating: item.rating,
    rating_count: item.rating_count,
    brief: item.brief,
    cover_image_url: item.cover_image_url,
    category: item.category,
    type: item.type,
    localized_title: item.localized_title
      ?.filter((t) => t.lang.toLowerCase().startsWith("zh"))
      .slice(0, 3),
  };
}

/** 应用用户自定义的标题修正（key 可为条目 uuid 或规范化后的原名） */
export function applyTitleOverrides(
  item: NeoDBItem,
  overrides?: Record<string, string> | null,
): NeoDBItem {
  if (!overrides) return item;
  const byUuid = item.uuid ? overrides[item.uuid] : undefined;
  const byTitle = overrides[normalizeTitle(item.display_title ?? "")];
  const corrected = byUuid || byTitle;
  if (corrected) {
    item.display_title = corrected;
  }
  return item;
}

/** 按角色取人员：优先条目字段，字段为空时从 credits 兜底 */
export function pickByRole(
  item: NeoDBItem,
  role: string,
  field?: string[] | null,
  max = 8,
): string[] {
  const fromField = (field ?? []).filter(Boolean);
  if (fromField.length > 0) return fromField.slice(0, max);
  const fromCredits = (item.credits ?? [])
    .filter((c) => c.role === role && c.name)
    .map((c) => c.name);
  return [...new Set(fromCredits)].slice(0, max);
}

/** 主演列表：兼容字符串数组与对象数组，空时从 credits 兜底 */
export function pickActors(item: NeoDBItem, max = 8): string[] {
  const names = (item.actor ?? [])
    .map((a) => (typeof a === "string" ? a : a.name))
    .filter((n): n is string => !!n);
  if (names.length > 0) return names.slice(0, max);
  return pickByRole(item, "actor", [], max);
}

/** 去掉短评里"看过《xx》★★★"这类标记前缀，只保留真正的评论文字 */
export function cleanCommentText(raw: string): string {
  const m = raw.match(
    /^(?:看过|看過|想读|想看|想听|想玩|在读|在听|在玩|已读|已看|已听|已玩|弃读|弃听|弃玩|弃了|finished watching|finished reading|finished playing|currently watching|currently reading|currently playing|want to watch|want to read|want to play|wants to watch|wants to read|wants to play|rated|dropped|Rated|Watched|Reading|wants to (?:watch|read|play))[^\n]{0,80}?[🌕🌑⭐★☆✩]{2,}/,
  );
  return (m ? raw.slice(m[0].length) : raw).trim();
}

const MARK_RE =
  /^(看过|看過|想读|想看|想听|想玩|在读|在听|在玩|已读|已看|已听|已玩|弃读|弃听|弃玩|弃了|finished watching|finished reading|finished playing|currently watching|currently reading|currently playing|want to watch|want to read|want to play|wants to watch|wants to read|wants to play|rated|dropped|Rated|Watched|Reading|wants to (?:watch|read|play))/i;

/** 清洗后仍是"标记"类文本（没有真正评论内容） */
export function isMarkText(text: string): boolean {
  return MARK_RE.test(text);
}

/** 兼容"单个对象或数组"的接口字段：统一转成数组 */
export function asArray<T>(v: T | T[] | null | undefined): T[] {
  if (Array.isArray(v)) return v;
  if (v == null) return [];
  return [v];
}
