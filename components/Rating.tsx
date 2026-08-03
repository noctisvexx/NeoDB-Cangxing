import { stars } from "@/lib/utils";
import { formatCount } from "@/lib/utils";

export default function Rating({
  value,
  count,
  className = "",
}: {
  value?: number | null;
  count?: number;
  className?: string;
}) {
  if (value == null) return null;
  return (
    <div className={className}>
      <div className="flex items-baseline gap-1.5">
        <span className="text-sm tracking-tight text-amber-400">
          {stars(value)}
        </span>
        <span className="font-semibold text-zinc-100">
          {value.toFixed(1)}
        </span>
      </div>
      {count != null && count > 0 && (
        <span className="mt-0.5 block text-xs text-zinc-500">
          {formatCount(count)} 人评
        </span>
      )}
    </div>
  );
}
