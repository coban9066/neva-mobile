import { useState } from "react";
import { Calculator, ChevronDown } from "lucide-react";
import { formatKurus, parseLiraInput } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

/** Tamamen frontend'de çalışan hızlı kar hesabı: alış + masraf → satış → net kar & marj. */
export function QuickProfitCalculator() {
  const [open, setOpen] = useState(false);
  const [purchase, setPurchase] = useState("");
  const [expense, setExpense] = useState("");
  const [sale, setSale] = useState("");

  const purchaseK = parseLiraInput(purchase) ?? 0;
  const expenseK = parseLiraInput(expense) ?? 0;
  const saleK = parseLiraInput(sale);

  const totalCost = purchaseK + expenseK;
  const netProfit = saleK != null ? saleK - totalCost : null;
  const margin = saleK != null && saleK > 0 && netProfit != null ? (netProfit / saleK) * 100 : null;

  return (
    <section className="animate-card-in card-lift rounded-lg border border-border bg-surface">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 p-4"
      >
        <span className="flex items-center gap-2">
          <Calculator size={15} className="text-secondary" strokeWidth={1.75} />
          <h2 className="text-[13px] font-semibold">Kar Hesapla</h2>
        </span>
        <ChevronDown
          size={15}
          className={cn("text-fg-muted transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="px-4 pb-4">
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ["Alış", purchase, setPurchase],
                ["Masraf", expense, setExpense],
                ["Satış", sale, setSale],
              ] as const
            ).map(([label, value, set]) => (
              <label key={label} className="flex flex-col gap-1">
                <span className="text-[11px] font-medium text-fg-muted">{label}</span>
                <Input
                  value={value}
                  onChange={(e) => set(e.target.value)}
                  placeholder="0"
                  inputMode="numeric"
                  className="tabular h-7 px-2 text-right font-mono text-xs"
                />
              </label>
            ))}
          </div>

          <dl className="mt-3 space-y-1.5 border-t border-border pt-3 text-xs">
            <div className="flex items-center justify-between">
              <dt className="text-fg-muted">Toplam Maliyet</dt>
              <dd className="tabular font-mono font-medium">{formatKurus(totalCost)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-fg-muted">Net Kar</dt>
              <dd
                className={cn(
                  "tabular font-mono font-semibold",
                  netProfit == null
                    ? "text-fg-muted"
                    : netProfit >= 0
                      ? "text-success"
                      : "text-destructive"
                )}
              >
                {netProfit == null ? "—" : formatKurus(netProfit)}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-fg-muted">Kar Marjı</dt>
              <dd
                className={cn(
                  "tabular font-mono font-semibold",
                  margin == null ? "text-fg-muted" : margin >= 0 ? "text-success" : "text-destructive"
                )}
              >
                {margin == null ? "—" : `%${margin.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}`}
              </dd>
            </div>
          </dl>
        </div>
      )}
    </section>
  );
}
