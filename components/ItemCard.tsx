"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { NeoDBItem } from "@/lib/types";
import { formatCount, pickTitle, stars } from "@/lib/utils";

// 预热请求全局限流：最多同时 2 个，其余排队，避免首页一次打太多上游接口
const WARM_LIMIT = 2;
const warmedSet = new Set<string>();
const warmQueue: string[] = [];
let warmActive = 0;

function fireWarm(uuid: string) {
  if (warmActive >= WARM_LIMIT) {
    warmQueue.push(uuid);
    return;
  }
  warmActive++;
  fetch(`/api/item/warm?uuid=${encodeURIComponent(uuid)}`)
    .catch(() => {
      // 预热失败不影响正常点击
    })
    .finally(() => {
      warmActive--;
      const next = warmQueue.shift();
      if (next) fireWarm(next);
    });
}

export default function ItemCard({
  item,
  square,
}: {
  item: NeoDBItem;
  square?: boolean;
}) {
  const title = pickTitle(item);
  const router = useRouter();
  const linkRef = useRef<HTMLAnchorElement | null>(null);
  const hoverTimer = useRef<number | null>(null);
  const schedulePrefetchRef = useRef<() => void>(() => {});
  const href = `/item/${item.uuid}`;

  // 悬停 / 进入视口 150ms 后后台预热：预取路由外壳 + 提前拉取数据写入本地缓存
  function schedulePrefetch() {
    if (hoverTimer.current !== null) {
      window.clearTimeout(hoverTimer.current);
    }
    hoverTimer.current = window.setTimeout(() => {
      if (warmedSet.has(item.uuid)) return;
      warmedSet.add(item.uuid);
      router.prefetch(href);
      fireWarm(item.uuid);
    }, 150);
  }
  function cancelPrefetch() {
    if (hoverTimer.current !== null) {
      window.clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
  }

  useEffect(() => {
    // 保持 ref 指向最新闭包（观察器在 effect 里调用）
    schedulePrefetchRef.current = schedulePrefetch;
  });

  useEffect(() => {
    // 触屏设备没有悬停，只靠视口预热
    const el = linkRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) schedulePrefetchRef.current();
        }
      },
      { rootMargin: "300px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <Link
      href={href}
      ref={linkRef}
      onMouseEnter={schedulePrefetch}
      onMouseLeave={cancelPrefetch}
      className="group flex items-start gap-4 rounded-xl border border-white/5 bg-zinc-900/60 p-3.5 transition hover:-translate-y-0.5 hover:border-amber-400/25 hover:bg-zinc-800/70 hover:shadow-lg hover:shadow-black/10"
    >
      <div
        className={`relative w-20 shrink-0 overflow-hidden rounded-md bg-zinc-800/80 ${
          square ? "aspect-square" : "aspect-[2/3]"
        }`}
      >
        {item.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.cover_image_url}
            alt={title}
            loading="lazy"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-2xl">
            📖
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-2 text-lg font-medium leading-snug text-zinc-100">
          {title}
        </h3>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-zinc-500">
          {item.year != null && <span>{item.year}</span>}
          {item.rating != null && (
            <>
              <span className="text-amber-400">{stars(item.rating)}</span>
              <span className="font-semibold text-amber-400">
                {item.rating.toFixed(1)}
              </span>
            </>
          )}
          {!!(item.rating_count ?? 0) && (
            <span>{formatCount(item.rating_count ?? 0)} 人评</span>
          )}
        </div>
        {item.brief && (
          <p className="mt-1.5 line-clamp-3 text-sm leading-snug text-zinc-500">
            {item.brief}
          </p>
        )}
      </div>
    </Link>
  );
}
