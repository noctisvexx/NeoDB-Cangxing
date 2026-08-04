"use client";

import { useMemo, useState } from "react";
import type { NeoDBItem } from "@/lib/types";
import ItemCard from "./ItemCard";

export interface SourceOption {
  label: string;
  items: NeoDBItem[];
  note?: string;
  square?: boolean;
  /** 右侧切换为数据源标签（如 热度/评分/人数），替代客户端排序 */
  tabs?: { label: string; items: NeoDBItem[] }[];
}

type SortKey = "default" | "rating" | "count";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "default", label: "热度" },
  { key: "rating", label: "评分" },
  { key: "count", label: "人数" },
];

export default function SourceSection({
  title,
  options,
}: {
  title: string;
  options: SourceOption[];
}) {
  const initialActive = options.findIndex((o) => o.items.length > 0);
  const [activeIdx, setActiveIdx] = useState(
    initialActive >= 0 ? initialActive : 0,
  );
  const [tabIdx, setTabIdx] = useState(0);
  const [sort, setSort] = useState<SortKey>("default");
  const active = options[activeIdx] ?? options[0];
  const usingTabs = !!active?.tabs && active.tabs.length > 0;

  const sorted = useMemo(() => {
    if (usingTabs) {
      return active?.tabs?.[tabIdx]?.items ?? [];
    }
    const list = [...(active?.items ?? [])];
    if (sort === "rating") {
      list.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    }
    if (sort === "count") {
      list.sort((a, b) => (b.rating_count ?? 0) - (a.rating_count ?? 0));
    }
    return list;
  }, [active, tabIdx, sort, usingTabs]);

  const hasRating = sorted.some((i) => i.rating != null);
  const hasCount = sorted.some((i) => (i.rating_count ?? 0) > 0);
  const availableSorts = SORTS.filter(
    (s) => s.key === "default" || (s.key === "rating" ? hasRating : hasCount),
  );

  if (options.length === 1 && options[0].items.length === 0) return null;

  function switchOption(i: number) {
    setActiveIdx(i);
    setTabIdx(0);
    setSort("default");
  }

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="title-accent text-xl font-bold">{title}</h2>
        <div className="flex flex-wrap items-center gap-2">
          {options.length > 1 && (
            <div className="flex flex-wrap gap-1 rounded-full bg-zinc-900 p-1 text-xs">
              {options.map((o, i) => (
                <button
                  key={o.label}
                  type="button"
                  onClick={() => switchOption(i)}
                  className={`whitespace-nowrap rounded-full px-2.5 py-1 transition ${
                    i === activeIdx
                      ? "bg-zinc-700 text-white"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}
          {usingTabs ? (
            <div className="flex max-w-full gap-1 overflow-x-auto rounded-full bg-zinc-900 p-1 text-xs">
              {active?.tabs?.map((t, i) => (
                <button
                  key={t.label}
                  type="button"
                  onClick={() => setTabIdx(i)}
                  className={`whitespace-nowrap rounded-full px-2.5 py-1 transition ${
                    i === tabIdx
                      ? "bg-zinc-700 text-white"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          ) : (
            availableSorts.length > 1 && (
              <div className="flex max-w-full gap-1 overflow-x-auto rounded-full bg-zinc-900 p-1 text-xs">
                {availableSorts.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setSort(s.key)}
                    className={`whitespace-nowrap rounded-full px-2.5 py-1 transition ${
                      sort === s.key
                        ? "bg-zinc-700 text-white"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )
          )}
        </div>
      </div>
      {sorted.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-zinc-500">
          该数据源暂时不可用，可切换到其他数据源。
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {sorted.slice(0, 12).map((item) => (
            <ItemCard
              key={item.uuid}
              item={item}
              square={active?.square}
            />
          ))}
        </div>
      )}
      {active.note && (
        <p className="mt-2 text-xs text-zinc-500">{active.note}</p>
      )}
    </section>
  );
}
