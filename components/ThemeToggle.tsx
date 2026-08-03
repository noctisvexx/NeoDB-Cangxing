"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("shibei-theme");
    const initial: "light" | "dark" =
      saved === "light" || saved === "dark"
        ? saved
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    document.documentElement.dataset.theme = initial;
    setTheme(initial);
  }, []);

  function toggle() {
    const next: "light" | "dark" = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("shibei-theme", next);
    setTheme(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title={theme === "dark" ? "切换到日间" : "切换到夜间"}
      className="flex items-center gap-1 rounded-full border border-white/5 bg-zinc-900/60 px-2.5 py-1.5 text-sm text-zinc-300 transition hover:border-amber-400/50 hover:text-amber-300 sm:px-3"
    >
      <span aria-hidden="true">{theme === "dark" ? "☀️" : "🌙"}</span>
    </button>
  );
}
