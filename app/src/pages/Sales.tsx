import { useState, useRef, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpFromLine, Search, Plus, Trash2, FileText } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { select } from "@/lib/db";
import { formatKurus, parseLiraInput } from "@/lib/money";
import { normalizePhone } from "@/lib/phone-format";
import { formatDateTime, cn } from "@/lib/utils";
import { useUi, isReadOnly } from "@/stores/ui";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Field } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

// Sales-specific sub-components
import { PhoneSelector } from "@/components/sales/PhoneSelector";
import { SaleSummary } from "@/components/sales/SaleSummary";
import { CustomerForm } from "@/components/sales/CustomerForm";
import { PaymentSelector } from "@/components/sales/PaymentSelector";
import { ProfitCard } from "@/components/sales/ProfitCard";
import { SaleActions } from "@/components/sales/SaleActions";
import { CommissionInput, parseCommissionRaw } from "@/components/sales/CommissionInput";
import { generateReceiptPdf } from "@/lib/receipt-pdf";
import {
  SALE_PAYMENT_LABELS,
  type StockPhone,
  type SalePayment,
  type CommissionMode,
  toDbPayment,
  calcCommissionAmount,
} from "@/components/sales/types";

interface SaleRow {
  id: number;
  date: string;
  phone_id: number;
  label: string;
  imei1: string;
  customer_name: string | null;
  payment_method: string;
  price: number;
  commission_amount: number;
  net_profit: number;
  warranty_months: number | null;
  warranty_type: string | null;
}

