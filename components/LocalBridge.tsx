"use client";

import { useState } from "react";

export default function LocalBridge({
  neodbConnected,
}: {
  neodbConnected: boolean;
}) {
  const [busy, setBusy] = useState<"import" | "export" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function run(kind: "import" | "export") {
    setBusy(kind);
    setMsg(null);
    setErr(null);
    try {
      const res = await fetch(
        kind === "import" ? "/api/local/import-neodb" : "/api/local/export-neodb",
        { method: "POST" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "操作失败");
      if (kind === "import") {
        setMsg(
          `已从 NeoDB 导入 ${data.imported ?? 0} 条标记到本地档案${
            data.total ? `（共读取 ${data.total} 条）` : ""
          }${data.errors?.length ? `，另有 ${data.errors.length} 处读取告警` : ""}`,
        );
      } else {
        setMsg(
          `已导出 ${data.exported ?? 0} 条到 NeoDB${
            data.matched ? `（其中新匹配条目 ${data.matched} 条）` : ""
          }${data.failed ? `，${data.failed} 条失败` : ""}`,
        );
      }
      if (data.errors?.length) {
        setErr((data.errors as string[]).slice(0, 5).join("；"));
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "操作失败");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mb-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
      <h2 className="title-accent mb-2 text-lg font-bold">
        本地 ↔ NeoDB 数据桥接
      </h2>
      <p className="mb-3 text-sm text-zinc-400">
        本地标记与 NeoDB 书架互相导入/导出，方便你从 NeoDB 迁入数据，或把本地标记一次性同步回 NeoDB。
      </p>
      {!neodbConnected && (
        <p className="mb-3 rounded-lg bg-zinc-800/70 px-3 py-2 text-xs text-zinc-400">
          尚未连接 NeoDB：需要先在「我的」页完成 NeoDB 授权才能导入/导出。
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void run("import")}
          disabled={busy !== null || !neodbConnected}
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-amber-400 disabled:opacity-50"
        >
          {busy === "import" ? "导入中…" : "从 NeoDB 导入到本地"}
        </button>
        <button
          type="button"
          onClick={() => void run("export")}
          disabled={busy !== null || !neodbConnected}
          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:border-amber-400/50 disabled:opacity-50"
        >
          {busy === "export" ? "导出中…" : "导出本地标记到 NeoDB"}
        </button>
      </div>
      {msg && <p className="mt-3 text-sm text-emerald-400">{msg}</p>}
      {err && <p className="mt-3 text-sm text-red-400">{err}</p>}
    </div>
  );
}
