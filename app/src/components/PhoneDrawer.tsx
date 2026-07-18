import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import {
  X,
  Copy,
  ArrowDownToLine,
  ArrowUpFromLine,
  ShieldAlert,
  Receipt,
  Puzzle,
  Undo2,
  CalendarClock,
  MessageCircle,
  IdCard,
  Trash2,
  Pencil,
  Check,
  Tag,
} from "lucide-react";
import { selectOne, select } from "@/lib/db";
import { useUi, isReadOnly } from "@/stores/ui";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import { formatKurus, formatKurusPrivate } from "@/lib/money";
import { remainingDays, formatSpan } from "@/lib/warranty";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { RegionBadge } from "@/components/ui/region-segment";
import { PhoneQuality } from "@/components/PhoneQuality";
import { PeopleTab } from "@/components/PeopleTab";
import { ExpenseSection } from "@/components/ExpenseSection";
import { WhatsAppShareDialog } from "@/components/WhatsAppShareDialog";
import { ImeiCopyDialog } from "@/components/ImeiCopyDialog";
import {
  PHONE_STATUS_LABELS,
  TIMELINE_LABELS,
  type CosmeticGrade,
  type PhoneStatus,
  type Region,
  type TimelineEvent,
} from "@/types";

interface PhoneDetail {
  id: number;
  imei1: string | null;
  imei2: string | null;
  brand_name: string | null;
  model_name: string | null;
  color: string | null;
  storage_gb: number | null;
  serial_no: string | null;
  cosmetic_grade: CosmeticGrade | null;
  battery_health: number | null;
  status: PhoneStatus;
  region: Region | null;
  warranty_until: string | null;
  notes: string | null;
  total_cost: number | null;
  purchase_price: number | null;
  current_acquisition_id: number | null;
  etiket_numarasi: string | null;
}

const EVENT_ICONS: Record<TimelineEvent["event_type"], typeof Receipt> = {
  acquisition: ArrowDownToLine,
  sale: ArrowUpFromLine,
  expense: Receipt,
  part: Puzzle,
  warranty_return: ShieldAlert,
  return: Undo2,
  reservation: CalendarClock,
};

const EVENT_COLOR: Record<TimelineEvent["event_type"], string> = {
  acquisition: "text-success",
  sale: "text-secondary",
  expense: "text-destructive",
  part: "text-warning",
  warranty_return: "text-warning",
  return: "text-destructive",
  reservation: "text-fg-muted",
};

