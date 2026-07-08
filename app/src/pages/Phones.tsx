import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Smartphone, Search } from "lucide-react";
import { select } from "@/lib/db";
import { useUi } from "@/stores/ui";
import { cn } from "@/lib/utils";
import { formatKurus } from "@/lib/money";
import { StatusBadge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { RegionBadge } from "@/components/ui/region-segment";
import { batteryStatus, QUALITY_TONE_CLASS } from "@/lib/quality";
import { PHONE_STATUS_LABELS, type PhoneRow, type PhoneStatus } from "@/types";

const TABS: { key: PhoneStatus | "all"; label: string }[] = [
  { key: "in_stock", label: "Stokta" },
  { key: "reserved", label: "Rezerve" },
  { key: "consigned", label: "Konsinye" },
  { key: "scrap", label: "Hurda" },
  { key: "all", label: "Tümü" },
];

export function PhonesPage() {
  const [tab, setTab] = useState<PhoneStatus | "all">("in_stock");
  const [search, setSearch] = useState("");
  const { openPhoneDrawer, openQuickPurchase } = useUi();

  const { data: counts = [] } = useQuery({
    queryKey: ["phone-counts"],
    queryFn: () =>
      select<{ status: PhoneStatus; n: number }>(
        "SELECT status, COUNT(*) AS n FROM phones WHERE deleted_at IS NULL AND status != 'sold' GROUP BY status"
      ),
  });
  const countOf = (k: PhoneStatus | "all") =>
    k === "all"
      ? counts.reduce((s, c) => s + c.n, 0)
      : (counts.find((c) => c.status === k)?.n ?? 0);

  const { data: phones = [], isLoading } = useQuery({
    queryKey: ["phones", tab, search],
    queryFn: () =>
      select<PhoneRow>(
        `SELECT p.id, p.imei1, p.imei2, b.name AS brand_name, p.model AS model_name,
                p.color, p.storage_gb, p.cosmetic_grade, p.battery_health,
                p.status, p.ownership, p.region,
                (SELECT c.total_cost FROM v_phone_cost c WHERE c.acquisition_id = p.current_acquisition_id) AS total_cost,
                (SELECT MAX(t.date) FROM v_phone_timeline t WHERE t.phone_id = p.id) AS last_event_at
         FROM phones p
         LEFT JOIN brands b ON b.id = p.brand_id
         WHERE p.deleted_at IS NULL
           AND p.status != 'sold'
           AND ($1 = 'all' OR p.status = $1)
           AND ($2 = '' OR p.imei1 LIKE $3 OR (b.name || ' ' || p.model) LIKE $3 OR p.color LIKE $3)
         ORDER BY p.id DESC LIMIT 500`,
        [tab, search.trim(), `%${search.trim()}%`]
      ),
  });

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-border bg-surface px-4 py-2.5">
        <h1 className="text-sm font-semibold">Telefonlar</h1>
        <div className="relative ml-2 w-64">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-muted" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Bu listede ara…"
            className="h-7 pl-7 text-xs"
          />
        </div>
      </div>

      <div className="flex gap-1 border-b border-border bg-surface px-4">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "cursor-pointer border-b-2 px-2.5 py-2 text-xs font-medium transition-colors",
              tab === key
                ? "border-primary text-primary"
                : "border-transparent text-fg-muted hover:text-fg"
            )}
          >
            {label}
            <span className="ml-1.5 rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] tabular">
              {countOf(key)}
            </span>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-9 animate-pulse rounded-md bg-surface-2" />
            ))}
          </div>
        ) : phones.length === 0 ? (
          <EmptyState
            icon={Smartphone}
            title={search ? "Aramayla eşleşen telefon yok" : "Bu durumda telefon yok"}
            description={
              tab === "in_stock" && !search
                ? "İlk telefonunuzu almak için F2'ye basın."
                : undefined
            }
            action={
              tab === "in_stock" && !search
                ? { label: "Hızlı Alış (F2)", onClick: () => openQuickPurchase() }
                : undefined
            }
          />
        ) : (
          <table className="w-full text-[13px]">
            <thead className="sticky top-0 bg-surface">
              <tr className="border-b border-border text-left text-[11px] uppercase text-fg-muted">
                <th className="px-4 py-2 font-medium">Durum</th>
                <th className="px-2 py-2 font-medium">Model</th>
                <th className="px-2 py-2 font-medium">IMEI</th>
                <th className="px-2 py-2 font-medium">Kozmetik</th>
                <th className="px-2 py-2 font-medium">Pil</th>
                <th className="px-4 py-2 text-right font-medium">Maliyet</th>
              </tr>
            </thead>
            <tbody>
              {phones.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => openPhoneDrawer(p.id)}
                  className="cursor-pointer border-b border-border/60 transition-colors hover:bg-surface-2/60"
                >
                  <td className="px-4 py-2">
                    <StatusBadge status={p.status} label={PHONE_STATUS_LABELS[p.status]} />
                  </td>
                  <td className="px-2 py-2">
                    <span className="font-medium">
                      {p.brand_name} {p.model_name}
                    </span>{" "}
                    <span className="text-fg-muted">
                      {p.storage_gb ? `${p.storage_gb}GB` : ""} {p.color ?? ""}
                    </span>
                    {p.region && <RegionBadge region={p.region} className="ml-1.5" />}
                  </td>
                  <td className="px-2 py-2 font-mono text-xs">
                    <span className="text-fg-muted">{p.imei1.slice(0, 9)}</span>
                    <span className="font-semibold">{p.imei1.slice(9)}</span>
                  </td>
                  <td className="px-2 py-2">{p.cosmetic_grade ?? "—"}</td>
                  <td className="px-2 py-2">
                    {p.battery_health != null ? (
                      <span
                        className={cn(
                          "tabular rounded-full px-1.5 py-0.5 text-[11px] font-semibold",
                          QUALITY_TONE_CLASS[batteryStatus(p.battery_health).tone]
                        )}
                        title={batteryStatus(p.battery_health).label}
                      >
                        %{p.battery_health}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="tabular px-4 py-2 text-right">{formatKurus(p.total_cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
