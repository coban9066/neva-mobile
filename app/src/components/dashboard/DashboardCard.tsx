import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type CardTone = "default" | "success" | "danger" | "warning";

const TONE_VALUE: Record<CardTone, string> = {
  default: "text-fg",
  success: "text-success",
  danger: "text-destructive",
  warning: "text-warning",
};

/** Üst sıra KPI kartı: ikon + etiket + tek büyük değer. Açıklama satırı yok. */
export function DashboardCard({
  icon: Icon,
  label,
  value,
  unit,
  tone = "default",
  onClick,
  index = 0,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  unit?: string;
  tone?: CardTone;
  onClick?: () => void;
  index?: number;
}) {
  return (
    <button
      onClick={onClick}
      style={{ animationDelay: `${index * 45}ms` }}
      className={cn(
        "animate-card-in card-lift group min-w-0 cursor-pointer rounded-lg border border-border bg-surface p-4 text-left",
        "hover:border-primary/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring/60"
      )}
    >
      <div className="flex items-center gap-2 text-fg-muted transition-colors group-hover:text-fg">
        <Icon size={14} strokeWidth={1.75} />
        <span className="truncate text-xs font-medium tracking-wide">{label}</span>
      </div>
      <p
        className={cn(
          "tabular mt-3 truncate font-mono text-[22px] font-semibold leading-none",
          TONE_VALUE[tone]
        )}
        title={value}
      >
        {value}
        {unit && <span className="ml-1 text-xs font-normal text-fg-muted">{unit}</span>}
      </p>
    </button>
  );
}
