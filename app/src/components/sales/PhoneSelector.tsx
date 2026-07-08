import { forwardRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { select } from "@/lib/db";
import { Input } from "@/components/ui/input";
import { PhoneCard } from "./PhoneCard";
import type { StockPhone } from "./types";
import logo from "@/assets/nevalogo.png";

/** Sol panel: stok arama (IMEI/model/marka/renk) + kart listesi. */
export const PhoneSelector = forwardRef<
  HTMLInputElement,
  {
    search: string;
    onSearch: (v: string) => void;
    selectedId: number | null;
    onSelect: (p: StockPhone) => void;
  }
>(function PhoneSelector({ search, onSearch, selectedId, onSelect }, searchRef) {
  const { data: phones = [], isLoading } = useQuery({
    queryKey: ["sale-stock", search],
    queryFn: () =>
      select<StockPhone>(
        `SELECT p.id,
                COALESCE(b.name || ' ' || p.model, 'Telefon #' || p.id) AS label,
                p.imei1, p.storage_gb, p.color, p.cosmetic_grade, p.region,
                a.price AS purchase_price, c.total_cost, p.warranty_until
         FROM phones p
         JOIN acquisitions a ON a.id = p.current_acquisition_id
         JOIN v_phone_cost c ON c.acquisition_id = p.current_acquisition_id
         LEFT JOIN brands b ON b.id = p.brand_id
         WHERE p.deleted_at IS NULL AND p.status IN ('in_stock','reserved')
           AND ($1 = '' OR p.imei1 LIKE $2 OR (b.name || ' ' || p.model) LIKE $2
                OR b.name LIKE $2 OR p.color LIKE $2)
         ORDER BY p.id DESC LIMIT 60`,
        [search.trim(), `%${search.trim()}%`]
      ),
  });

  return (
    <section className="flex min-h-0 flex-col rounded-lg border border-border bg-surface">
      <header className="border-b border-border p-3">
        <h2 className="text-[13px] font-semibold">Satılacak Telefon</h2>
        <div className="relative mt-2">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-muted" />
          <Input
            ref={searchRef}
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="IMEI, model, marka veya renk ara…  (Ctrl+F)"
            className="pl-7"
          />
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg bg-surface-2" />
          ))
        ) : phones.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
            <img src={logo} alt="NEVA MOBILE" className="h-10 w-auto opacity-60" />
            <p className="text-sm font-medium">
              {search ? "Aramayla eşleşen telefon yok." : "Satılacak telefon bulunmuyor."}
            </p>
            {!search && (
              <p className="text-xs text-fg-muted">Stok eklemek için F2 ile alış yapın.</p>
            )}
          </div>
        ) : (
          phones.map((p) => (
            <PhoneCard key={p.id} phone={p} selected={selectedId === p.id} onSelect={() => onSelect(p)} />
          ))
        )}
      </div>
    </section>
  );
});
