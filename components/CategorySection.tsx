"use client";

import { useMemo, useState } from "react";
import type { NeoDBItem } from "@/lib/types";
import ItemCard from "./ItemCard";

type SortKey = "default" | "rating" | "count";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "default", label: "热度" },
  { key: "rating", label: "评分" },
  { key: "count", label: "人数" },
];

export default function CategorySection({
  title,
  emoji,
  items,
  note,
  source,
}: {
  title: string;
  emoji: string;
  items: NeoDBItem[];
  note?: string;
  source?: string;
}) {
  const [sort, setSort] = useState<SortKey>("default");

  const sorted = useMemo(() => {
    const list = [...items];
    if (sort === "rating") {
      list.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    }
    if (sort === "count") {
      list.sort((a, b) => (b.rating_count ?? 0) - (a.rating_count ?? 0));
    }
    return list;
  }, [items, sort]);

  if (items.length === 0) return null;

  const hasRating = items.some((i) => i.rating != null);
  const hasCount = items.some((i) => (i.rating_count ?? 0) > 0);
  const availableSorts = SORTS.filter(
    (s) => s.key === "default" || (s.key === "rating" ? hasRating : hasCount),
  );

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="title-accent text-xl font-bold">
            {title}
          </h2>
          {source && (
            <span className="rounded-full bg-teal-500/10 px-2 py-0.5 text-[11px] text-teal-300/90">
              {source}
            </span>
          )}
        </div>
        {note && <span className="order-3 w-full text-xs text-zinc-500 md:order-none md:w-auto">{note}</span>}
        {availableSorts.length > 1 && (
          <div className="flex gap-1 rounded-full bg-zinc-900 p-1 text-xs">
            {availableSorts.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setSort(s.key)}
                className={`rounded-full px-2.5 py-1 transition ${
                  sort === s.key
                    ? "bg-zinc-700 text-white"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {sorted.slice(0, 12).map((item) => (
          <ItemCard key={item.uuid} item={item} />
        ))}
      </div>
    </section>
  );
}
