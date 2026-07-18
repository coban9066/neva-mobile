import { cn } from "@/lib/utils";
import { formatKurus } from "@/lib/money";
import { GRADE_META } from "@/lib/quality";
import { remainingDays, formatSpan } from "@/lib/warranty";
import { RegionBadge } from "@/components/ui/region-segment";
import type { StockPhone } from "./types";

/** Stok telefon kartı; seçimde glow border. */
export function PhoneCard({
  phone,
  selected,
  onSelect,
}: {
  phone: StockPhone;
  selected: boolean;
  onSelect: () => void;
}) {
  const warrantyDays = phone.warranty_until ? remainingDays(phone.warranty_until) : null;

  return (
    <button
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "card-lift w-full cursor-pointer rounded-lg border bg-surface p-3 text-left",
        "transition-[border-color,box-shadow] duration-200",
        selected
          ? "border-primary shadow-[0_0_0_1px_var(--primary),0_0_20px_-4px_var(--primary)]"
          : "border-border hover:border-primary/40",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring/60"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold">
            {phone.label}
            <span className="ml-1.5 font-normal text-fg-muted">
              {phone.storage_gb ? `${phone.storage_gb}GB` : ""} {phone.color ?? ""}
            </span>
          </p>
          <p className="tabular mt-0.5 font-mono text-[11px] text-fg-muted">{phone.imei1 ?? "IMEI yok"}</p>
        </div>
        {phone.region && <RegionBadge region={phone.region} />}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
        <span className="text-fg-muted">
          Kozmetik{" "}
          <b className="text-fg">
            {phone.cosmetic_grade ? GRADE_META[phone.cosmetic_grade].label : "—"}
          </b>
        </span>
        <span className="text-fg-muted">
          Alış <b className="tabular font-mono text-fg">{formatKurus(phone.purchase_price)}</b>
        </span>
        <span className="text-fg-muted">
          Maliyet <b className="tabular font-mono text-fg">{formatKurus(phone.total_cost)}</b>
        </span>
        {warrantyDays != null && warrantyDays > 0 && (
          <span className="text-fg-muted">
            Garanti <b className="text-fg">{formatSpan(warrantyDays)}</b>
          </span>
        )}
      </div>
    </button>
  );
}
