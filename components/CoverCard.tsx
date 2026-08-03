"use client";

import Link from "next/link";
import type { NeoDBItem } from "@/lib/types";
import { pickTitle, stars } from "@/lib/utils";

export default function CoverCard({ item }: { item: NeoDBItem }) {
  const title = pickTitle(item);
  return (
    <Link
      href={`/item/${item.uuid}`}
      className="group flex flex-col gap-1.5 rounded-lg border border-white/5 bg-zinc-900/60 p-2 transition hover:-translate-y-0.5 hover:border-amber-400/25 hover:bg-zinc-800/70"
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-md bg-zinc-800/80">
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
        {item.year != null && (
          <span className="absolute left-1 top-1 rounded bg-black/60 px-1 py-0.5 text-[10px] text-zinc-100">
            {item.year}
          </span>
        )}
      </div>
      <div className="flex h-12 flex-col justify-start">
        <h3 className="line-clamp-2 text-sm font-medium leading-snug text-zinc-100">
          {title}
        </h3>
      </div>
      <div className="flex h-5 items-baseline gap-1 text-xs text-amber-400">
        {item.rating != null ? (
          <>
            <span className="tracking-tight">{stars(item.rating)}</span>
            <span className="font-semibold">{item.rating.toFixed(1)}</span>
          </>
        ) : (
          <span className="text-zinc-500">暂无评分</span>
        )}
      </div>
    </Link>
  );
}
