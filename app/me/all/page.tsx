import Link from "next/link";
import CoverCard from "@/components/CoverCard";
import { neoDbToken } from "@/lib/config";
import { getShelf } from "@/lib/neodb";
import { CATEGORY_META } from "@/lib/categories";
import type { NeoDBMark } from "@/lib/types";
import { compactItem } from "@/lib/utils";

export const dynamic = "force-dynamic";

const KIND_TITLES: Record<string, string> = {
  favorites: "最爱榜单",
  disliked: "最讨厌榜单",
  wishlist: "想看",
  complete: "已看全部",
  progress: "在看",
  movie: "最近电影",
  tv: "最近剧集",
  book: "最近书籍",
  game: "最近游戏",
  music: "最近音乐",
  podcast: "最近播客",
};

async function fetchAllShelf(
  type: "complete" | "wishlist" | "progress",
): Promise<NeoDBMark[]> {
  // 并行拉取前 10 页，避免逐页串行等待
  const pages = await Promise.all(
    Array.from({ length: 10 }, (_, i) =>
      getShelf(type, i + 1, 50).catch(() => null),
    ),
  );
  const seen = new Set<string>();
  const out: NeoDBMark[] = [];
  for (const res of pages) {
    for (const m of res?.data ?? []) {
      if (!seen.has(m.item.uuid)) {
        seen.add(m.item.uuid);
        out.push(m);
      }
    }
  }
  return out;
}

export default async function AllItemsPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  const { kind = "favorites" } = await searchParams;
  const token = await neoDbToken();

  if (!token) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-10 text-sm text-zinc-400">
        请先在「我的」页连接 NeoDB 账号。
      </div>
    );
  }

  const [wishlist, complete] = await Promise.all([
    fetchAllShelf("wishlist"),
    fetchAllShelf("complete"),
  ]);

  let marks: NeoDBMark[] = [];
  if (kind === "progress") {
    marks = (await fetchAllShelf("progress")).sort((a, b) =>
      b.created_time.localeCompare(a.created_time),
    );
  } else if (kind === "complete") {
    marks = complete.sort((a, b) =>
      b.created_time.localeCompare(a.created_time),
    );
  } else if (kind === "wishlist") {
    marks = wishlist;
  } else if (kind === "favorites") {
    marks = complete
      .filter((m) => m.rating_grade != null && m.rating_grade >= 9)
      .sort((a, b) => (b.rating_grade ?? 0) - (a.rating_grade ?? 0));
  } else if (kind === "disliked") {
    marks = complete
      .filter((m) => m.rating_grade != null && m.rating_grade <= 4)
      .sort((a, b) => (a.rating_grade ?? 0) - (b.rating_grade ?? 0));
  } else {
    marks = complete
      .filter((m) => (m.item.category ?? "other") === kind)
      .sort((a, b) => b.created_time.localeCompare(a.created_time));
  }

  const title = KIND_TITLES[kind] ?? "全部条目";
  const catLabel = CATEGORY_META[kind]?.label;
  const compactMarks = marks.map((m) => ({
    ...m,
    item: compactItem(m.item),
  }));

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="title-accent text-2xl font-bold">
          {title}
          {catLabel ? ` · ${catLabel}` : ""}
          <span className="ml-2 text-sm font-normal text-zinc-500">
            共 {marks.length} 个
          </span>
        </h1>
        <Link
          href="/me"
          className="text-sm text-amber-400 hover:underline"
        >
          ← 返回我的
        </Link>
      </div>
      {marks.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
            {compactMarks.map((m) => (
            <CoverCard key={m.item.uuid} item={m.item} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-zinc-800 px-4 py-10 text-center text-sm text-zinc-500">
          这个列表还是空的。
        </div>
      )}
    </div>
  );
}
