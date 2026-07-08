import { cn } from "@/lib/utils";
import { SALE_PAYMENT_LABELS, type SalePayment } from "./types";

/** Ödeme türü — tek dokunuş segmented seçim. */
export function PaymentSelector({
  value,
  onChange,
}: {
  value: SalePayment;
  onChange: (p: SalePayment) => void;
}) {
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {(Object.keys(SALE_PAYMENT_LABELS) as SalePayment[]).map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          aria-pressed={value === p}
          className={cn(
            "h-8 cursor-pointer rounded-md border text-xs font-medium transition-colors duration-200",
            value === p
              ? "border-primary bg-primary text-on-primary shadow-sm"
              : "border-border-strong bg-surface text-fg-muted hover:border-primary/50 hover:text-fg"
          )}
        >
          {SALE_PAYMENT_LABELS[p]}
        </button>
      ))}
    </div>
  );
}
