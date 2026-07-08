import { useQuery } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { select } from "@/lib/db";
import { cn, formatDate } from "@/lib/utils";
import { remainingDays, formatSpan, warrantyTone, type WarrantyTone } from "@/lib/warranty";
import { useUi } from "@/stores/ui";
import { EmptyState } from "@/components/ui/empty-state";

interface WarrantyRow {
  phone_id: number;
  label: string;
  imei1: string;
  warranty_until: string;
}

const TONE_CLASS: Record<WarrantyTone, string> = {
  default: "bg-success/12 text-success",
  warning: "bg-warning/12 text-warning",
  danger: "bg-destructive/12 text-destructive",
};

/**
 * Üretici garantisi takibi: kalan süre bitiş tarihinden her açılışta
 * yeniden hesaplanır; süresi dolanlar sorgu filtresiyle otomatik düşer.
 */
export function WarrantyPage() {
  const { openPhoneDrawer } = useUi();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["warranties"],
    queryFn: () =>
      select<WarrantyRow>(
        `SELECT p.id AS phone_id,
                COALESCE(b.name || ' ' || p.model, 'Telefon #' || p.id) AS label,
                p.imei1, p.warranty_until
         FROM phones p
         LEFT JOIN brands b ON b.id = p.brand_id
         WHERE p.deleted_at IS NULL
           AND p.warranty_until IS NOT NULL
           AND date(p.warranty_until) >= date('now','localtime')
         ORDER BY p.warranty_until ASC`
      ),
  });

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border bg-surface px-4 py-2.5">
        <ShieldCheck size={15} className="text-primary" strokeWidth={1.75} />
        <h1 className="text-sm font-semibold">Garanti Takibi</h1>
        <span className="text-xs text-fg-muted">üretici garantisi devam eden telefonlar</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-9 animate-pulse rounded-md bg-surface-2" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title="Garantisi devam eden telefon yok"
            description="Alış ekranında (F2) üretici garantisini girin; kalan süre burada takip edilir."
          />
        ) : (
          <table className="w-full text-[13px]">
            <thead className="sticky top-0 bg-surface">
              <tr className="border-b border-border text-left text-[11px] uppercase text-fg-muted">
                <th className="px-4 py-2 font-medium">Model</th>
                <th className="px-2 py-2 font-medium">IMEI</th>
                <th className="px-2 py-2 font-medium">Kalan Garanti</th>
                <th className="px-4 py-2 font-medium">Bitiş Tarihi</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const days = remainingDays(r.warranty_until);
                const tone = warrantyTone(days);
                return (
                  <tr
                    key={r.phone_id}
                    onClick={() => openPhoneDrawer(r.phone_id)}
                    className="cursor-pointer border-b border-border/60 transition-colors hover:bg-surface-2/60"
                  >
                    <td className="px-4 py-2.5 font-medium">{r.label}</td>
                    <td className="tabular px-2 py-2.5 font-mono text-xs text-fg-muted">
                      {r.imei1}
                    </td>
                    <td className="px-2 py-2.5">
                      <span
                        className={cn(
                          "tabular inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold",
                          TONE_CLASS[tone]
                        )}
                      >
                        {formatSpan(days)}
                      </span>
                    </td>
                    <td className={cn("tabular px-4 py-2.5", tone === "danger" && "text-destructive")}>
                      {formatDate(r.warranty_until)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
