"use client";

import { useState } from "react";

export default function AiVerdict({
  title,
  type,
  ratings,
}: {
  title: string;
  type?: string;
  ratings: { platform?: string; score?: number | null }[];
}) {
  const [verdict, setVerdict] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ask() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/verdict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, type, ratings }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "分析失败");
      setVerdict(data.verdict ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "分析失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 rounded-lg bg-zinc-900/40 px-3 py-2">
      <button
        type="button"
        onClick={ask}
        disabled={busy}
        className="text-sm font-medium text-amber-400 transition hover:text-amber-300 disabled:opacity-50"
      >
        {busy ? "AI 分析中…" : verdict ? "🤖 重新分析评分" : "🤖 AI 评分建议：值得看吗？"}
      </button>
      {error && <p className="mt-1 text-sm text-red-400">{error}</p>}
      {verdict && (
        <p className="mt-1 text-sm leading-relaxed text-zinc-300">{verdict}</p>
      )}
    </div>
  );
}
