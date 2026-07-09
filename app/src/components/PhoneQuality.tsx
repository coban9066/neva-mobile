import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { BatteryMedium, Pencil, ShieldQuestion, Sparkles, X, Check } from "lucide-react";
import { select } from "@/lib/db";
import { GRADE_META, batteryStatus, QUALITY_TONE_CLASS } from "@/lib/quality";
import { getProfile } from "@/profiles";
import { useUi, isReadOnly } from "@/stores/ui";
import { cn } from "@/lib/utils";
import { GradePicker } from "@/components/ui/grade-picker";
import { RegionSegment, RegionBadge } from "@/components/ui/region-segment";
import type { CosmeticGrade, Region } from "@/types";

export interface QualityPhone {
  id: number;
  brand_name: string | null;
  cosmetic_grade: CosmeticGrade | null;
  battery_health: number | null;
  region: Region | null;
}

/**
 * Telefon Kalitesi özeti: telefoncu kartı açınca ilk bunu görür.
 * Badge'ler Brand Profile Registry'den türer; Düzenle ile eksikler tamamlanır.
 */
export function PhoneQuality({ phone }: { phone: QualityPhone }) {
  const qc = useQueryClient();
  const { toast, license } = useUi();
  const readOnly = isReadOnly(license);
  const profile = getProfile(phone.brand_name);

  const [editing, setEditing] = useState(false);
  const [grade, setGrade] = useState<CosmeticGrade | null>(phone.cosmetic_grade);
  const [region, setRegion] = useState<Region>(phone.region ?? "domestic");
  const [batteryRaw, setBatteryRaw] = useState(
    phone.battery_health != null ? String(phone.battery_health) : ""
  );
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  const { data: confirmed = [] } = useQuery({
    queryKey: ["phone-checks", phone.id],
    queryFn: () =>
      select<{ check_key: string }>(
        "SELECT check_key FROM phone_checks WHERE phone_id = $1 AND value = 1",
        [phone.id]
      ),
  });
  const confirmedKeys = new Set(confirmed.map((c) => c.check_key));

  // Kart değişince düzenleme durumunu tazele
  useEffect(() => {
    setEditing(false);
    setGrade(phone.cosmetic_grade);
    setRegion(phone.region ?? "domestic");
    setBatteryRaw(phone.battery_health != null ? String(phone.battery_health) : "");
  }, [phone.id, phone.cosmetic_grade, phone.region, phone.battery_health]);

  useEffect(() => {
    if (editing) {
      setChecks(Object.fromEntries(profile.checks.map((c) => [c.key, confirmedKeys.has(c.key)])));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  const battery = batteryRaw === "" ? null : Number(batteryRaw);
  const batteryValid =
    battery === null || (Number.isInteger(battery) && battery >= 1 && battery <= 100);

  async function save() {
    if (!grade || !batteryValid || saving) return;
    setSaving(true);
    try {
      // Atomik yazma Rust tarafında (update_phone_quality) — tek bağlantılı gerçek
      // sqlx transaction. Frontend'deki eski havuz-güvensiz transaction kaldırıldı.
      await invoke("update_phone_quality", {
        args: {
          phoneId: phone.id,
          cosmeticGrade: grade,
          batteryHealth: battery,
          region,
          checks: profile.checks.filter((c) => checks[c.key]).map((c) => c.key),
        },
      });
      qc.invalidateQueries();
      setEditing(false);
      toast({ kind: "success", title: "Telefon kalitesi güncellendi" });
    } catch (e) {
      toast({ kind: "error", title: `Kaydedilemedi: ${String(e)}` });
    } finally {
      setSaving(false);
    }
  }

  const gradeMeta = phone.cosmetic_grade ? GRADE_META[phone.cosmetic_grade] : null;
  const batteryInfo = phone.battery_health != null ? batteryStatus(phone.battery_health) : null;

  return (
    <section className="rounded-lg border border-border bg-surface-2/40 p-3">
      <header className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold">
          <Sparkles size={13} className="text-accent" strokeWidth={1.75} />
          Telefon Kalitesi
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
        <div className="mt-2 flex flex-wrap gap-1.5">
          {gradeMeta ? (
            <span className="inline-flex items-center rounded-full bg-primary/12 px-2 py-0.5 text-[11px] font-semibold text-primary">
              {gradeMeta.label} Kozmetik · {gradeMeta.description}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-warning/12 px-2 py-0.5 text-[11px] font-medium text-warning">
              <ShieldQuestion size={11} /> Kozmetik girilmemiş
            </span>
          )}

          {batteryInfo && phone.battery_health != null ? (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                QUALITY_TONE_CLASS[batteryInfo.tone]
              )}
            >
              <BatteryMedium size={11} /> Pil %{phone.battery_health} · {batteryInfo.label}
            </span>
          ) : (
            profile.showBatteryHealth && (
              <span className="inline-flex items-center gap-1 rounded-full bg-warning/12 px-2 py-0.5 text-[11px] font-medium text-warning">
                <ShieldQuestion size={11} /> Pil bilgisi eksik
              </span>
            )
          )}

          {phone.region ? (
            <RegionBadge region={phone.region} />
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-warning/12 px-2 py-0.5 text-[11px] font-medium text-warning">
              <ShieldQuestion size={11} /> Menşei girilmemiş
            </span>
          )}

          {profile.checks.map((c) =>
            confirmedKeys.has(c.key) ? (
              <span
                key={c.key}
                className="inline-flex items-center gap-1 rounded-full bg-success/12 px-2 py-0.5 text-[11px] font-medium text-success"
              >
                <Check size={11} /> {c.label}
              </span>
            ) : c.critical ? (
              <span
                key={c.key}
                className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-fg-muted"
              >
                <ShieldQuestion size={11} /> {c.label}?
              </span>
            ) : null
          )}
        </div>
      ) : (
        <div className="mt-2 space-y-3">
          <GradePicker value={grade} onChange={setGrade} compact />
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <RegionSegment value={region} onChange={setRegion} />
            </div>
            {profile.showBatteryHealth && (
              <input
                value={batteryRaw}
                onChange={(e) => setBatteryRaw(e.target.value.replace(/\D/g, "").slice(0, 3))}
                placeholder="Pil %"
                inputMode="numeric"
                className={cn(
                  "tabular h-8 w-20 rounded-md border bg-surface px-2 text-center font-mono text-xs",
                  batteryValid ? "border-border-strong focus:border-primary" : "border-destructive",
                  "focus:outline-none"
                )}
              />
            )}
          </div>
          {profile.checks.length > 0 && (
            <div className="grid grid-cols-2 gap-1.5">
              {profile.checks.map((c) => {
                const on = !!checks[c.key];
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setChecks((s) => ({ ...s, [c.key]: !on }))}
                    aria-pressed={on}
                    className={cn(
                      "flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1.5 text-left text-[11px] font-medium transition-colors duration-200",
                      on
                        ? "border-success/60 bg-success/8 text-success"
                        : "border-border-strong text-fg-muted hover:border-success/40 hover:text-fg"
                    )}
                  >
                    <Check size={11} className={on ? "" : "opacity-30"} />
                    {c.label}
                  </button>
                );
              })}
            </div>
          )}
          <div className="flex justify-end gap-1.5">
            <button
              onClick={() => setEditing(false)}
              className="flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-fg-muted hover:bg-surface-2"
            >
              <X size={11} /> Vazgeç
            </button>
            <button
              onClick={save}
              disabled={!grade || !batteryValid || saving}
              className="flex cursor-pointer items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-[11px] font-semibold text-on-primary transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Check size={11} /> {saving ? "Kaydediliyor…" : "Kaydet"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
