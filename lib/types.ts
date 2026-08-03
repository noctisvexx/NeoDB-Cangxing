// NeoDB 与 TMDB 相关的共享类型

export type NeoDBCategory =
  | "book"
  | "movie"
  | "tv"
  | "music"
  | "game"
  | "podcast"
  | "performance";

export type ShelfType = "wishlist" | "progress" | "complete" | "dropped";

export interface LocalizedLabel {
  lang: string;
  text: string;
}

export interface NeoDBItem {
  type?: string;
  title?: string;
  display_title?: string;
  orig_title?: string;
  brief?: string;
  description?: string;
  localized_title?: LocalizedLabel[];
  localized_description?: LocalizedLabel[];
  cover_image_url?: string;
  rating?: number | null;
  rating_count?: number;
  rating_distribution?: number[];
  tags?: string[] | null;
  uuid: string;
  id?: string;
  url?: string;
  api_url?: string;
  category?: string;
  parent_uuid?: string | null;
  year?: number | null;
  director?: string[];
  playwright?: string[];
  actor?: { name: string; role?: string }[];
  genre?: string[];
  language?: string[];
  area?: string[];
  official_site?: string;
  imdb?: string;
  external_resources?: { url: string }[];
  credits?: { role: string; name: string; character_name?: string; person_url?: string | null }[];
}

export interface NeoDBMark {
  shelf_type: ShelfType;
  visibility: number;
  post_id?: string | null;
  item: NeoDBItem;
  created_time: string;
  comment_text?: string | null;
  rating_grade?: number | null;
  tags?: string[];
}

export interface NeoDBReview {
  id?: string;
  href: string;
  name: string;
  type?: string;
  content: string;
  published?: string;
  attributedTo?: string;
  mediaType?: string;
}

export interface NeoDBPost {
  id: string;
  uri?: string;
  created_at?: string;
  content?: string;
  text?: string;
  url?: string;
  favourites_count?: number;
  account?: {
    username?: string;
    acct?: string;
    display_name?: string;
    avatar?: string;
    url?: string;
  };
  ext_neodb?: {
    relatedWith?: NeoDBReview[];
    tag?: { name?: string; href?: string; image?: string }[];
  };
}

export interface Paged<T> {
  data: T[];
  pages: number;
  count: number;
}

export interface NeoDBUser {
  display_name?: string;
  username?: string;
  acct?: string;
  url?: string;
  avatar?: string;
  [key: string]: unknown;
}
