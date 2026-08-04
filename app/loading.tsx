export default function Loading() {
  return (
    <div className="flex min-h-[55vh] items-center justify-center px-4">
      <div className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 px-5 py-3 text-sm text-zinc-400">
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
        正在加载…
      </div>
    </div>
  );
}
