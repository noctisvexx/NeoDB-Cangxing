"use client";

import { useCallback, useEffect, useState } from "react";

interface UpdateRelease {
  name?: string;
  url?: string;
  notes?: string;
}

interface UpdateInfo {
  current: string;
  latest?: string;
  updateAvailable: boolean;
  release?: UpdateRelease;
}

const CHECK_INTERVAL = 6 * 60 * 60 * 1000; // 6 小时
const IGNORE_KEY = "cangxing-ignored-version";

export default function UpdateChecker() {
  const [visible, setVisible] = useState(false);
  const [info, setInfo] = useState<UpdateInfo | null>(null);

  const check = useCallback(async () => {
    try {
      const res = await fetch("/api/update", { cache: "no-store" });
      const data: UpdateInfo = await res.json();
      setInfo(data);
      if (data.updateAvailable) {
        let ignored: string | null = null;
        try {
          ignored = localStorage.getItem(IGNORE_KEY);
        } catch {
          // 忽略
        }
        if (ignored !== data.latest) setVisible(true);
      } else {
        setVisible(false);
      }
    } catch {
      // 网络异常时静默，不打扰用户
    }
  }, []);

  useEffect(() => {
    void check();
    const timer = setInterval(() => void check(), CHECK_INTERVAL);
    return () => clearInterval(timer);
  }, [check]);

  const ignore = () => {
    if (info?.latest) {
      try {
        localStorage.setItem(IGNORE_KEY, info.latest);
      } catch {
        // 忽略
      }
    }
    setVisible(false);
  };

  if (!visible || !info?.updateAvailable || !info.release?.url) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 top-2 z-50 flex justify-center px-4">
      <div
        className="flex w-full max-w-xl items-center gap-3 rounded-xl border px-4 py-3 shadow-lg"
        style={{
          backgroundColor: "var(--card-strong)",
          borderColor: "var(--accent)",
          color: "var(--text)",
        }}
      >
        <svg
          viewBox="0 0 24 24"
          className="h-6 w-6 shrink-0"
          fill="var(--accent)"
          aria-hidden="true"
        >
          <path d="M12 2c1.2 5.5 4.3 8.8 10 10-5.7 1.2-8.8 4.5-10 10-1.2-5.5-4.3-8.8-10-10 5.7-1.2 8.8-4.5 10-10Z" />
        </svg>
        <div className="min-w-0 flex-1">
          <p className="font-semibold" style={{ color: "var(--accent)" }}>
            发现新版本 v{info.latest}
          </p>
          <p className="truncate text-sm" style={{ color: "var(--text-2)" }}>
            当前 v{info.current} → v{info.latest}
            {info.release.name ? ` · ${info.release.name}` : ""}
          </p>
        </div>
        <a
          href={info.release.url}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium"
          style={{
            backgroundColor: "var(--accent)",
            color: "#241d12",
          }}
        >
          前往下载
        </a>
        <button
          type="button"
          onClick={ignore}
          className="shrink-0 rounded-lg px-3 py-1.5 text-sm transition hover:opacity-70"
          style={{ color: "var(--muted)" }}
        >
          忽略此版本
        </button>
      </div>
    </div>
  );
}
