import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { HandCoins, ArrowDownUp } from "lucide-react";
import { select } from "@/lib/db";
import { formatKurus, parseLiraInput } from "@/lib/money";
import { useUi, isReadOnly } from "@/stores/ui";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Field } from "@/components/ui/input";

interface PendingRow {
  id: number;
  phone_id: number;
  customer_name: string | null;
  customer_phone: string | null;
  label: string;
  price: number;
  amount_paid: number;
  remaining: number;
}

/** Eksik ödemeyle satılan telefonların bekleyen alacaklarını listeler. */
export function PendingPaymentsPage() {
  const { openPhoneDrawer, toast, license } = useUi();
  const qc = useQueryClient();
  const readOnly = isReadOnly(license);
  const [sortAsc, setSortAsc] = useState(false);

  const [target, setTarget] = useState<PendingRow | null>(null);
  const [amountRaw, setAmountRaw] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["pending-payments", sortAsc],
    queryFn: () =>
      select<PendingRow>(
        `SELECT s.id, s.phone_id,
                COALESCE(s.contact_name, c.full_name) AS customer_name,
                COALESCE(s.contact_phone, c.phone_number) AS customer_phone,
                COALESCE(b.name || ' ' || p.model, 'Telefon #' || p.id) AS label,
                s.price, s.amount_paid, (s.price - s.amount_paid) AS remaining
         FROM sales s
         JOIN phones p ON p.id = s.phone_id
         LEFT JOIN brands b ON b.id = p.brand_id
         LEFT JOIN contacts c ON c.id = s.contact_id
         WHERE s.deleted_at IS NULL AND s.amount_paid < s.price
         ORDER BY remaining ${sortAsc ? "ASC" : "DESC"}`
      ),
  });

  const totalRemaining = rows.reduce((s, r) => s + r.remaining, 0);
  const amount = parseLiraInput(amountRaw);
  const canSave = target !== null && amount !== null && amount > 0 && amount <= target.remaining && !saving;

  function openDialog(row: PendingRow) {
    setTarget(row);
    setAmountRaw(String(row.remaining / 100));
  }

  async function save() {
    if (!canSave || !target || amount === null) return;
    setSaving(true);
    try {
      await invoke("record_payment", { saleId: target.id, amount });
      toast({ kind: "success", title: "Ödeme kaydedildi." });
      await qc.invalidateQueries({ queryKey: ["pending-payments"] });
      await qc.invalidateQueries({ queryKey: ["sales"] });
      await qc.invalidateQueries({ queryKey: ["dashboard-kpis"] });
      setTarget(null);
      setAmountRaw("");
    } catch (e) {
      toast({ kind: "error", title: `Ödeme kaydedilemedi: ${String(e)}` });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border bg-surface px-4 py-2.5">
        <HandCoins size={15} className="text-primary" strokeWidth={1.75} />
        <h1 className="text-sm font-semibold">Bekleyen Ödemeler</h1>
        {rows.length > 0 && (
          <span className="text-xs text-fg-muted">
            {rows.length} kayıt · toplam bekleyen tahsilat{" "}
            <b className="tabular text-fg">{formatKurus(totalRemaining)}</b>
          </span>
        )}
        <div className="flex-1" />
        <button
          onClick={() => setSortAsc((v) => !v)}
          className="flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-fg-muted hover:bg-surface-2 hover:text-fg"
        >
          <ArrowDownUp size={11} />
          {sortAsc ? "Borç: Düşük → Yüksek" : "Borç: Yüksek → Düşük"}
        </button>
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
            icon={HandCoins}
            title="Bekleyen ödeme yok"
            description="Tüm satışlar tam tahsil edilmiş görünüyor."
          />
        ) : (
          <table className="w-full text-[13px]">
            <thead className="sticky top-0 bg-surface">
              <tr className="border-b border-border text-left text-[11px] uppercase text-fg-muted">
                <th className="px-4 py-2 font-medium">Ad Soyad</th>
                <th className="px-2 py-2 font-medium">Telefon Numarası</th>
                <th className="px-2 py-2 font-medium">Satılan Telefon</th>
                <th className="px-2 py-2 text-right font-medium">Toplam Satış</th>
                <th className="px-2 py-2 text-right font-medium">Ödenen Tutar</th>
                <th className="px-4 py-2 text-right font-medium">Kalan Alacak</th>
                <th className="px-4 py-2 text-center font-medium w-32">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-border/60 transition-colors hover:bg-surface-2/60"
                >
                  <td
                    className="cursor-pointer px-4 py-2 font-medium"
                    onClick={() => openPhoneDrawer(r.phone_id)}
                  >
                    {r.customer_name ?? "—"}
                  </td>
                  <td className="px-2 py-2 font-mono text-xs text-fg-muted">
                    {r.customer_phone ?? "—"}
                  </td>
                  <td
                    className="cursor-pointer px-2 py-2 text-fg-muted"
                    onClick={() => openPhoneDrawer(r.phone_id)}
                  >
                    {r.label}
                  </td>
                  <td className="tabular px-2 py-2 text-right">{formatKurus(r.price)}</td>
                  <td className="tabular px-2 py-2 text-right text-success">
                    {formatKurus(r.amount_paid)}
                  </td>
                  <td className="tabular px-4 py-2 text-right font-semibold text-destructive">
                    {formatKurus(r.remaining)}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={readOnly}
                      onClick={() => openDialog(r)}
                    >
                      Ödeme Al
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog
        open={target !== null}
        onClose={() => setTarget(null)}
        title="Ödeme Al"
        footer={
          <>
            <Button variant="ghost" onClick={() => setTarget(null)}>
              Vazgeç
            </Button>
            <Button variant="primary" disabled={!canSave} onClick={save}>
              {saving ? "Kaydediliyor…" : "Tahsilatı Kaydet"}
            </Button>
          </>
        }
      >
        {target && (
          <div className="space-y-3">
            <p className="text-xs text-fg-muted">
              <b className="text-fg">{target.customer_name ?? "Müşteri"}</b> — {target.label}
              <br />
              Kalan alacak: <b className="text-destructive">{formatKurus(target.remaining)}</b>
            </p>
            <Field
              label="Alınan Ödeme (₺)"
              error={
                amount !== null && amount > target.remaining
                  ? "Kalan alacaktan fazla olamaz"
                  : null
              }
            >
              <Input
                autoFocus
                value={amountRaw}
                onChange={(e) => setAmountRaw(e.target.value.replace(/[^\d.,]/g, ""))}
                inputMode="decimal"
                className="tabular font-mono"
              />
            </Field>
          </div>
        )}
      </Dialog>
    </div>
  );
}
