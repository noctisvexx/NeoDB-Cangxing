import type { ShelfType } from "./types";

export interface CategoryMeta {
  label: string;
  emoji: string;
  description?: string;
}

export const CATEGORY_META: Record<string, CategoryMeta> = {
  movie: { label: "电影", emoji: "🎬", description: "热门电影" },
  tv: { label: "剧集", emoji: "📺", description: "热门剧集" },
  anime: { label: "动漫", emoji: "🌸", description: "热门日本动画" },
  book: { label: "书籍", emoji: "📚", description: "热门书籍" },
  game: { label: "游戏", emoji: "🎮", description: "热门游戏" },
  music: { label: "音乐", emoji: "🎵", description: "热门音乐" },
  podcast: { label: "播客", emoji: "🎙️", description: "热门播客" },
  performance: { label: "演出", emoji: "🎭", description: "热门演出" },
};

export const SEARCH_CATEGORIES = [
  "all",
  "movie",
  "tv",
  "anime",
  "book",
  "game",
  "music",
  "podcast",
  "performance",
] as const;

export const SHELF_LABELS: Record<ShelfType, string> = {
  wishlist: "想看",
  progress: "在看",
  complete: "已看",
  dropped: "弃了",
};

export const SHELF_OPTIONS: { value: ShelfType; label: string; hint: string }[] = [
  { value: "wishlist", label: "想看", hint: "加入想看列表" },
  { value: "progress", label: "在看", hint: "正在观看 / 阅读" },
  { value: "complete", label: "已看", hint: "标记为已看完" },
  { value: "dropped", label: "弃了", hint: "放弃的作品" },
];

// 不同类别使用不同的动作词：电影/剧集=看，书籍=读，音乐/播客=听，游戏=玩
const SHELF_WORDS: Record<string, Record<ShelfType, string>> = {
  movie: { wishlist: "想看", progress: "在看", complete: "已看", dropped: "弃了" },
  tv: { wishlist: "想看", progress: "在看", complete: "已看", dropped: "弃了" },
  book: { wishlist: "想读", progress: "在读", complete: "已读", dropped: "弃读" },
  music: { wishlist: "想听", progress: "在听", complete: "已听", dropped: "弃听" },
  podcast: { wishlist: "想听", progress: "在听", complete: "已听", dropped: "弃听" },
  game: { wishlist: "想玩", progress: "在玩", complete: "已玩", dropped: "弃玩" },
};

export function shelfLabelsFor(category?: string): Record<ShelfType, string> {
  return SHELF_WORDS[category ?? ""] ?? SHELF_LABELS;
}
