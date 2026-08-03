"use client";

import { useState } from "react";
import Link from "next/link";
import type { NeoDBItem } from "@/lib/types";
import { pickTitle } from "@/lib/utils";

export default function ItemSwitcher({
  currentTitle,
  candidates,
}: {
  currentTitle: string;
  candidates: NeoDBItem[];
}) {
  const [open, setOpen] = useState(false);
  if (candidates.length === 0) return null;

  return (
    <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="title-accent text-left text-sm font-medium"
      >
        切换相同条目
        <span className="font-normal text-zinc-500">
          （找到 {candidates.length} 个 · 当前：{currentTitle}）
        </span>
        {open ? " · 收起" : " · 展开"}
      </button>
      {open && (
        <ul className="mt-2 space-y-1">
          {candidates.map((c) => (
            <li key={c.uuid}>
              <Link
                href={`/item/${c.uuid}`}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-zinc-800"
              >
                {c.cover_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.cover_image_url}
                    alt=""
                    className="h-9 w-6 shrink-0 rounded object-cover"
                  />
                ) : (
                  <span className="h-9 w-6 shrink-0 rounded bg-zinc-800" />
                )}
                <span className="line-clamp-1 flex-1 text-xs text-zinc-200">
                  {pickTitle(c)}
                </span>
                {c.year != null && (
                  <span className="text-[10px] text-zinc-500">{c.year}</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
