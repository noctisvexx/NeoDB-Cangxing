"use client";

import Link from "next/link";
import type { NeoDBItem } from "@/lib/types";
import { formatCount, pickTitle, stars } from "@/lib/utils";

export default function ItemCard({
  item,
  source,
  square,
}: {
  item: NeoDBItem;
  source?: string;
  square?: boolean;
}) {
  const title = pickTitle(item);
  return (
    <Link
      href={`/item/${item.uuid}`}
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
        {source && (
          <span className="absolute left-1 top-1 max-w-[52px] truncate rounded bg-black/60 px-1 py-0.5 text-[10px] text-zinc-100">
            {source}
          </span>
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
