import Link from "next/link";
import { Suspense } from "react";
import AiRecommend from "@/components/AiRecommend";
import StarTrail from "@/components/StarTrail";
import HomeSection, { SectionSkeleton } from "@/components/HomeSection";
import { aiApiKey, hasTmdb } from "@/lib/config";
import { loadSettings } from "@/lib/local-settings";
import {
  SECTION_META,
  orderSections,
} from "@/lib/home-data";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  // AI 配置不缓存，保证填完 Key 刷新立即生效
  const [aiConfigured, tmdbConfigured, settings] = await Promise.all([
    aiApiKey().then((k) => !!k),
    hasTmdb(),
    loadSettings(),
  ]);
  const savedOrder = settings.sectionOrder ?? [];
  const orderedKeys = orderSections(savedOrder);

  return (
    <div>
      <StarTrail />
      <section className="relative overflow-hidden border-b border-white/5">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% -20%, var(--accent-soft), transparent)",
          }}
        />
        <div className="relative mx-auto w-full max-w-5xl px-4 py-10 text-center">
          <p className="mb-2 text-sm tracking-widest text-amber-400/90">
            藏星 · CANGXING
          </p>
          <div className="relative mx-auto mt-4 w-fit px-12">
            <div
              className="hero-glow pointer-events-none absolute inset-0 -z-10 rounded-full"
              style={{
                background:
                  "radial-gradient(ellipse 60% 130% at 50% 50%, var(--accent-soft), transparent 72%)",
              }}
            />
            <span
              className="sparkle"
              style={{ left: "-30px", top: "50%", animationDelay: "0s" }}
            >
              <svg viewBox="0 0 24 24">
                <path d="M12 2c1.2 5.5 4.3 8.8 10 10-5.7 1.2-8.8 4.5-10 10-1.2-5.5-4.3-8.8-10-10 5.7-1.2 8.8-4.5 10-10Z" />
              </svg>
            </span>
            <span
              className="sparkle"
              style={{ right: "-36px", top: "8%", animationDelay: "0.8s" }}
            >
              <svg viewBox="0 0 24 24">
                <path d="M12 2c1.2 5.5 4.3 8.8 10 10-5.7 1.2-8.8 4.5-10 10-1.2-5.5-4.3-8.8-10-10 5.7-1.2 8.8-4.5 10-10Z" />
              </svg>
            </span>
            <span
              className="sparkle sparkle-sm"
              style={{ left: "-48px", bottom: "-4px", animationDelay: "1.5s" }}
            >
              <svg viewBox="0 0 24 24">
                <path d="M12 2c1.2 5.5 4.3 8.8 10 10-5.7 1.2-8.8 4.5-10 10-1.2-5.5-4.3-8.8-10-10 5.7-1.2 8.8-4.5 10-10Z" />
              </svg>
            </span>
            <span
              className="sparkle sparkle-sm"
              style={{ right: "-52px", bottom: "-10px", animationDelay: "2.1s" }}
            >
              <svg viewBox="0 0 24 24">
                <path d="M12 2c1.2 5.5 4.3 8.8 10 10-5.7 1.2-8.8 4.5-10 10-1.2-5.5-4.3-8.8-10-10 5.7-1.2 8.8-4.5 10-10Z" />
              </svg>
            </span>
            <span
              className="sparkle sparkle-xs"
              style={{ left: "14%", top: "-28px", animationDelay: "0.4s" }}
            >
              <svg viewBox="0 0 24 24">
                <path d="M12 2c1.2 5.5 4.3 8.8 10 10-5.7 1.2-8.8 4.5-10 10-1.2-5.5-4.3-8.8-10-10 5.7-1.2 8.8-4.5 10-10Z" />
              </svg>
            </span>
            <span
              className="sparkle sparkle-xs"
              style={{ right: "12%", top: "-32px", animationDelay: "1.1s" }}
            >
              <svg viewBox="0 0 24 24">
                <path d="M12 2c1.2 5.5 4.3 8.8 10 10-5.7 1.2-8.8 4.5-10 10-1.2-5.5-4.3-8.8-10-10 5.7-1.2 8.8-4.5 10-10Z" />
              </svg>
            </span>
            <h1 className="hero-title text-3xl font-bold sm:text-4xl">
              发现正在闪耀的作品
            </h1>
          </div>
          <p className="mx-auto mt-3 max-w-xl text-sm text-zinc-400">
            探索电影、剧集、游戏、音乐与播客的最新趋势。
          </p>
        </div>
      </section>

      <AiRecommend aiConfigured={aiConfigured} />

      <form
        action="/search"
        method="GET"
        className="mx-auto mt-6 flex w-full max-w-5xl gap-2 px-4"
      >
        <input
          name="q"
          placeholder="搜索电影、剧集、动漫、书籍、游戏、播客…"
          className="w-full rounded-full border border-zinc-700/70 bg-zinc-900/70 px-4 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-amber-500 focus:outline-none"
        />
        <button
          type="submit"
          className="shrink-0 rounded-full bg-amber-500 px-5 py-2 text-sm font-medium text-zinc-950 transition hover:bg-amber-400"
        >
          搜索
        </button>
      </form>

      {/* 栏目流式输出：每个栏目数据就绪后立即渲染，先到先显示 */}
      {orderedKeys.map((k) => (
        <Suspense key={k} fallback={<SectionSkeleton title={SECTION_META[k].title} />}>
          <HomeSection k={k} />
        </Suspense>
      ))}

      {!tmdbConfigured && (
        <div className="mx-auto w-full max-w-5xl px-4 py-5">
          <p className="rounded-xl border border-dashed border-zinc-800 px-4 py-3 text-xs text-zinc-500">
            🎬 配置 TMDB Key 后，电影与剧集栏目会多出 TMDB 数据源选项；动漫数据来自
            Bangumi 开放 API。
          </p>
        </div>
      )}
    </div>
  );
}
