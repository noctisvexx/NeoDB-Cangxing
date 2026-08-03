"use client";

import { useState } from "react";

export default function Heatmap({
  counts,
}: {
  counts: Record<string, number>;
}) {
  const [selected, setSelected] = useState<{
    date: Date;
    count: number;
  } | null>(null);

  const now = new Date();
  const year = now.getFullYear();
  const start = new Date(year, 0, 1);
  const offset = (start.getDay() + 6) % 7;
  const first = new Date(start);
  first.setDate(start.getDate() - offset);
  const end = new Date(year, 11, 31);
  const cells: { date: Date; count: number }[] = [];
  for (let d = new Date(first); d <= end; d.setDate(d.getDate() + 1)) {
    const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    cells.push({ date: new Date(d), count: counts[key] ?? 0 });
  }
  const weeks: { date: Date; count: number }[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  const monthLabels = weeks.map((w, i) => {
    const d = w[0].date;
    const prev = i > 0 ? weeks[i - 1][0].date : null;
    if (d.getFullYear() !== year) return null; // 跳过上一年的 12 月
    if (!prev || prev.getMonth() !== d.getMonth()) {
      return `${d.getMonth() + 1}月`;
    }
    return null;
  });
  const color = (count: number) => {
    if (count === 0) return "var(--card-strong)";
    if (count === 1) return "color-mix(in srgb, var(--accent) 30%, transparent)";
    if (count <= 3) return "color-mix(in srgb, var(--accent) 55%, transparent)";
    return "var(--accent)";
  };

  return (
    <div>
      <div className="mb-1 flex gap-[3px] pr-6">
        {monthLabels.map((l, i) =>
          (
            <span
              key={i}
              className="flex-1 whitespace-nowrap text-center text-[10px] text-zinc-500"
            >
              {l ?? ""}
            </span>
          ),
        )}
      </div>
      <div className="flex gap-[3px]">
        {weeks.map((w, wi) => (
          <div key={wi} className="flex flex-1 flex-col gap-[3px]">
            {w.map((c) => (
              <button
                key={c.date.toISOString()}
                type="button"
                onClick={() => setSelected(c)}
                title={`${c.date.toLocaleDateString("zh-CN", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  weekday: "short",
                })}：${c.count} 部`}
                style={{ backgroundColor: color(c.count) }}
                className="aspect-square w-full rounded-[2px] transition hover:scale-110"
              />
            ))}
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-zinc-500">
        {selected
          ? `${selected.date.toLocaleDateString("zh-CN", {
              year: "numeric",
              month: "long",
              day: "numeric",
              weekday: "short",
            })}：标记了 ${selected.count} 部`
          : `${year} 年观影热力图 · 点击格子查看具体日期`}
      </p>
    </div>
  );
}