export function SalesPage() {
  const { openPhoneDrawer, toast, license } = useUi();
  const qc = useQueryClient();

  const location = useLocation();
  // Mode state: 'list' (shows previous sales) or 'checkout' (records a new sale)
  const [viewMode, setViewMode] = useState<"list" | "checkout">("list");

  useEffect(() => {
    const state = location.state as { mode?: string; phoneId?: number } | null;
    if (state?.mode === "checkout") {
      setViewMode("checkout");
      if (state.phoneId != null) {
        select<StockPhone>(
          `SELECT p.id,
                  COALESCE(b.name || ' ' || p.model, 'Telefon #' || p.id) AS label,
                  p.imei1, p.storage_gb, p.color, p.cosmetic_grade, p.region,
                  a.price AS purchase_price, c.total_cost, p.warranty_until
           FROM phones p
           JOIN acquisitions a ON a.id = p.current_acquisition_id
           JOIN v_phone_cost c ON c.acquisition_id = p.current_acquisition_id
           LEFT JOIN brands b ON b.id = p.brand_id
           WHERE p.id = $1`,
          [state.phoneId]
        ).then((rows) => {
          if (rows[0]) {
            setSelectedPhone(rows[0]);
            setPriceRaw(String(rows[0].total_cost / 100));
          }
        });
      }
    }
  }, [location]);

  // --- List View States ---
  const [listSearch, setListSearch] = useState("");

  // --- Checkout View States ---
  const [phoneSearch, setPhoneSearch] = useState("");
  const [selectedPhone, setSelectedPhone] = useState<StockPhone | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [priceRaw, setPriceRaw] = useState("");
  const [payment, setPayment] = useState<SalePayment>("cash");
  const [commissionMode, setCommissionMode] = useState<CommissionMode>("percent");
  const [commissionRaw, setCommissionRaw] = useState("");
  const [saving, setSaving] = useState(false);

  // --- Delete Modal States ---
  const [deleteTarget, setDeleteTarget] = useState<SaleRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const phoneSearchInputRef = useRef<HTMLInputElement>(null);

  // Global hotkeys inside checkout
  useEffect(() => {
    if (viewMode !== "checkout") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Esc: clear selected phone or return to list
      if (e.key === "Escape") {
        e.preventDefault();
        if (selectedPhone) {
          setSelectedPhone(null);
        } else {
          setViewMode("list");
        }
      }
      // Ctrl+F: focus phone search input
      if (e.ctrlKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        phoneSearchInputRef.current?.focus();
      }
      // Enter (Return): trigger save sale if conditions met
      if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.altKey) {
        // Only trigger if focus is not in textarea
        const active = document.activeElement;
        if (active && active.tagName !== "TEXTAREA") {
          const price = parseLiraInput(priceRaw);
          const hasSelected = !!selectedPhone;
          const priceValid = price !== null && price > 0;
          if (hasSelected && priceValid && !saving && !isReadOnly(license)) {
            e.preventDefault();
            void handleSaveSale();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [viewMode, selectedPhone, priceRaw, saving, license, customerName, customerPhone, notes, payment]);

  // Fetch sales list
  const { data: rows = [], isLoading: isListLoading } = useQuery({
    queryKey: ["sales", listSearch],
    queryFn: () =>
      select<SaleRow>(
        `SELECT s.id, s.date, s.phone_id, s.price, s.payment_method, s.commission_amount, p.imei1,
                COALESCE(b.name || ' ' || p.model, 'Telefon #' || p.id) AS label,
                COALESCE(s.contact_name, c.full_name) AS customer_name,
                vp.net_profit,
                w.months AS warranty_months, w.type AS warranty_type
         FROM sales s
         JOIN phones p ON p.id = s.phone_id
         LEFT JOIN brands b ON b.id = p.brand_id
         LEFT JOIN contacts c ON c.id = s.contact_id
         LEFT JOIN v_phone_profit vp ON vp.sale_id = s.id
         LEFT JOIN warranties w ON w.sale_id = s.id AND w.voided_at IS NULL
         WHERE s.deleted_at IS NULL
           AND ($1 = '' OR p.imei1 LIKE $2 OR (b.name || ' ' || p.model) LIKE $2 OR c.full_name LIKE $2)
         ORDER BY s.date DESC LIMIT 300`,
        [listSearch.trim(), `%${listSearch.trim()}%`]
      ),
  });

  const totalCiro = rows.reduce((s, r) => s + r.price, 0);
  const totalProfit = rows.reduce((s, r) => s + r.net_profit, 0);

  const getPaymentLabel = (method: string) => {
    if (method === "cash") return "Nakit";
    if (method === "pos") return "POS";
    if (method === "transfer") return "Havale";
    if (method === "credit_card") return "Kredi Kartı";
    if (method === "mixed") return "Karma";
    if (method === "installment") return "Taksit";
    return method;
  };

  const handleSaveSale = async () => {
    if (isReadOnly(license)) {
      toast({ kind: "error", title: "Salt okunur modda satış kaydedilemez." });
      return;
    }

    const price = parseLiraInput(priceRaw);
    if (!selectedPhone) {
      toast({ kind: "error", title: "Lütfen satılacak telefonu seçin." });
      return;
    }
    if (!price || price <= 0) {
      toast({ kind: "error", title: "Lütfen geçerli bir satış fiyatı girin." });
      return;
    }

    const hasCommission = payment === "pos" && commissionRaw.trim() !== "";
    const commissionValue = hasCommission ? parseCommissionRaw(commissionMode, commissionRaw) : null;

    setSaving(true);
    try {
      await invoke("save_sale", {
        args: {
          phoneId: selectedPhone.id,
          price: price,
          paymentMethod: toDbPayment(payment),
          paymentLabel: SALE_PAYMENT_LABELS[payment],
          customerName: customerName.trim() || null,
          customerPhone: customerPhone.trim() ? normalizePhone(customerPhone) : null,
          notes: notes.trim() || null,
          commissionType: hasCommission ? commissionMode : null,
          commissionValue: commissionValue,
        },
      });

      toast({ kind: "success", title: "Satış başarıyla kaydedildi." });

      // Invalidate queries
      await qc.invalidateQueries({ queryKey: ["sales"] });
      await qc.invalidateQueries({ queryKey: ["phones"] });
      await qc.invalidateQueries({ queryKey: ["phone-counts"] });
      await qc.invalidateQueries({ queryKey: ["sale-stock"] });
      await qc.invalidateQueries({ queryKey: ["phone-detail"] });

      // Reset state and exit checkout view
      setSelectedPhone(null);
      setCustomerName("");
      setCustomerPhone("");
      setNotes("");
      setPriceRaw("");
      setPayment("cash");
      setCommissionMode("percent");
      setCommissionRaw("");
      setPhoneSearch("");
      setViewMode("list");
    } catch (err) {
      toast({ kind: "error", title: `Satış kaydedilemedi: ${String(err)}` });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSale = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await invoke("delete_sale", { saleId: deleteTarget.id });
      toast({ kind: "success", title: "Satış kaydı başarıyla silindi." });

      await qc.invalidateQueries({ queryKey: ["sales"] });
      await qc.invalidateQueries({ queryKey: ["phones"] });
      await qc.invalidateQueries({ queryKey: ["phone-counts"] });
      await qc.invalidateQueries({ queryKey: ["sale-stock"] });
      await qc.invalidateQueries({ queryKey: ["phone-detail"] });

      setDeleteTarget(null);
    } catch (err) {
      toast({ kind: "error", title: `Satış kaydı silinemedi: ${String(err)}` });
    } finally {
      setDeleting(false);
    }
  };

  const salePrice = parseLiraInput(priceRaw);
  const commissionAmount =
    payment === "pos" && commissionRaw.trim() !== "" && salePrice != null
      ? calcCommissionAmount(commissionMode, parseCommissionRaw(commissionMode, commissionRaw), salePrice)
      : 0;

  return (
    <div className="flex h-full flex-col">
      {/* HEADER BAR */}
      <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-2.5">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold">Satışlar</h1>
          {viewMode === "list" && (
            <span className="text-xs text-fg-muted">
              {rows.length} işlem · ciro <b className="tabular text-fg">{formatKurus(totalCiro)}</b> · net kar{" "}
              <b className={cn("tabular", totalProfit >= 0 ? "text-success" : "text-destructive")}>
                {formatKurus(totalProfit)}
              </b>
            </span>
          )}
        </div>

        {viewMode === "list" ? (
          <Button
            variant="primary"
            onClick={() => setViewMode("checkout")}
            disabled={isReadOnly(license)}
            className="h-7 text-xs px-3"
          >
            <Plus size={14} className="mr-1" /> Yeni Satış Yap
          </Button>
        ) : (
          <Button variant="secondary" onClick={() => setViewMode("list")} className="h-7 text-xs px-3">
            Satış Listesine Dön
          </Button>
        )}
      </div>

      {/* VIEW MODES */}
      {viewMode === "list" ? (
        // --- LIST VIEW ---
        <div className="flex flex-1 flex-col min-h-0">
          <div className="border-b border-border bg-surface px-4 py-2 flex items-center justify-between">
            <div className="relative w-72">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-muted" />
              <Input
                value={listSearch}
                onChange={(e) => setListSearch(e.target.value)}
                placeholder="IMEI, model veya müşteri ara…"
                className="h-7 pl-7 text-xs"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isListLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-9 animate-pulse rounded-md bg-surface-2" />
                ))}
              </div>
            ) : rows.length === 0 ? (
              <EmptyState
                icon={ArrowUpFromLine}
                title="Henüz satış yok"
                description="Kayıtlı satışınız bulunmuyor. Yeni bir satış oluşturarak başlayın."
                action={
                  isReadOnly(license)
                    ? undefined
                    : { label: "Yeni Satış Yap", onClick: () => setViewMode("checkout") }
                }
              />
            ) : (
              <table className="w-full text-[13px]">
                <thead className="sticky top-0 bg-surface">
                  <tr className="border-b border-border text-left text-[11px] uppercase text-fg-muted">
                    <th className="px-4 py-2 font-medium">Tarih</th>
                    <th className="px-2 py-2 font-medium">Telefon</th>
                    <th className="px-2 py-2 font-medium">IMEI</th>
                    <th className="px-2 py-2 font-medium">Müşteri</th>
                    <th className="px-2 py-2 font-medium">Ödeme</th>
                    <th className="px-2 py-2 text-right font-medium">Kar</th>
                    <th className="px-4 py-2 text-right font-medium">Satış Tutarı</th>
                    <th className="px-4 py-2 text-center font-medium w-20">İşlem</th>
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
                      <td className="px-2 py-2">{r.customer_name ?? "—"}</td>
                      <td className="px-2 py-2 text-fg-muted">{getPaymentLabel(r.payment_method)}</td>
                      <td
                        className={cn(
                          "tabular px-2 py-2 text-right font-medium",
                          r.net_profit >= 0 ? "text-success" : "text-destructive"
                        )}
                      >
                        {formatKurus(r.net_profit)}
                      </td>
                      <td className="tabular px-4 py-2 text-right font-semibold text-fg">
                        {formatKurus(r.price)}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              generateReceiptPdf({
                                saleId: r.id,
                                model: r.label,
                                imei: r.imei1,
                                date: r.date,
                                price: r.price,
                                paymentLabel: getPaymentLabel(r.payment_method),
                                commissionAmount: r.commission_amount,
                                warrantyText: r.warranty_months
                                  ? `${r.warranty_months} ay (${r.warranty_type ?? "store"})`
                                  : null,
                                buyerName: r.customer_name,
                              })
                                .then((saved) => {
                                  if (saved) {
                                    toast({ kind: "success", title: "PDF satış fişi oluşturuldu." });
                                  }
                                })
                                .catch((err) =>
                                  toast({ kind: "error", title: `PDF oluşturulamadı: ${String(err)}` })
                                );
                            }}
                            title="PDF Satış Fişi Oluştur"
                            className="cursor-pointer rounded p-1 text-fg-muted hover:bg-primary/10 hover:text-primary transition-colors"
                          >
                            <FileText size={14} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget(r);
                            }}
                            disabled={isReadOnly(license)}
                            title="Satış kaydını sil"
                            className="cursor-pointer rounded p-1 text-fg-muted hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-30 disabled:pointer-events-none"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : (
        // --- CHECKOUT VIEW ---
        <div className="flex flex-1 min-h-0 overflow-hidden bg-surface-2/20">
          {/* LEFT PANEL: Phone Search and Selector */}
          <div className="w-[45%] flex flex-col min-h-0 border-r border-border p-4">
            <PhoneSelector
              ref={phoneSearchInputRef}
              search={phoneSearch}
              onSearch={setPhoneSearch}
              selectedId={selectedPhone?.id ?? null}
              onSelect={(p) => {
                setSelectedPhone(p);
                // Pre-fill price suggestions if available (e.g. total cost)
                if (!priceRaw) {
                  setPriceRaw(String(p.total_cost / 100));
                }
              }}
            />
          </div>

          {/* RIGHT PANEL: Form Inputs, Profit Calculations, Actions */}
          <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-4 space-y-4">
            {/* selected phone summary banner */}
            <SaleSummary phone={selectedPhone} onClear={() => setSelectedPhone(null)} />

            {selectedPhone && (
              <div className="space-y-4 rounded-lg border border-border bg-surface p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-fg-muted">Müşteri Bilgileri</h3>
                <CustomerForm
                  name={customerName}
                  phone={customerPhone}
                  note={notes}
                  onName={setCustomerName}
                  onPhone={setCustomerPhone}
                  onNote={setNotes}
                />
              </div>
            )}

            {selectedPhone && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-4 rounded-lg border border-border bg-surface p-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-fg-muted">Ödeme Bilgileri</h3>
                  <Field label="Satış Fiyatı (₺)" hint="Kuruş hesabı için küsuratsız veya virgüllü yazabilirsiniz">
                    <Input
                      value={priceRaw}
                      onChange={(e) => setPriceRaw(e.target.value.replace(/[^\d.,]/g, ""))}
                      placeholder="15.000"
                      inputMode="decimal"
                      className="tabular font-mono text-[13px]"
                    />
                  </Field>

                  <Field label="Ödeme Türü">
                    <PaymentSelector value={payment} onChange={setPayment} />
                  </Field>

                  {payment === "pos" && (
                    <CommissionInput
                      mode={commissionMode}
                      raw={commissionRaw}
                      onMode={setCommissionMode}
                      onRaw={setCommissionRaw}
                    />
                  )}
                </div>

                <ProfitCard phone={selectedPhone} salePrice={salePrice} commissionAmount={commissionAmount} />
              </div>
            )}

            {selectedPhone && (
              <div className="border-t border-border pt-4">
                <SaleActions
                  canSave={!!selectedPhone && salePrice !== null && salePrice > 0 && !saving && !isReadOnly(license)}
                  saving={saving}
                  onSave={handleSaveSale}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* CONFIRM DELETE DIALOG */}
      <Dialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Satış Kaydını Sil"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              İptal
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteSale}
              disabled={deleting}
              className="min-w-[80px]"
            >
              {deleting ? "Siliniyor..." : "Kalıcı Olarak Sil"}
            </Button>
          </>
        }
      >
        <p className="text-xs text-fg-muted leading-relaxed">
          Bu satış kaydını kalıcı olarak silmek istediğinizden emin misiniz?
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
              <span className="text-fg-muted">Satış Tutarı:</span> <b className="font-mono">{formatKurus(deleteTarget.price)}</b>
            </p>
            <p>
              <span className="text-fg-muted">Müşteri:</span> <b>{deleteTarget.customer_name ?? "—"}</b>
            </p>
            <p>
              <span className="text-fg-muted">İşlem Tarihi:</span> <b>{formatDateTime(deleteTarget.date)}</b>
            </p>
          </div>
        )}
        <p className="mt-3 text-xs text-destructive font-medium">
          Dikkat: Bu işlem geri alınamaz! İlgili kasa girişi, cari bakiye kayıtları ve garanti kayıtları da sistemden kalıcı olarak temizlenecektir.
        </p>
      </Dialog>
    </div>
  );
}
