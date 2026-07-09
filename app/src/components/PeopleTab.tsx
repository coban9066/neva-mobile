import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import {
  User,
  Phone,
  CalendarDays,
  MessageCircle,
  Pencil,
  Check,
  X,
  ArrowDownToLine,
  ArrowUpFromLine,
} from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { selectOne } from "@/lib/db";
import { useUi, isReadOnly } from "@/stores/ui";
import { formatDate, cn } from "@/lib/utils";
import { formatPhone, normalizePhone, whatsappNumber } from "@/lib/phone-format";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";

type PersonKind = "acquisition" | "sale";

interface PersonRow {
  id: number;
  contact_name: string | null;
  contact_phone: string | null;
  date: string;
}

/** Tek bir kişi kartı — Kimden Alındı / Kime Satıldı. Ad + telefon düzenlenebilir. */
function PersonCard({
  kind,
  row,
  onSaved,
}: {
  kind: PersonKind;
  row: PersonRow;
  onSaved: () => void;
}) {
  const { toast, license } = useUi();
  const readOnly = isReadOnly(license);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(row.contact_name ?? "");
  const [phone, setPhone] = useState(row.contact_phone ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(row.contact_name ?? "");
    setPhone(row.contact_phone ?? "");
    setEditing(false);
  }, [row.id, row.contact_name, row.contact_phone]);

  const isBuy = kind === "acquisition";
  const title = isBuy ? "Kimden Alındı" : "Kime Satıldı";
  const Icon = isBuy ? ArrowDownToLine : ArrowUpFromLine;
  const tone = isBuy ? "text-success" : "text-secondary";
  const wa = whatsappNumber(row.contact_phone);

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      await invoke("update_contact_info", {
        args: {
          kind,
          id: row.id,
          name: name.trim() || null,
          phone: phone.trim() ? normalizePhone(phone) : null,
        },
      });
      toast({ kind: "success", title: "Kişi bilgileri güncellendi" });
      setEditing(false);
      onSaved();
    } catch (e) {
      toast({ kind: "error", title: `Kaydedilemedi: ${String(e)}` });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-lg border border-border bg-surface-2/40 p-3">
      <header className="flex items-center justify-between">
        <h3 className={cn("flex items-center gap-1.5 text-xs font-semibold", tone)}>
          <Icon size={13} strokeWidth={1.75} /> {title}
        </h3>
        {!readOnly && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <Pencil size={11} /> Düzenle
          </button>
        )}
      </header>

      {!editing ? (
        <div className="mt-2.5 space-y-2 text-[13px]">
          <div className="flex items-center gap-2">
            <User size={13} className="shrink-0 text-fg-muted" />
            <span className={cn(!row.contact_name && "text-fg-muted")}>
              {row.contact_name || "İsim girilmemiş"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Phone size={13} className="shrink-0 text-fg-muted" />
            {row.contact_phone ? (
              <>
                <span className="font-mono">{formatPhone(row.contact_phone)}</span>
                {wa && (
                  <button
                    onClick={() => openUrl(`https://wa.me/${wa}`)}
                    className="ml-auto flex cursor-pointer items-center gap-1 rounded-md border border-success/40 bg-success/8 px-2 py-0.5 text-[11px] font-medium text-success transition-colors hover:bg-success/15"
                  >
                    <MessageCircle size={12} /> WhatsApp
                  </button>
                )}
              </>
            ) : (
              <span className="text-fg-muted">Numara girilmemiş</span>
            )}
          </div>
          <div className="flex items-center gap-2 text-fg-muted">
            <CalendarDays size={13} className="shrink-0" />
            <span>{formatDate(row.date)}</span>
          </div>
        </div>
      ) : (
        <div className="mt-2.5 space-y-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ad Soyad"
            className="h-8 text-xs"
          />
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/[^\d\s+]/g, ""))}
            placeholder="0532 123 45 67"
            inputMode="tel"
            className="h-8 font-mono text-xs"
          />
          <div className="flex justify-end gap-1.5">
            <button
              onClick={() => setEditing(false)}
              className="flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-fg-muted hover:bg-surface-2"
            >
              <X size={11} /> Vazgeç
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="flex cursor-pointer items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-[11px] font-semibold text-on-primary transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <Check size={11} /> {saving ? "Kaydediliyor…" : "Kaydet"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * Kişiler sekmesi — telefonun alış (Kimden Alındı) ve satış (Kime Satıldı)
 * kişi bilgilerini birlikte gösterir. Satılmamışsa "Kime Satıldı" kartı çıkmaz.
 */
export function PeopleTab({
  phoneId,
  acquisitionId,
}: {
  phoneId: number;
  acquisitionId: number | null;
}) {
  const qc = useQueryClient();

  const { data: buyer } = useQuery({
    queryKey: ["person-acquisition", acquisitionId],
    enabled: acquisitionId != null,
    queryFn: () =>
      selectOne<PersonRow>(
        `SELECT id, contact_name, contact_phone, date FROM acquisitions WHERE id = $1`,
        [acquisitionId]
      ),
  });

  const { data: seller } = useQuery({
    queryKey: ["person-sale", phoneId],
    queryFn: () =>
      selectOne<PersonRow>(
        `SELECT id, contact_name, contact_phone, date FROM sales
         WHERE phone_id = $1 AND deleted_at IS NULL ORDER BY date DESC LIMIT 1`,
        [phoneId]
      ),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["person-acquisition"] });
    qc.invalidateQueries({ queryKey: ["person-sale"] });
    qc.invalidateQueries({ queryKey: ["sales"] });
  };

  if (!buyer && !seller) {
    return <EmptyState icon={User} title="Kişi bilgisi yok" />;
  }

  return (
    <div className="space-y-3">
      {buyer && <PersonCard kind="acquisition" row={buyer} onSaved={refresh} />}
      {seller && <PersonCard kind="sale" row={seller} onSaved={refresh} />}
    </div>
  );
}
