export default function ItemLoading() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <div className="h-5 w-24 animate-pulse rounded bg-zinc-800/70" />
      <div className="mt-5 grid gap-8 lg:grid-cols-[360px_1fr]">
        <div className="mx-auto w-64 shrink-0 lg:mx-0 lg:w-full">
          <div className="aspect-[2/3] w-full animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900/80" />
        </div>
        <div className="space-y-3">
          <div className="h-4 w-32 animate-pulse rounded-full bg-zinc-800/70" />
          <div className="h-9 w-3/4 animate-pulse rounded bg-zinc-800/80" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-zinc-800/70" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-zinc-800/70" />
          <div className="h-24 w-full animate-pulse rounded-xl bg-zinc-900/60" />
          <div className="pt-3">
            <div className="mb-2 h-4 w-24 animate-pulse rounded bg-zinc-800/70" />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="h-16 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/60"
                />
              ))}
            </div>
          </div>
          <div className="pt-2">
            <div className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-400">
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5 animate-spin"
                style={{ color: "var(--accent)" }}
                fill="none"
                aria-hidden="true"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="3"
                  opacity="0.25"
                />
                <path
                  d="M12 2a10 10 0 0 1 10 10"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
              正在加载作品详情（评分、评论、多平台数据需要几秒）…
            </div>
          </div>
        </div>
      </div>
      <div className="mt-10">
        <div className="mb-3 h-5 w-28 animate-pulse rounded bg-zinc-800/70" />
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/40"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
