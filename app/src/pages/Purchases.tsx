import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownToLine, Trash2 } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { select } from "@/lib/db";
import { formatKurus } from "@/lib/money";
import { formatDateTime } from "@/lib/utils";
import { useUi, isReadOnly } from "@/stores/ui";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PAYMENT_LABELS, type PaymentMethod } from "@/types";

interface PurchaseRow {
  id: number;
  date: string;
  phone_id: number;
  label: string;
  imei1: string;
  contact_name: string | null;
  price: number;
  payment_method: PaymentMethod;
}

export function PurchasesPage() {
  const { openPhoneDrawer, openQuickPurchase, toast, license } = useUi();
  const qc = useQueryClient();

  const [deleteTarget, setDeleteTarget] = useState<PurchaseRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data: rows = [] } = useQuery({
    queryKey: ["purchases"],
    queryFn: () =>
      select<PurchaseRow>(
        `SELECT a.id, a.date, a.phone_id, a.price, a.payment_method, p.imei1,
                COALESCE(b.name || ' ' || p.model, 'Telefon #' || p.id) AS label,
                c.full_name AS contact_name
         FROM acquisitions a
         JOIN phones p ON p.id = a.phone_id
         LEFT JOIN brands b ON b.id = p.brand_id
         LEFT JOIN contacts c ON c.id = a.contact_id
         WHERE a.deleted_at IS NULL AND p.status != 'sold'
         ORDER BY a.date DESC LIMIT 300`
      ),
  });

  const handleDeletePurchase = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await invoke("delete_purchase", { acquisitionId: deleteTarget.id });
      toast({ kind: "success", title: "Alış kaydı başarıyla silindi." });

      await qc.invalidateQueries({ queryKey: ["purchases"] });
      await qc.invalidateQueries({ queryKey: ["phones"] });
      await qc.invalidateQueries({ queryKey: ["phone-counts"] });
      await qc.invalidateQueries({ queryKey: ["sale-stock"] });
      await qc.invalidateQueries({ queryKey: ["phone-detail"] });

      setDeleteTarget(null);
    } catch (err) {
      toast({ kind: "error", title: `Alış kaydı silinemedi: ${String(err)}` });
    } finally {
      setDeleting(false);
    }
  };

  const total = rows.reduce((s, r) => s + r.price, 0);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-border bg-surface px-4 py-2.5">
        <h1 className="text-sm font-semibold">Alışlar</h1>
        <span className="text-xs text-fg-muted">
          {rows.length} işlem · toplam <b className="tabular text-fg">{formatKurus(total)}</b>
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {rows.length === 0 ? (
          <EmptyState
            icon={ArrowDownToLine}
            title="Henüz alış yok"
            description="İlk alışınızı kaydedin — telefon kartı otomatik oluşturulur."
            action={isReadOnly(license) ? undefined : { label: "Hızlı Alış (F2)", onClick: () => openQuickPurchase() }}
          />
        ) : (
          <table className="w-full text-[13px]">
            <thead className="sticky top-0 bg-surface">
              <tr className="border-b border-border text-left text-[11px] uppercase text-fg-muted">
                <th className="px-4 py-2 font-medium">Tarih</th>
                <th className="px-2 py-2 font-medium">Telefon</th>
                <th className="px-2 py-2 font-medium">IMEI</th>
                <th className="px-2 py-2 font-medium">Kimden</th>
                <th className="px-2 py-2 font-medium">Ödeme</th>
                <th className="px-4 py-2 text-right font-medium">Tutar</th>
                <th className="px-4 py-2 text-center font-medium w-16">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => openPhoneDrawer(r.phone_id)}
                  className="cursor-pointer border-b border-border/60 transition-colors hover:bg-surface-2/60"
                >
                  <td className="px-4 py-2 text-fg-muted">{formatDateTime(r.date)}</td>
                  <td className="px-2 py-2 font-medium">{r.label}</td>
                  <td className="px-2 py-2 font-mono text-xs text-fg-muted">
                    …{r.imei1.slice(-6)}
                  </td>
                  <td className="px-2 py-2">{r.contact_name ?? "—"}</td>
                  <td className="px-2 py-2 text-fg-muted">{PAYMENT_LABELS[r.payment_method]}</td>
                  <td className="tabular px-4 py-2 text-right font-medium">
                    {formatKurus(r.price)}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(r);
                      }}
                      disabled={isReadOnly(license)}
                      title="Alış kaydını sil"
                      className="cursor-pointer rounded p-1 text-fg-muted hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-30 disabled:pointer-events-none"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* CONFIRM DELETE DIALOG */}
      <Dialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Alış Kaydını Sil"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              İptal
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeletePurchase}
              disabled={deleting}
              className="min-w-[80px]"
            >
              {deleting ? "Siliniyor..." : "Kalıcı Olarak Sil"}
            </Button>
          </>
        }
      >
        <p className="text-xs text-fg-muted leading-relaxed">
          Bu alış kaydını kalıcı olarak silmek istediğinizden emin misiniz?
        </p>
        {deleteTarget && (
          <div className="mt-3 rounded-md bg-surface-2 p-3 text-xs space-y-1.5 border border-border">
            <p>
              <span className="text-fg-muted">Telefon:</span> <b>{deleteTarget.label}</b>
            </p>
            <p>
              <span className="text-fg-muted">IMEI:</span> <code className="font-mono text-primary">{deleteTarget.imei1}</code>
            </p>
            <p>
              <span className="text-fg-muted">Tutar:</span> <b className="font-mono">{formatKurus(deleteTarget.price)}</b>
            </p>
            <p>
              <span className="text-fg-muted">Satıcı:</span> <b>{deleteTarget.contact_name ?? "—"}</b>
            </p>
            <p>
              <span className="text-fg-muted">İşlem Tarihi:</span> <b>{formatDateTime(deleteTarget.date)}</b>
            </p>
          </div>
        )}
        <p className="mt-3 text-xs text-destructive font-medium">
          Dikkat: Bu işlem geri alınamaz! İlgili kasa çıkışı, masraf ve kalite kontrol kayıtları da sistemden kalıcı olarak silinecektir. Cihaza ait başka bir alış kaydı bulunmuyorsa telefon da sistemden kalıcı olarak silinir.
        </p>
      </Dialog>
    </div>
  );
}
