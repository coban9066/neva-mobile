import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Receipt,
  Puzzle,
  ShieldAlert,
  Undo2,
  CalendarClock,
  History,
  ChevronDown,
} from "lucide-react";
import { select } from "@/lib/db";
import { formatKurus } from "@/lib/money";
import { cn, formatDateTime } from "@/lib/utils";
import { useUi } from "@/stores/ui";
import { EmptyState } from "@/components/ui/empty-state";
import { TIMELINE_LABELS, type TimelineEvent } from "@/types";

type RecentEvent = TimelineEvent & { label: string };

const EVENT_ICONS: Record<TimelineEvent["event_type"], typeof Receipt> = {
  acquisition: ArrowDownToLine,
  sale: ArrowUpFromLine,
  expense: Receipt,
  part: Puzzle,
  warranty_return: ShieldAlert,
  return: Undo2,
  reservation: CalendarClock,
};

const EVENT_TONE: Record<TimelineEvent["event_type"], string> = {
  acquisition: "bg-success/12 text-success",
  sale: "bg-destructive/12 text-destructive",
  expense: "bg-secondary/12 text-secondary",
  part: "bg-secondary/12 text-secondary",
  warranty_return: "bg-warning/12 text-warning",
  return: "bg-warning/12 text-warning",
  reservation: "bg-primary/12 text-primary",
};

const COLLAPSED_COUNT = 6;
const EXPANDED_COUNT = 40;

/** Sağ panel: ikonlu işlem timeline'ı — saat, işlem, tutar. */
export function RecentActivity() {
  const { openPhoneDrawer } = useUi();
  const [expanded, setExpanded] = useState(false);

  const { data: allEvents = [] } = useQuery({
    queryKey: ["dashboard-recent"],
    queryFn: () =>
      select<RecentEvent>(
        `SELECT t.*, COALESCE(b.name || ' ' || p.model, 'Telefon #' || t.phone_id) AS label
         FROM v_phone_timeline t
         JOIN phones p ON p.id = t.phone_id
         LEFT JOIN brands b ON b.id = p.brand_id
         WHERE p.deleted_at IS NULL
         ORDER BY t.date DESC LIMIT ${EXPANDED_COUNT}`
      ),
  });

  const events = expanded ? allEvents : allEvents.slice(0, COLLAPSED_COUNT);

  return (
    <section className="animate-card-in overflow-hidden rounded-lg border border-border bg-surface">
      <header className="flex items-center gap-2 border-b border-border px-4 py-3">
        <History size={15} className="text-secondary" strokeWidth={1.75} />
        <h2 className="text-[13px] font-semibold">Son İşlemler</h2>
      </header>

      {events.length === 0 ? (
        <EmptyState
          icon={History}
          title="Henüz işlem yok"
          description="İlk alışınızı F2 ile kaydedin."
        />
      ) : (
        <ul className={cn(expanded && "max-h-[420px] overflow-y-auto")}>
          {events.map((ev, i) => {
            const Icon = EVENT_ICONS[ev.event_type];
            return (
              <li key={`${ev.event_type}-${ev.ref_id}-${i}`} className="relative">
                {i < events.length - 1 && (
                  <span
                    aria-hidden
                    className="absolute left-[27px] top-9 h-[calc(100%-20px)] w-px bg-border"
                  />
                )}
                <button
                  onClick={() => openPhoneDrawer(ev.phone_id)}
                  className="flex w-full cursor-pointer items-center gap-2.5 px-4 py-2.5 text-left transition-colors hover:bg-surface-2/60"
                >
                  <span
                    className={cn(
                      "z-10 flex size-6 shrink-0 items-center justify-center rounded-full",
                      EVENT_TONE[ev.event_type]
                    )}
                  >
                    <Icon size={12} strokeWidth={2} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium">
                      {TIMELINE_LABELS[ev.event_type]}
                      <span className="ml-1.5 font-normal text-fg-muted">{ev.label}</span>
                    </span>
                    <span className="block text-[11px] text-fg-muted">
                      {formatDateTime(ev.date)}
                    </span>
                  </span>
                  {ev.amount > 0 && (
                    <span className="tabular shrink-0 font-mono text-xs font-medium">
                      {formatKurus(ev.amount)}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {allEvents.length > COLLAPSED_COUNT && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center justify-center gap-1 border-t border-border py-2 text-xs font-medium text-fg-muted transition-colors hover:bg-surface-2/60 hover:text-fg"
        >
          {expanded ? "Daha Az Göster" : "Tümünü Gör"}
          <ChevronDown size={13} className={cn("transition-transform", expanded && "rotate-180")} />
        </button>
      )}
    </section>
  );
}
