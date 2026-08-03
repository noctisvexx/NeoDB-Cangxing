"use client";

import { useState } from "react";
import { shelfLabelsFor } from "@/lib/categories";
import type { ShelfType } from "@/lib/types";

export interface InitialMark {
  shelfType: ShelfType | null;
  ratingGrade: number | null;
  commentText?: string | null;
}

export interface LocalItemInfo {
  id: string;
  title: string;
  category?: string;
  cover?: string;
  year?: number;
  sourceUrl?: string;
}

export interface InitialLocalMark {
  shelf?: ShelfType | null;
  rating?: number | null;
  comment?: string | null;
}

export default function AddToShelf({
  itemUuid,
  initialMark,
  category,
  neodbEnabled = true,
  localItem,
  initialLocalMark,
}: {
  itemUuid: string;
  initialMark: InitialMark;
  category?: string;
  neodbEnabled?: boolean;
  localItem?: LocalItemInfo;
  initialLocalMark?: InitialLocalMark | null;
}) {
  const labels = shelfLabelsFor(category);
  const isLocal = !neodbEnabled;
  const [shelfType, setShelfType] = useState<ShelfType>(
    isLocal
      ? (initialLocalMark?.shelf ?? "wishlist")
      : (initialMark.shelfType ?? "wishlist"),
  );
  const [rating, setRating] = useState<number>(
    isLocal
      ? (initialLocalMark?.rating ?? 8)
      : (initialMark.ratingGrade ?? 8),
  );
  const [comment, setComment] = useState(
    isLocal
      ? (initialLocalMark?.comment ?? "")
      : (initialMark.commentText ?? ""),
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(nextType: ShelfType) {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      if (isLocal) {
        if (!localItem?.id) throw new Error("缺少条目信息，无法保存到本地档案");
        const res = await fetch("/api/local/marks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: localItem.id,
            title: localItem.title,
            category: category || localItem.category,
            cover: localItem.cover,
            year: localItem.year,
            shelf: nextType,
            rating: nextType === "complete" ? rating : undefined,
            comment: comment.trim() || undefined,
            sourceUrl: localItem.sourceUrl,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "保存失败");
        setShelfType(nextType);
        setMessage(`已保存到本地档案「${labels[nextType]}」✓（未同步 NeoDB）`);
        return;
      }
      const res = await fetch("/api/shelf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemUuid,
          shelfType: nextType,
          ratingGrade: nextType === "complete" ? rating : null,
          commentText: comment.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "操作失败，请稍后重试");
      setShelfType(nextType);
      setMessage(`已加入「${labels[nextType]}」列表 ✓`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      if (isLocal) {
        if (!localItem?.id) throw new Error("缺少条目信息");
        const res = await fetch(
          `/api/local/marks?id=${encodeURIComponent(localItem.id)}`,
          { method: "DELETE" },
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "移除失败");
        setShelfType("wishlist");
        setMessage("已从本地档案移除");
        return;
      }
      const res = await fetch(
        `/api/shelf?itemUuid=${encodeURIComponent(itemUuid)}`,
        { method: "DELETE" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "移除失败");
      setShelfType("wishlist");
      setMessage("已从书架移除");
    } catch (e) {
      setError(e instanceof Error ? e.message : "移除失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
      {isLocal && (
        <p className="mb-3 rounded-lg bg-zinc-800/70 px-3 py-2 text-xs text-zinc-400">
          本地档案模式：不连接 NeoDB 也能记录，数据保存在本机，可随加密备份一起同步。
        </p>
      )}
      <div className="mb-3 flex flex-wrap gap-2">
        {(Object.keys(labels) as ShelfType[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setShelfType(t)}
            disabled={busy}
            className={`rounded-full px-3 py-1.5 text-sm transition disabled:opacity-50 ${
              shelfType === t
                ? "bg-amber-500/90 font-medium text-zinc-950"
                : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
            }`}
          >
            {labels[t]}
          </button>
        ))}
      </div>

      {shelfType === "complete" && (
        <label className="mb-3 block text-sm">
          <span className="mb-1 block text-zinc-400">我的评分（1–10）</span>
          <select
            value={rating}
            onChange={(e) => setRating(Number(e.target.value))}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100"
          >
            {Array.from({ length: 10 }, (_, i) => 10 - i).map((n) => (
              <option key={n} value={n}>
                {n} 分
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="mb-3 block text-sm">
        <span className="mb-1 block text-zinc-400">短评（可选）</span>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={2}
          placeholder="看完想说的话…"
          className="w-full resize-none rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-amber-500 focus:outline-none"
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => submit(shelfType)}
          disabled={busy}
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-amber-400 disabled:opacity-50"
        >
          {busy
            ? "保存中…"
            : isLocal
              ? "保存到本地档案"
              : "保存到 NeoDB"}
        </button>
        {(isLocal ? initialLocalMark?.shelf : initialMark.shelfType) && (
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:border-red-500/60 hover:text-red-300 disabled:opacity-50"
          >
            移除书架标记
          </button>
        )}
      </div>

      {message && <p className="mt-3 text-sm text-emerald-400">{message}</p>}
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      {!isLocal &&
        initialMark.shelfType &&
        (initialMark.ratingGrade != null ||
          (initialMark.commentText ?? "").trim()) && (
          <div className="mt-3 rounded-lg border border-amber-400/20 bg-amber-500/5 p-3">
            <p className="text-xs text-zinc-500">
              我的标记：{labels[initialMark.shelfType]}
            </p>
            {initialMark.ratingGrade != null && (
              <p className="mt-1 text-sm text-amber-400">
                ★ 我的评分：{initialMark.ratingGrade}/10
              </p>
            )}
            {(initialMark.commentText ?? "").trim() && (
              <p className="mt-1 text-sm leading-relaxed text-zinc-300">
                「{initialMark.commentText}」
              </p>
            )}
          </div>
        )}
      {isLocal &&
        initialLocalMark?.shelf &&
        (initialLocalMark.rating != null ||
          (initialLocalMark.comment ?? "").trim()) && (
          <div className="mt-3 rounded-lg border border-amber-400/20 bg-amber-500/5 p-3">
            <p className="text-xs text-zinc-500">
              我的本地标记：{labels[initialLocalMark.shelf]}
            </p>
            {initialLocalMark.rating != null && (
              <p className="mt-1 text-sm text-amber-400">
                ★ 我的评分：{initialLocalMark.rating}/10
              </p>
            )}
            {(initialLocalMark.comment ?? "").trim() && (
              <p className="mt-1 text-sm leading-relaxed text-zinc-300">
                「{initialLocalMark.comment}」
              </p>
            )}
          </div>
        )}
    </div>
  );
}
