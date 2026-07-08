import { Database, KeySquare } from "lucide-react";
import { Kbd } from "@/components/ui/kbd";
import { useUi } from "@/stores/ui";
import { cn } from "@/lib/utils";

function licenseText(days: number | null | undefined, state?: string): string {
  if (state === "expired") return "Lisans: süresi doldu";
  if (days == null) return "Lisans: sınırsız";
  return `Lisans: ${days} gün`;
}

export function StatusBar() {
  const license = useUi((s) => s.license);
  const days = license?.daysLeft;
  return (
    <footer className="flex h-6 shrink-0 items-center gap-4 border-t border-border bg-surface px-3 text-[11px] text-fg-muted">
      <span className="inline-flex items-center gap-1">
        <Database size={11} /> neva.db
      </span>
      <span
        className={cn(
          "inline-flex items-center gap-1",
          license?.state === "expired" || (days != null && days <= 7)
            ? "text-destructive"
            : days != null && days <= 30
              ? "text-warning"
              : undefined
        )}
      >
        <KeySquare size={11} /> {license ? licenseText(days, license.state) : "Lisans: …"}
      </span>
      <div className="flex-1" />
      <span className="hidden items-center gap-1.5 sm:inline-flex">
        <Kbd>F2</Kbd> Alış · <Kbd>F4</Kbd> IMEI Ara · <Kbd>Ctrl K</Kbd> Komut
      </span>
    </footer>
  );
}
