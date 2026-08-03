import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import ThemeToggle from "@/components/ThemeToggle";
import UpdateChecker from "@/components/UpdateChecker";

export const metadata: Metadata = {
  icons: { icon: "/icon.svg" },
  title: {
    default: "藏星 · 内容探索",
    template: "%s · 藏星",
  },
  description:
    "个人内容探索工具 —— 发现正在闪耀的作品，寻找下一颗属于你的星。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("shibei-theme");if(t==="light"||t==="dark"){document.documentElement.dataset.theme=t}}catch(e){}`,
          }}
        />
        <UpdateChecker />
        <header className="sticky top-0 z-20 border-b border-white/5 bg-[#07090d]/80 backdrop-blur">
          <div className="h-px bg-gradient-to-r from-amber-500/50 via-teal-400/50 to-transparent" />
          <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-baseline gap-2">
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5 self-center"
                fill="var(--accent)"
                aria-hidden="true"
              >
                <path d="M12 2c1.2 5.5 4.3 8.8 10 10-5.7 1.2-8.8 4.5-10 10-1.2-5.5-4.3-8.8-10-10 5.7-1.2 8.8-4.5 10-10Z" />
              </svg>
              <span className="title-accent text-xl font-bold tracking-wide">
                藏星
              </span>
              <span className="hidden text-xs text-zinc-500 sm:inline">
                CANGXING
              </span>
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link
                href="/"
                className="text-zinc-300 transition hover:text-white"
              >
                发现
              </Link>
              <Link
                href="/search"
                className="text-zinc-300 transition hover:text-white"
              >
                搜索
              </Link>
              <Link
                href="/me"
                className="text-zinc-300 transition hover:text-white"
              >
                我的
              </Link>
              <Link
                href="/settings"
                className="text-zinc-300 transition hover:text-white"
              >
                设置
              </Link>
              <ThemeToggle />
            </nav>
          </div>
        </header>
        <main>{children}</main>
        <footer className="mt-12 border-t border-zinc-800/60 py-6 text-center text-xs text-zinc-600">
          藏星 · 个人内容探索工具 · 数据来自 NeoDB / TMDB / Bangumi / Steam / Apple ·{" "}
          <Link href="/settings" className="underline hover:text-zinc-300">
            设置
          </Link>
        </footer>
      </body>
    </html>
  );
}
