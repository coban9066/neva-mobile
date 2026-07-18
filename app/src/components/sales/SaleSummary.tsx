import { Smartphone, X } from "lucide-react";
import { GRADE_META } from "@/lib/quality";
import { RegionBadge } from "@/components/ui/region-segment";
import type { StockPhone } from "./types";

/** Sağ panel üst şeridi: seçilen telefonun kimliği. */
export function SaleSummary({ phone, onClear }: { phone: StockPhone | null; onClear: () => void }) {
  if (!phone) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-dashed border-border-strong px-3 py-2.5 text-xs text-fg-muted">
        <Smartphone size={14} strokeWidth={1.75} />
        Soldan telefon seçin — satış alanları ondan sonra aktifleşir.
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/[0.04] px-3 py-2.5">
      <Smartphone size={14} className="shrink-0 text-primary" strokeWidth={1.75} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold">
          {phone.label}
          <span className="ml-1.5 font-normal text-fg-muted">
            {phone.storage_gb ? `${phone.storage_gb}GB` : ""} {phone.color ?? ""}
            {phone.cosmetic_grade ? ` · ${GRADE_META[phone.cosmetic_grade].label} Kozmetik` : ""}
          </span>
        </p>
        <p className="tabular font-mono text-[11px] text-fg-muted">{phone.imei1 ?? "IMEI yok"}</p>
      </div>
      {phone.region && <RegionBadge region={phone.region} />}
      <button
        onClick={onClear}
        aria-label="Seçimi kaldır"
        title="Seçimi kaldır (Esc)"
        className="cursor-pointer rounded p-1 text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
      >
        <X size={14} />
      </button>
    </div>
  );
}
