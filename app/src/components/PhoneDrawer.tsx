import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
} from "lucide-react";
import { selectOne, select } from "@/lib/db";
import { useUi } from "@/stores/ui";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import { formatKurus } from "@/lib/money";
import { remainingDays, formatSpan } from "@/lib/warranty";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { RegionBadge } from "@/components/ui/region-segment";
import { PhoneQuality } from "@/components/PhoneQuality";
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
  imei1: string;
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
  const { phoneDrawerId, closePhoneDrawer, toast } = useUi();
  const [tab, setTab] = useState<"summary" | "timeline">("summary");
  const open = phoneDrawerId !== null;

  useEffect(() => {
    if (open) setTab("summary");
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
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(phone.imei1);
                      toast({ kind: "info", title: "IMEI kopyalandı" });
                    }}
                    className="mt-1 inline-flex cursor-pointer items-center gap-1 font-mono text-xs text-fg-muted hover:text-fg"
                    title="Kopyala"
                  >
                    {phone.imei1} <Copy size={11} />
                  </button>
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

              <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                <div className="rounded-md bg-surface-2 px-2 py-1.5">
                  <p className="text-[10px] uppercase text-fg-muted">Alış</p>
                  <p className="tabular text-[13px] font-semibold">
                    {formatKurus(phone.purchase_price)}
                  </p>
                </div>
                <div className="rounded-md bg-surface-2 px-2 py-1.5">
                  <p className="text-[10px] uppercase text-fg-muted">Toplam Maliyet</p>
                  <p className="tabular text-[13px] font-semibold">
                    {formatKurus(phone.total_cost)}
                  </p>
                </div>
              </div>

              <nav className="mt-3 flex gap-1">
                {(
                  [
                    ["summary", "Özet"],
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
                </div>
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
    </>
  );
}
