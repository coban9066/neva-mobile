import { TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatKurus } from "@/lib/money";
import type { StockPhone } from "./types";

/** Kar paneli — satış fiyatı yazıldığı anda canlı hesap; ekranın en baskın bloğu. */
export function ProfitCard({
  phone,
  salePrice,
  commissionAmount = 0,
}: {
  phone: StockPhone | null;
  salePrice: number | null;
  /** Kuruş; yalnız POS + komisyon girilmişse sıfırdan büyük. */
  commissionAmount?: number;
}) {
  const cost = phone?.total_cost ?? null;
  const expense = phone ? phone.total_cost - phone.purchase_price : null;
  const netReceived = salePrice != null ? salePrice - commissionAmount : null;
  const profit = cost != null && netReceived != null ? netReceived - cost : null;
  const pct =
    profit != null && cost != null && cost > 0
      ? (profit / cost) * 100
      : null;

  return (
    <section
      className={cn(
        "rounded-lg border p-4 transition-colors duration-200",
        profit == null
          ? "border-border bg-surface"
          : profit >= 0
            ? "border-success/40 bg-success/[0.04]"
            : "border-destructive/40 bg-destructive/[0.04]"
      )}
    >
      <header className="flex items-center gap-2">
        <TrendingUp size={15} className="text-fg-muted" strokeWidth={1.75} />
        <h2 className="text-[13px] font-semibold">Kar Hesabı</h2>
      </header>

      <dl className="mt-3 space-y-1.5 text-xs">
        {(
          [
            ["Alış", phone ? formatKurus(phone.purchase_price) : "—"],
            ["Masraf", expense != null ? formatKurus(expense) : "—"],
            ["Toplam Maliyet", cost != null ? formatKurus(cost) : "—"],
            ["Satış", salePrice != null ? formatKurus(salePrice) : "—"],
            ...(commissionAmount > 0
              ? ([["Banka Komisyonu", `-${formatKurus(commissionAmount)}`]] as const)
              : []),
            ...(commissionAmount > 0
              ? ([["Kasaya Giren", netReceived != null ? formatKurus(netReceived) : "—"]] as const)
              : []),
          ] as const
        ).map(([k, v]) => (
          <div key={k} className="flex items-center justify-between">
            <dt className="text-fg-muted">{k}</dt>
            <dd
              className={cn(
                "tabular font-mono font-medium",
                k === "Kasaya Giren" && "font-semibold text-fg"
              )}
            >
              {v}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-3 border-t border-border pt-3">
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-medium text-fg-muted">Net Kar</span>
          <span
            className={cn(
              "tabular font-mono text-2xl font-semibold leading-none",
              profit == null ? "text-fg-muted" : profit >= 0 ? "text-success" : "text-destructive"
            )}
          >
            {profit == null ? "—" : formatKurus(profit)}
          </span>
        </div>
        <div className="mt-1.5 flex items-baseline justify-between">
          <span className="text-xs text-fg-muted">Kar %</span>
          <span
            className={cn(
              "tabular font-mono text-sm font-semibold",
              pct == null ? "text-fg-muted" : pct >= 0 ? "text-success" : "text-destructive"
            )}
          >
            {pct == null
              ? "—"
              : `%${pct.toLocaleString("tr-TR", { maximumFractionDigits: 2 })}`}
          </span>
        </div>
      </div>
    </section>
  );
}
