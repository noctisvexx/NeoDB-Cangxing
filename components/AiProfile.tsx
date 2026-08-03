"use client";

import { useState } from "react";

interface Profile {
  summary?: string;
  favoriteTypes?: string[];
  favoriteGenres?: string[];
  favoritePeriods?: string[];
  habits?: string[];
  personality?: string[];
  suggestion?: string;
}

export default function AiProfile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/profile", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "生成失败");
      setProfile(data.profile ?? {});
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mb-8">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h2 className="title-accent text-xl font-bold">AI 用户画像</h2>
        <button
          type="button"
          onClick={generate}
          disabled={busy}
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-amber-400 disabled:opacity-50"
        >
          {busy ? "AI 分析中…" : profile ? "重新生成" : "生成画像"}
        </button>
      </div>
      {error && <p className="mb-2 text-sm text-red-400">{error}</p>}
      <p className="mb-2 text-xs text-zinc-500">
        ⚠️ 以下内容由 AI 基于你的标记记录生成，仅供娱乐参考。
      </p>
      {profile && (
        <div className="rounded-2xl border border-white/5 bg-zinc-900/60 p-4">
          {profile.summary && (
            <p className="text-sm leading-relaxed text-zinc-200">
              {profile.summary}
            </p>
          )}
          <div className="mt-3 space-y-2 text-sm">
            {profile.favoriteTypes?.length ? (
              <p className="text-zinc-400">
                偏好类型：
                {profile.favoriteTypes.map((t) => (
                  <span
                    key={t}
                    className="ml-1.5 rounded-full bg-amber-500/10 px-2 py-0.5 text-amber-300"
                  >
                    {t}
                  </span>
                ))}
              </p>
            ) : null}
            {profile.favoriteGenres?.length ? (
              <p className="text-zinc-400">
                偏好题材：
                {profile.favoriteGenres.map((t) => (
                  <span
                    key={t}
                    className="ml-1.5 rounded-full bg-teal-500/10 px-2 py-0.5 text-teal-300"
                  >
                    {t}
                  </span>
                ))}
              </p>
            ) : null}
            {profile.favoritePeriods?.length ? (
              <p className="text-zinc-400">
                偏好年代：
                {profile.favoritePeriods.map((t) => (
                  <span
                    key={t}
                    className="ml-1.5 rounded-full bg-zinc-800 px-2 py-0.5"
                  >
                    {t}
                  </span>
                ))}
              </p>
            ) : null}
            {profile.habits?.length ? (
              <p className="text-zinc-400">
                观看习惯：
                {profile.habits.map((t) => (
                  <span
                    key={t}
                    className="ml-1.5 rounded-full bg-zinc-800 px-2 py-0.5"
                  >
                    {t}
                  </span>
                ))}
              </p>
            ) : null}
            {profile.personality?.length ? (
              <p className="text-zinc-400">
                性格特点：
                {profile.personality.map((t) => (
                  <span
                    key={t}
                    className="ml-1.5 rounded-full bg-zinc-800 px-2 py-0.5"
                  >
                    {t}
                  </span>
                ))}
              </p>
            ) : null}
            {profile.suggestion && (
              <p className="text-sm leading-relaxed text-zinc-300">
                💡 {profile.suggestion}
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
