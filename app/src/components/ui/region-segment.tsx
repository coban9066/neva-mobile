import { cn } from "@/lib/utils";
import { REGION_LABELS, type Region } from "@/types";

/** Menşei rengi: yurt içi mavi, yurt dışı turuncu. */
const REGION_ACTIVE: Record<Region, string> = {
  domestic: "bg-secondary text-white border-secondary",
  import: "bg-accent text-white border-accent",
};

const REGION_BADGE: Record<Region, string> = {
  domestic: "bg-secondary/12 text-secondary",
  import: "bg-accent/12 text-accent",
};

/** Segmented control — dropdown değil; tek dokunuşla menşei seçimi. */
export function RegionSegment({
  value,
  onChange,
  disabled,
}: {
  value: Region;
  onChange: (r: Region) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-lg border border-border-strong bg-surface-2/60 p-1">
      {(Object.keys(REGION_LABELS) as Region[]).map((r) => (
        <button
          key={r}
          type="button"
          disabled={disabled}
          onClick={() => onChange(r)}
          aria-pressed={value === r}
          className={cn(
            "h-7 cursor-pointer rounded-md border text-xs font-medium transition-all duration-200",
            value === r
              ? cn(REGION_ACTIVE[r], "shadow-sm")
              : "border-transparent text-fg-muted hover:bg-surface hover:text-fg",
            "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring/60",
            "disabled:cursor-not-allowed disabled:opacity-50"
          )}
        >
          {REGION_LABELS[r]}
        </button>
      ))}
    </div>
  );
}

/** Telefon kartı / liste / satış ekranında menşei rozeti. */
export function RegionBadge({ region, className }: { region: Region; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium leading-4",
        REGION_BADGE[region],
        className
      )}
    >
      {REGION_LABELS[region]}
    </span>
  );
}
