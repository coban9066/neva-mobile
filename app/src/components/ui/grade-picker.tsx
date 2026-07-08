import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { GRADES } from "@/lib/quality";
import type { CosmeticGrade } from "@/types";

function Stars({ count, active }: { count: number; active: boolean }) {
  return (
    <span className={cn("flex gap-0.5", active ? "text-accent" : "text-fg-muted/60")}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={10}
          strokeWidth={1.5}
          className={i < count ? "fill-current" : "opacity-35"}
        />
      ))}
    </span>
  );
}

/** Kart tabanlı kozmetik seçimi: yıldız + kademe, seçimde glow/border animasyonu. */
export function GradePicker({
  value,
  onChange,
  disabled,
  compact,
}: {
  value: CosmeticGrade | null;
  onChange: (g: CosmeticGrade) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <div className={cn("grid grid-cols-4", compact ? "gap-1.5" : "gap-2")}>
      {GRADES.map(({ grade, stars, label, description }) => {
        const active = value === grade;
        return (
          <button
            key={grade}
            type="button"
            disabled={disabled}
            onClick={() => onChange(grade)}
            aria-pressed={active}
            className={cn(
              "flex cursor-pointer flex-col items-center rounded-lg border bg-surface text-center",
              "transition-[border-color,box-shadow,background-color] duration-200",
              compact ? "gap-0.5 px-1.5 py-1.5" : "gap-1 px-2 py-2.5",
              active
                ? "border-primary bg-primary/[0.04] shadow-[0_0_0_1px_var(--primary),0_0_16px_-4px_var(--primary)]"
                : "border-border-strong hover:border-primary/50 hover:shadow-[0_0_12px_-6px_var(--primary)]",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring/60",
              "disabled:cursor-not-allowed disabled:opacity-50"
            )}
          >
            <Stars count={stars} active={active} />
            <span
              className={cn(
                "font-semibold leading-none",
                compact ? "text-xs" : "text-sm",
                active ? "text-primary" : "text-fg"
              )}
            >
              {label}
            </span>
            {!compact && <span className="text-[10px] leading-tight text-fg-muted">{description}</span>}
          </button>
        );
      })}
    </div>
  );
}
