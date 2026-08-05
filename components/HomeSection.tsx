// 首页栏目（服务端组件）：内部独立加载数据，配合 Suspense 实现流式渲染——
// 每个栏目数据就绪后立即输出，先到先显示，不用等所有栏目抓完。
import SourceSection from "./SourceSection";
import {
  loadHomeSection,
  SECTION_META,
} from "@/lib/home-data";

export default async function HomeSection({ k }: { k: string }) {
  const data = await loadHomeSection(k);
  return (
    <>
      {data.error && (
        <div className="mx-auto w-full max-w-5xl px-4 pt-5">
          <p className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-400">
            {data.error}
          </p>
        </div>
      )}
      <SourceSection
        title={SECTION_META[k]?.title ?? k}
        options={data.options}
      />
    </>
  );
}

/** 栏目骨架屏：数据加载期间的占位，避免整页空白 */
export function SectionSkeleton({
  title,
}: {
  title: string;
}) {
  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="title-accent text-xl font-bold">{title}</h2>
      </div>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex gap-3 rounded-xl border border-zinc-800/70 bg-zinc-900/40 p-3"
          >
            <div className="h-20 w-14 shrink-0 animate-pulse rounded-lg bg-zinc-800/80" />
            <div className="flex flex-1 flex-col justify-center gap-2">
              <div className="h-3 w-3/4 animate-pulse rounded bg-zinc-800/80" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-zinc-800/60" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
