"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ItemCard from "@/components/ItemCard";
import type { NeoDBItem } from "@/lib/types";

interface RecommendItem {
  title: string;
  type?: string;
  reason?: string;
  uuid?: string;
  cover?: string | null;
}

const TYPE_OPTIONS = ["电影", "剧集", "动漫", "书籍", "游戏", "播客"];

const CAT: Record<string, string> = {
  电影: "movie",
  剧集: "tv",
  动漫: "tv",
  书籍: "book",
  游戏: "game",
  播客: "podcast",
};

export default function AiRecommend({
  aiConfigured,
}: {
  aiConfigured: boolean;
}) {
  const [items, setItems] = useState<RecommendItem[] | null>(null);
  const [types, setTypes] = useState<string[]>([]);
  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("shibei-ai-items-v2");
      if (raw) setItems(JSON.parse(raw));
    } catch {
      // 忽略
    }
  }, []);

  function toggleType(t: string) {
    setTypes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
    );
  }

  async function recommend() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ types }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "推荐失败");
      const list = data.items ?? [];
      setItems(list);
      setOpen(true);
      try {
        sessionStorage.setItem("shibei-ai-items-v2", JSON.stringify(list));
      } catch {
        // 忽略
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "推荐失败");
    } finally {
      setBusy(false);
    }
  }

  function clearAll() {
    setItems(null);
    setError(null);
    try {
      sessionStorage.removeItem("shibei-ai-items-v2");
    } catch {
      // 忽略
    }
  }

  if (!aiConfigured) {
    return (
      <section className="mx-auto w-full max-w-5xl px-4 pt-6">
        <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 px-4 py-3 text-sm text-zinc-500">
          🤖 想让 AI 根据你的收藏记录寻找下一颗星？在{" "}
          <Link href="/settings" className="text-amber-400 hover:underline">
            设置页
          </Link>{" "}
          填入你自己的 AI API Key（OpenAI / DeepSeek / 兼容接口）即可。
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-5xl px-4 pt-6">
      <div className="rounded-xl border border-teal-500/20 bg-teal-500/5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl" aria-hidden="true">
              🤖
            </span>
            <button
              type="button"
              onClick={recommend}
              disabled={busy}
              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-amber-400 disabled:opacity-50"
            >
              {busy ? "AI 思考中…" : "寻找下一颗星"}
            </button>
          </div>
          {items && items.length > 0 && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 transition hover:border-amber-400/50 hover:text-amber-300"
              >
                {open ? "收起" : "展开"}
              </button>
              <button
                type="button"
                onClick={clearAll}
                className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 transition hover:border-red-500/50 hover:text-red-300"
              >
                清空
              </button>
            </div>
          )}
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <span className="text-sm text-zinc-500">推荐类型：</span>
          {TYPE_OPTIONS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => toggleType(t)}
              className={`rounded-full border px-2.5 py-1 text-sm transition ${
                types.includes(t)
                  ? "border-amber-400/60 bg-amber-500/10 text-amber-300"
                  : "border-zinc-700 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {t}
            </button>
          ))}
          <span className="text-xs text-zinc-600">（不选则全部）</span>
        </div>
        {error && <p className="mt-2.5 text-sm text-red-400">{error}</p>}
        {!open && items && items.length > 0 && (
          <p className="mt-2 text-sm text-zinc-500">
            已有 {items.length} 条推荐，点「展开」查看。
          </p>
        )}
        {open && items && items.length > 0 && (
          <ul className="mt-3 space-y-2">
            {items.map((it, i) => {
              const card: NeoDBItem | null = it.uuid
                ? {
                    uuid: it.uuid,
                    display_title: it.title,
                    title: it.title,
                    cover_image_url: it.cover ?? undefined,
                    category: CAT[it.type ?? ""],
                  }
                : null;
              return (
                <li
                  key={i}
                  className="rounded-xl border border-white/5 bg-zinc-900/40 p-2.5"
                >
                  {card ? (
                    <ItemCard item={card} />
                  ) : (
                    <Link
                      href={`/search?q=${encodeURIComponent(it.title)}`}
                      className="block px-1 text-sm font-medium text-amber-400 hover:underline"
                    >
                      {it.title} → 在 NeoDB 搜索
                    </Link>
                  )}
                  {it.reason && (
                    <p className="mt-1.5 px-1 text-sm leading-relaxed text-zinc-400">
                      {it.reason}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {items && items.length === 0 && !error && (
          <p className="mt-2.5 text-sm text-zinc-500">
            点「寻找下一颗星」开始探索。
          </p>
        )}
      </div>
    </section>
  );
}
