import Link from "next/link";
import ItemCard from "@/components/ItemCard";
import { hasTmdb } from "@/lib/config";
import { searchCatalog } from "@/lib/neodb";
import { SEARCH_CATEGORIES, CATEGORY_META } from "@/lib/categories";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const { q, category } = await searchParams;
  const query = (q ?? "").trim();
  const cat = category && category !== "all" ? category : "all";
  // 动漫在 NeoDB 中没有单独分类，映射到剧集
  const neodbCategory = cat === "anime" ? "tv" : cat === "all" ? undefined : cat;

  const results = query
    ? await searchCatalog(query, neodbCategory).catch(() => null)
    : null;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <h1 className="title-accent mb-4 text-2xl font-bold">搜索</h1>
      <form
        action="/search"
        method="GET"
        className="mb-6 flex flex-wrap items-center gap-2"
      >
        <input
          name="q"
          defaultValue={query}
          placeholder="输入片名 / 书名 / 游戏名…"
          className="w-full max-w-md rounded-full border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-amber-500 focus:outline-none"
        />
        <select
          name="category"
          defaultValue={cat}
          className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 focus:border-amber-500 focus:outline-none"
        >
          {SEARCH_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c === "all" ? "全部类型" : `${CATEGORY_META[c].emoji} ${CATEGORY_META[c].label}`}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-full bg-amber-500 px-5 py-2.5 text-sm font-medium text-zinc-950 transition hover:bg-amber-400"
        >
          搜索
        </button>
      </form>

      {query && results && (
        <p className="mb-4 text-sm text-zinc-500">
          找到 {results.count} 个结果
          {cat === "anime" && "（动漫搜索使用剧集分类）"}
        </p>
      )}

      {query && !results && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-8 text-center text-sm text-zinc-500">
          搜索失败：NeoDB 暂时无法访问，或条目不存在。
        </div>
      )}

      {query && results && results.data.length > 0 && (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {results.data.map((item) => (
            <ItemCard key={item.uuid} item={item} />
          ))}
        </div>
      )}

      {query && results && results.data.length === 0 && (
        <div className="rounded-xl border border-dashed border-zinc-800 px-4 py-8 text-center text-sm text-zinc-500">
          没有找到「{query}」相关条目。
        </div>
      )}

      {!query && (
        <div className="rounded-xl border border-dashed border-zinc-800 px-4 py-8 text-center text-sm text-zinc-500">
          输入关键词开始搜索，或返回
          <Link href="/" className="mx-1 text-amber-400 hover:underline">
            发现页
          </Link>
          浏览热门。
        </div>
      )}
    </div>
  );
}
