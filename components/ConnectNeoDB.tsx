"use client";

import { useState } from "react";

export default function ConnectNeoDB({
  label = "一键创建应用并连接 NeoDB",
}: {
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/apps", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "创建失败");
      window.location.href = data.authorizeUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : "创建失败");
      setBusy(false);
    }
  }

  return (
    <div>
      {error && <p className="mb-2 text-sm text-red-400">{error}</p>}
      <button
        type="button"
        onClick={go}
        disabled={busy}
        className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-amber-400 disabled:opacity-50"
      >
        {busy ? "创建应用中…" : label}
      </button>
    </div>
  );
}