export function PhoneDrawer() {
  const { phoneDrawerId, closePhoneDrawer, toast, license, privacyMode } = useUi();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"summary" | "people" | "timeline">("summary");
  const [shareOpen, setShareOpen] = useState(false);
  const [imeiOpen, setImeiOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [tagEditing, setTagEditing] = useState(false);
  const [tagValue, setTagValue] = useState("");
  const [tagSaving, setTagSaving] = useState(false);
  const [imeiEditing, setImeiEditing] = useState(false);
  const [imeiEditValue, setImeiEditValue] = useState("");
  const [imeiEditSaving, setImeiEditSaving] = useState(false);
  const open = phoneDrawerId !== null;
  const readOnly = isReadOnly(license);

  useEffect(() => {
    if (open) setTab("summary");
    setShareOpen(false);
    setImeiOpen(false);
    setDeleteOpen(false);
    setTagEditing(false);
    setImeiEditing(false);
  }, [open, phoneDrawerId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePhoneDrawer();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closePhoneDrawer]);

  const { data: phone } = useQuery({
    queryKey: ["phone-detail", phoneDrawerId],
    enabled: open,
    queryFn: () =>
      selectOne<PhoneDetail>(
        `SELECT p.*, b.name AS brand_name, p.model AS model_name,
                (SELECT c.total_cost FROM v_phone_cost c WHERE c.acquisition_id = p.current_acquisition_id) AS total_cost,
                (SELECT a.price FROM acquisitions a WHERE a.id = p.current_acquisition_id) AS purchase_price
         FROM phones p
         LEFT JOIN brands b ON b.id = p.brand_id
         WHERE p.id = $1`,
        [phoneDrawerId]
      ),
  });

  const { data: timeline = [] } = useQuery({
    queryKey: ["phone-timeline", phoneDrawerId],
    enabled: open && tab === "timeline",
    queryFn: () =>
      select<TimelineEvent>(
        "SELECT * FROM v_phone_timeline WHERE phone_id = $1 ORDER BY date DESC",
        [phoneDrawerId]
      ),
  });

  function goToSale() {
    if (!phone) return;
    closePhoneDrawer();
    navigate("/satislar", { state: { mode: "checkout", phoneId: phone.id } });
  }

  async function saveTag() {
    if (!phone || tagSaving) return;
    setTagSaving(true);
    try {
      await invoke("update_phone_tag", {
        phoneId: phone.id,
        etiketNumarasi: tagValue.trim() || null,
      });
      await qc.invalidateQueries({ queryKey: ["phone-detail", phone.id] });
      await qc.invalidateQueries({ queryKey: ["phones"] });
      setTagEditing(false);
      toast({ kind: "success", title: "Etiket numarası güncellendi" });
    } catch (e) {
      toast({ kind: "error", title: `Kaydedilemedi: ${String(e)}` });
    } finally {
      setTagSaving(false);
    }
  }

  async function saveImei() {
    if (!phone || imeiEditSaving) return;
    setImeiEditSaving(true);
    try {
      await invoke("update_phone_imei", {
        phoneId: phone.id,
        imei1: imeiEditValue.replace(/\D/g, "").trim() || null,
      });
      await qc.invalidateQueries({ queryKey: ["phone-detail", phone.id] });
      await qc.invalidateQueries({ queryKey: ["phones"] });
      setImeiEditing(false);
      toast({ kind: "success", title: "IMEI güncellendi" });
    } catch (e) {
      toast({ kind: "error", title: `Kaydedilemedi: ${String(e)}` });
    } finally {
      setImeiEditSaving(false);
    }
  }

  async function handleDelete() {
    if (!phone?.current_acquisition_id || deleting) return;
    setDeleting(true);
    try {
      await invoke("delete_purchase", { acquisitionId: phone.current_acquisition_id });
      toast({ kind: "success", title: "Telefon kaydı silindi." });
      await qc.invalidateQueries({ queryKey: ["phones"] });
      await qc.invalidateQueries({ queryKey: ["phone-counts"] });
      await qc.invalidateQueries({ queryKey: ["sale-stock"] });
      setDeleteOpen(false);
      closePhoneDrawer();
    } catch (e) {
      toast({ kind: "error", title: `Silinemedi: ${String(e)}` });
    } finally {
      setDeleting(false);
    }
  }

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={closePhoneDrawer} />
      <aside className="fixed inset-y-0 right-0 z-40 flex w-[440px] flex-col border-l border-border bg-surface shadow-2xl animate-in slide-in-from-right duration-200">
        {phone ? (
          <>
            <header className="border-b border-border px-4 py-3">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-sm font-semibold">
                    {phone.brand_name} {phone.model_name}{" "}
                    <span className="font-normal text-fg-muted">
                      {phone.storage_gb ? `${phone.storage_gb}GB` : ""} {phone.color ?? ""}
                    </span>
                  </h2>
                  {!imeiEditing ? (
                    <div className="mt-1 flex items-center gap-1">
                      {phone.imei1 ? (
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(phone.imei1!);
                            toast({ kind: "info", title: "IMEI kopyalandı" });
                          }}
                          className="inline-flex cursor-pointer items-center gap-1 font-mono text-xs text-fg-muted hover:text-fg"
                          title="Kopyala"
                        >
                          {phone.imei1} <Copy size={11} />
                        </button>
                      ) : (
                        <span className="text-xs text-fg-muted">IMEI girilmemiş</span>
                      )}
                      {!readOnly && (
                        <button
                          onClick={() => {
                            setImeiEditValue(phone.imei1 ?? "");
                            setImeiEditing(true);
                          }}
                          className="cursor-pointer rounded p-0.5 text-fg-muted hover:bg-surface-2 hover:text-fg"
                          title="IMEI'yi düzenle"
                        >
                          <Pencil size={10} />
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="mt-1 flex items-center gap-1">
                      <input
                        autoFocus
                        value={imeiEditValue}
                        onChange={(e) => setImeiEditValue(e.target.value.replace(/\D/g, "").slice(0, 15))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void saveImei();
                          if (e.key === "Escape") setImeiEditing(false);
                        }}
                        placeholder="15 haneli IMEI"
                        className="h-6 w-32 rounded border border-border-strong bg-surface px-1.5 font-mono text-xs focus:border-primary focus:outline-none"
                      />
                      <button
                        onClick={saveImei}
                        disabled={imeiEditSaving}
                        className="cursor-pointer rounded p-0.5 text-success hover:bg-success/10 disabled:opacity-50"
                        title="Kaydet"
                      >
                        <Check size={12} />
                      </button>
                      <button
                        onClick={() => setImeiEditing(false)}
                        className="cursor-pointer rounded p-0.5 text-fg-muted hover:bg-surface-2"
                        title="Vazgeç"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )}

                  {!tagEditing ? (
                    <div className="mt-1 flex items-center gap-1">
                      <Tag size={11} className="text-fg-muted" />
                      {phone.etiket_numarasi ? (
                        <span className="font-mono text-xs">{phone.etiket_numarasi}</span>
                      ) : (
                        <span className="text-xs text-fg-muted">Etiket yok</span>
                      )}
                      {!readOnly && (
                        <button
                          onClick={() => {
                            setTagValue(phone.etiket_numarasi ?? "");
                            setTagEditing(true);
                          }}
                          className="cursor-pointer rounded p-0.5 text-fg-muted hover:bg-surface-2 hover:text-fg"
                          title="Etiket numarasını düzenle"
                        >
                          <Pencil size={10} />
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="mt-1 flex items-center gap-1">
                      <input
                        autoFocus
                        value={tagValue}
                        onChange={(e) => setTagValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void saveTag();
                          if (e.key === "Escape") setTagEditing(false);
                        }}
                        placeholder="Örn: A-154"
                        className="h-6 w-28 rounded border border-border-strong bg-surface px-1.5 font-mono text-xs focus:border-primary focus:outline-none"
                      />
                      <button
                        onClick={saveTag}
                        disabled={tagSaving}
                        className="cursor-pointer rounded p-0.5 text-success hover:bg-success/10 disabled:opacity-50"
                        title="Kaydet"
                      >
                        <Check size={12} />
                      </button>
                      <button
                        onClick={() => setTagEditing(false)}
                        className="cursor-pointer rounded p-0.5 text-fg-muted hover:bg-surface-2"
                        title="Vazgeç"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {phone.region && <RegionBadge region={phone.region} />}
                  <StatusBadge status={phone.status} label={PHONE_STATUS_LABELS[phone.status]} />
                  <button
                    onClick={closePhoneDrawer}
                    aria-label="Kapat"
                    className="cursor-pointer rounded p-1 text-fg-muted hover:bg-surface-2 hover:text-fg"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-md bg-surface-2 px-2 py-1.5">
                  <p className="text-[10px] uppercase text-fg-muted">Alış</p>
                  <p className="tabular text-[13px] font-semibold">
                    {formatKurusPrivate(phone.purchase_price, privacyMode)}
                  </p>
                </div>
                <div className="rounded-md bg-surface-2 px-2 py-1.5">
                  <p className="text-[10px] uppercase text-fg-muted">Masraf</p>
                  <p className="tabular text-[13px] font-semibold">
                    {phone.total_cost != null && phone.purchase_price != null
                      ? formatKurusPrivate(phone.total_cost - phone.purchase_price, privacyMode)
                      : "—"}
                  </p>
                </div>
                <div className="rounded-md bg-surface-2 px-2 py-1.5">
                  <p className="text-[10px] uppercase text-fg-muted">Toplam Maliyet</p>
                  <p className="tabular text-[13px] font-semibold">
                    {formatKurusPrivate(phone.total_cost, privacyMode)}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                <Button variant="outline" size="sm" onClick={() => setShareOpen(true)}>
                  <MessageCircle size={13} /> WhatsApp
                </Button>
                <Button variant="outline" size="sm" onClick={() => setImeiOpen(true)}>
                  <IdCard size={13} /> IMEI
                </Button>
                {phone.status !== "sold" && (
                  <Button variant="primary" size="sm" disabled={readOnly} onClick={goToSale}>
                    <ArrowUpFromLine size={13} /> Sat
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={readOnly}
                  onClick={() => setDeleteOpen(true)}
                  className="text-destructive hover:bg-destructive/10"
                >
                  <Trash2 size={13} /> Sil
                </Button>
              </div>

              <nav className="mt-3 flex gap-1">
                {(
                  [
                    ["summary", "Özet"],
                    ["people", "Kişiler"],
                    ["timeline", "Zaman Çizelgesi"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setTab(key)}
                    className={cn(
                      "cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                      tab === key
                        ? "bg-primary/10 text-primary"
                        : "text-fg-muted hover:bg-surface-2"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </nav>
            </header>

            <div className="flex-1 overflow-y-auto p-4">
              {tab === "summary" && (
                <div className="space-y-4">
                  <PhoneQuality phone={phone} />
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5 text-[13px]">
                    {(
                      [
                        ["IMEI 2", phone.imei2],
                        ["Seri No", phone.serial_no],
                        [
                          "Garanti",
                          phone.warranty_until && remainingDays(phone.warranty_until) > 0
                            ? `${formatSpan(remainingDays(phone.warranty_until))} · ${formatDate(phone.warranty_until)}`
                            : "Yok",
                        ],
                        ["Not", phone.notes],
                      ] as const
                    ).map(([k, v]) => (
                      <div key={k}>
                        <dt className="text-[11px] uppercase text-fg-muted">{k}</dt>
                        <dd className="mt-0.5">{v ?? "—"}</dd>
                      </div>
                    ))}
                  </dl>
                  {phone.current_acquisition_id && (
                    <ExpenseSection
                      acquisitionId={phone.current_acquisition_id}
                      phoneId={phone.id}
                    />
                  )}
                </div>
              )}

              {tab === "people" && (
                <PeopleTab phoneId={phone.id} acquisitionId={phone.current_acquisition_id} />
              )}

              {tab === "timeline" &&
                (timeline.length === 0 ? (
                  <EmptyState icon={CalendarClock} title="Henüz hareket yok" />
                ) : (
                  <ol className="relative ml-2 space-y-4 border-l border-border pl-4">
                    {timeline.map((ev, i) => {
                      const Icon = EVENT_ICONS[ev.event_type];
                      return (
                        <li key={`${ev.event_type}-${ev.ref_id}-${i}`} className="relative">
                          <span
                            className={cn(
                              "absolute -left-[25px] flex size-4.5 items-center justify-center rounded-full border border-border bg-surface",
                              EVENT_COLOR[ev.event_type]
                            )}
                          >
                            <Icon size={10} />
                          </span>
                          <div className="flex items-baseline justify-between">
                            <p className="text-[13px] font-medium">
                              {TIMELINE_LABELS[ev.event_type]}
                            </p>
                            <span className="tabular text-xs font-medium">
                              {ev.amount ? formatKurus(ev.amount) : ""}
                            </span>
                          </div>
                          <p className="text-xs text-fg-muted">
                            {formatDateTime(ev.date)}
                            {ev.note ? ` · ${ev.note}` : ""}
                          </p>
                        </li>
                      );
                    })}
                  </ol>
                ))}
            </div>
          </>
        ) : (
          <div className="p-4 text-sm text-fg-muted">Yükleniyor…</div>
        )}
      </aside>

      <WhatsAppShareDialog open={shareOpen} onClose={() => setShareOpen(false)} phone={phone ?? null} />
      <ImeiCopyDialog
        open={imeiOpen}
        onClose={() => setImeiOpen(false)}
        imei1={phone?.imei1 ?? null}
        imei2={phone?.imei2 ?? null}
      />
      <Dialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Telefonu Sil"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              İptal
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Siliniyor…" : "Kalıcı Olarak Sil"}
            </Button>
          </>
        }
      >
        <p className="text-xs text-fg-muted leading-relaxed">
          Bu telefonu ve bu alış turuna ait tüm masraf kayıtlarını kalıcı olarak silmek istediğinizden
          emin misiniz? Bu telefona bağlı bir satış varsa önce o satışı silmeniz gerekir.
        </p>
        <p className="mt-3 text-xs text-destructive font-medium">Dikkat: Bu işlem geri alınamaz!</p>
      </Dialog>
    </>
  );
}
