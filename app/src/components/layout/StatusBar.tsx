import { Database, Package, ShieldCheck, KeyRound, TriangleAlert, CircleX } from "lucide-react";
import { Kbd } from "@/components/ui/kbd";
import { useUi } from "@/stores/ui";
import { useAppVersion } from "@/hooks/useAppVersion";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { LicenseStatus } from "@/lib/license";

function licenseSpan(days: number | null | undefined): string {
  if (days == null) return "";
  if (days >= 60 && days % 30 === 0) return `${days / 30} Ay Kaldı`;
  return `${days} Gün Kaldı`;
}

/** Lisans durumuna göre ikon/renk/metin; her açılışta license state'ten yeniden hesaplanır. */
function licenseDisplay(license: LicenseStatus | null) {
  if (!license) {
    return { Icon: KeyRound, tone: "", text: "Lisans: …" };
  }
  if (license.state === "expired") {
    return { Icon: CircleX, tone: "text-destructive", text: "Lisans Süresi Doldu" };
  }
  const days = license.daysLeft;
  if (days == null) {
    return { Icon: ShieldCheck, tone: "text-success", text: "Sınırsız Lisans" };
  }
  if (days <= 7) {
    return { Icon: TriangleAlert, tone: "text-warning", text: licenseSpan(days) };
  }
  return { Icon: KeyRound, tone: "text-primary", text: licenseSpan(days) };
}

export function StatusBar() {
  const license = useUi((s) => s.license);
  const version = useAppVersion();
  const { Icon, tone, text } = licenseDisplay(license);

  const tooltip = license
    ? [
        `Lisans Türü: ${license.planLabel ?? "—"}`,
        `Bitiş Tarihi: ${license.endDate === "Sınırsız" ? "Sınırsız" : license.endDate ? formatDate(license.endDate) : "—"}`,
        `Kalan Süre: ${license.daysLeft != null ? `${license.daysLeft} Gün` : "Sınırsız"}`,
      ].join("\n")
    : undefined;

  return (
    <footer className="flex h-6 shrink-0 items-center gap-4 border-t border-border bg-surface px-3 text-[11px] text-fg-muted">
      <span className="inline-flex items-center gap-1">
        <Database size={11} /> neva.db
      </span>
      <span title={tooltip} className={cn("inline-flex items-center gap-1", tone)}>
        <Icon size={11} /> {text}
      </span>
      <span className="inline-flex items-center gap-1">
        <Package size={11} /> v{version ?? "…"}
      </span>
      <div className="flex-1" />
      <span className="hidden items-center gap-1.5 sm:inline-flex">
        <Kbd>F2</Kbd> Alış · <Kbd>F4</Kbd> IMEI Ara · <Kbd>Ctrl K</Kbd> Komut
      </span>
    </footer>
  );
}
