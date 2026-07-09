import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, AlertTriangle, History } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { GradePicker } from "@/components/ui/grade-picker";
import { RegionSegment } from "@/components/ui/region-segment";
import { invoke } from "@tauri-apps/api/core";
import { select, selectOne } from "@/lib/db";
import { checkImei } from "@/lib/imei";
import { formatKurus, parseLiraInput } from "@/lib/money";
import { batteryStatus, QUALITY_TONE_CLASS } from "@/lib/quality";
import { parseWarrantyInput, warrantyEndDate } from "@/lib/warranty";
import { getProfile } from "@/profiles";
import { useUi } from "@/stores/ui";
import { cn, formatDate } from "@/lib/utils";
import { normalizePhone } from "@/lib/phone-format";
import type { Brand, Contact, CosmeticGrade, PaymentMethod, Region } from "@/types";
import { PAYMENT_LABELS, PHONE_STATUS_LABELS, type PhoneStatus } from "@/types";

interface ExistingPhone {
  id: number;
  status: PhoneStatus;
  brand_id: number | null;
  model: string | null;
  color: string | null;
  storage_gb: number | null;
  cosmetic_grade: CosmeticGrade | null;
  region: Region | null;
  last_sale_price: number | null;
  last_sale_date: string | null;
  battery_health: number | null;
}

interface ModelStats {
  buy_avg: number | null;
  sell_avg: number | null;
  n: number;
}

export function QuickPurchase() {
  const { quickPurchaseOpen, quickPurchaseImei, closeQuickPurchase, toast, openPhoneDrawer } =
    useUi();
  const qc = useQueryClient();

  const [imei, setImei] = useState("");
  const [brandId, setBrandId] = useState<number | "">("");
  const [model, setModel] = useState("");
  const [storage, setStorage] = useState<number | "">("");
  const [color, setColor] = useState("");
  const [grade, setGrade] = useState<CosmeticGrade | null>(null);
  const [region, setRegion] = useState<Region>("domestic");
  const [batteryRaw, setBatteryRaw] = useState("");
  const [note, setNote] = useState("");
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [hasWarranty, setHasWarranty] = useState(false);
  const [warrantyRaw, setWarrantyRaw] = useState("");
  const [contactQuery, setContactQuery] = useState("");
  const [contactId, setContactId] = useState<number | null>(null);
  const [contactPhone, setContactPhone] = useState("");
  const [priceRaw, setPriceRaw] = useState("");
  const [payment, setPayment] = useState<PaymentMethod>("cash");
  const [saving, setSaving] = useState(false);
  const imeiRef = useRef<HTMLInputElement>(null);

  // Modal açılınca sıfırla + ön-dolu IMEI
  useEffect(() => {
    if (quickPurchaseOpen) {
      setImei(quickPurchaseImei ?? "");
      setBrandId("");
      setModel("");
      setStorage("");
      setColor("");
      setGrade(null);
      setRegion("domestic");
      setBatteryRaw("");
      setNote("");
      setChecks({});
      setHasWarranty(false);
      setWarrantyRaw("");
      setContactQuery("");
      setContactId(null);
      setContactPhone("");
      setPriceRaw("");
      setPayment("cash");
      setTimeout(() => imeiRef.current?.focus(), 50);
    }
  }, [quickPurchaseOpen, quickPurchaseImei]);

  const imeiState = checkImei(imei);

  const { data: brands = [] } = useQuery({
    queryKey: ["brands"],
    queryFn: () => select<Brand>("SELECT id, name FROM brands ORDER BY sort_order"),
  });

  // Brand Profile Registry: marka değişince form profili anında değişir (refresh yok)
  const profile = useMemo(
    () => getProfile(brands.find((b) => b.id === brandId)?.name),
    [brands, brandId]
  );

  useEffect(() => {
    setChecks({});
  }, [profile.id]);

  // Model suggestions from DISTINCT model in phones table
  const { data: suggestions = [] } = useQuery({
    queryKey: ["model-suggestions"],
    queryFn: () =>
      select<{ model: string }>(
        "SELECT DISTINCT model FROM phones WHERE model IS NOT NULL AND model != '' ORDER BY model"
      ).then((rows) => rows.map((r) => r.model)),
  });

  // Kayıtlı IMEI mi? — yeniden alış (tur) akışı
  const { data: existing } = useQuery({
    queryKey: ["existing-phone", imei],
    enabled: imeiState === "valid" && quickPurchaseOpen,
    queryFn: () =>
      selectOne<ExistingPhone>(
        `SELECT p.id, p.status, p.brand_id, p.model, p.color, p.storage_gb, p.cosmetic_grade, p.region, p.battery_health,
                (SELECT price FROM sales s WHERE s.phone_id = p.id AND s.deleted_at IS NULL ORDER BY s.date DESC LIMIT 1) AS last_sale_price,
                (SELECT date  FROM sales s WHERE s.phone_id = p.id AND s.deleted_at IS NULL ORDER BY s.date DESC LIMIT 1) AS last_sale_date
         FROM phones p WHERE (p.imei1 = $1 OR p.imei2 = $1) AND p.deleted_at IS NULL`,
        [imei]
      ),
  });

  // Kayıtlı telefonun kimliğini forma taşı
  useEffect(() => {
    if (existing) {
      if (existing.brand_id) setBrandId(existing.brand_id);
      if (existing.model) setModel(existing.model);
      if (existing.storage_gb) setStorage(existing.storage_gb);
      if (existing.color) setColor(existing.color);
      if (existing.cosmetic_grade) setGrade(existing.cosmetic_grade);
      if (existing.region) setRegion(existing.region);
      if (existing.battery_health) setBatteryRaw(String(existing.battery_health));
    }
  }, [existing]);

  // Fiyat istihbaratı: aynı model geçmiş ort. alış/satış
  const { data: stats } = useQuery({
    queryKey: ["model-stats", model],
    enabled: model.trim() !== "",
    queryFn: () =>
      selectOne<ModelStats>(
        `SELECT (SELECT CAST(AVG(a.price) AS INTEGER) FROM acquisitions a
                 JOIN phones p ON p.id = a.phone_id
                 WHERE p.model = $1 AND a.deleted_at IS NULL) AS buy_avg,
                (SELECT CAST(AVG(s.price) AS INTEGER) FROM sales s
                 JOIN phones p ON p.id = s.phone_id
                 WHERE p.model = $1 AND s.deleted_at IS NULL) AS sell_avg,
                (SELECT COUNT(*) FROM acquisitions a JOIN phones p ON p.id = a.phone_id
                 WHERE p.model = $1 AND a.deleted_at IS NULL) AS n`,
        [model.trim()]
      ),
  });

  const { data: contactHits = [] } = useQuery({
    queryKey: ["contact-search", contactQuery],
    enabled: contactQuery.trim().length >= 2 && contactId === null,
    queryFn: () =>
      select<Contact>(
        `SELECT id, type, full_name, phone_number FROM contacts
         WHERE deleted_at IS NULL AND (full_name LIKE $1 OR phone_number LIKE $1)
         ORDER BY id DESC LIMIT 6`,
        [`%${contactQuery.trim()}%`]
      ),
  });

  const price = parseLiraInput(priceRaw);
  const battery = profile.showBatteryHealth && batteryRaw !== "" ? Number(batteryRaw) : null;
  const batteryValid =
    battery === null || (Number.isInteger(battery) && battery >= 1 && battery <= 100);
  const warrantySpan = hasWarranty ? parseWarrantyInput(warrantyRaw) : null;
  const warrantyValid = !hasWarranty || warrantyRaw === "" || warrantySpan !== null;
  const alreadyInStock =
    existing && ["in_stock", "reserved", "consigned"].includes(existing.status);
  const canSave =
    imeiState === "valid" &&
    brandId !== "" &&
    model.trim() !== "" &&
    grade !== null &&
    batteryValid &&
    (!hasWarranty || warrantySpan !== null) &&
    price !== null &&
    price > 0 &&
    !alreadyInStock &&
    !saving;

  async function save() {
    if (!canSave || price === null || grade === null) return;
    setSaving(true);
    try {
      // Atomik yazma Rust tarafında (save_purchase) — tek SQL transaction
      const phoneId = await invoke<number>("save_purchase", {
        args: {
          imei,
          brandId,
          model: model.trim(),
          color: color || null,
          storageGb: storage === "" ? null : storage,
          cosmeticGrade: grade,
          batteryHealth: battery,
          region,
          notes: note.trim() || null,
          warrantyUntil: warrantySpan ? warrantyEndDate(warrantySpan) : null,
          checks: profile.checks.map((c) => ({ key: c.key, value: !!checks[c.key] })),
          contactId,
          // Ad her zaman kayda yazılır (kişiler sekmesi bunu gösterir); numara opsiyonel.
          contactName: contactQuery.trim() || null,
          contactPhone: contactPhone.trim() ? normalizePhone(contactPhone) : null,
          price,
          paymentMethod: payment,
          paymentLabel: PAYMENT_LABELS[payment],
        },
      });

      qc.invalidateQueries();
      closeQuickPurchase();
      toast({
        kind: "success",
        title: existing
          ? `Yeniden alış kaydedildi — tur #yeni (…${imei.slice(-6)})`
          : `Alış kaydedildi (…${imei.slice(-6)})`,
        actions: [{ label: "Kartı Aç", onClick: () => openPhoneDrawer(phoneId) }],
      });
    } catch (e) {
      toast({ kind: "error", title: `Kayıt hatası: ${String(e)}` });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={quickPurchaseOpen}
      onClose={closeQuickPurchase}
      title={
        <span className="flex items-center gap-2">
          Hızlı Alış <Kbd>F2</Kbd>
        </span>
      }
      width={600}
      footer={
        <>
          <span className="mr-auto text-[11px] text-fg-muted">
            <Kbd>Ctrl ⏎</Kbd> kaydet · <Kbd>Esc</Kbd> vazgeç
          </span>
          <Button variant="ghost" onClick={closeQuickPurchase}>
            Vazgeç
          </Button>
          <Button variant="primary" disabled={!canSave} onClick={save}>
            {saving ? "Kaydediliyor…" : existing ? "Yeniden Al (Yeni Tur)" : "Alışı Kaydet"}
          </Button>
        </>
      }
    >
      <div
        className="grid grid-cols-2 gap-3"
        onKeyDown={(e) => {
          if (e.ctrlKey && e.key === "Enter") {
            e.preventDefault();
            void save();
          }
        }}
      >
        <Field
          label="IMEI"
          className="col-span-2"
          error={imeiState === "invalid" ? "Geçersiz IMEI (15 hane + Luhn)" : null}
        >
          <div className="relative">
            <Input
              ref={imeiRef}
              value={imei}
              onChange={(e) => setImei(e.target.value.replace(/\D/g, "").slice(0, 15))}
              placeholder="15 haneli IMEI — okuyucuyla tarayabilirsiniz"
              className={cn(
                "pr-8 font-mono",
                imeiState === "valid" && "border-success",
                imeiState === "invalid" && "border-destructive"
              )}
            />
            {imeiState === "valid" && (
              <CheckCircle2
                size={15}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-success"
              />
            )}
          </div>
        </Field>

        {existing && (
          <div
            className={cn(
              "col-span-2 flex items-start gap-2 rounded-md border px-3 py-2 text-xs",
              alreadyInStock
                ? "border-destructive/40 bg-destructive/8 text-destructive"
                : "border-warning/40 bg-warning/8"
            )}
          >
            {alreadyInStock ? (
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            ) : (
              <History size={14} className="mt-0.5 shrink-0 text-warning" />
            )}
            <div>
              <p className="font-medium">
                Bu telefon kayıtlı — durumu: {PHONE_STATUS_LABELS[existing.status]}
              </p>
              {alreadyInStock ? (
                <p>Zaten dükkânda görünüyor; yeni alış açılamaz.</p>
              ) : (
                <p>
                  {existing.last_sale_date
                    ? `${formatDate(existing.last_sale_date)} tarihinde ${formatKurus(
                        existing.last_sale_price
                      )} bedelle satılmış. `
                    : ""}
                  Yeni telefon oluşturulmayacak; mevcut karta <b>yeni tur</b> açılacak.
                </p>
              )}
            </div>
          </div>
        )}

        <Field label="Marka">
          <select
            value={brandId}
            onChange={(e) => {
              setBrandId(e.target.value ? Number(e.target.value) : "");
              setModel("");
              setStorage("");
            }}
            className="h-8 w-full cursor-pointer rounded-md border border-border-strong bg-surface px-2 text-[13px] focus:border-primary focus:outline-none"
          >
            <option value="">Seçin…</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Model">
          <Input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="Örn: iPhone 15 Pro Max 256 GB"
            disabled={brandId === ""}
            list="model-suggestions-list"
          />
          <datalist id="model-suggestions-list">
            {suggestions.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </Field>

        <Field label="Depolama (GB)">
          <div className="flex flex-col gap-2">
            <Input
              value={storage}
              onChange={(e) => setStorage(e.target.value === "" ? "" : Number(e.target.value.replace(/\D/g, "")))}
              placeholder="128"
              inputMode="numeric"
              className="tabular font-mono"
            />
            <div className="flex flex-wrap gap-1">
              {[64, 128, 256, 512, 1024].map((gb) => (
                <button
                  key={gb}
                  type="button"
                  onClick={() => setStorage(gb)}
                  className={cn(
                    "h-6 cursor-pointer rounded px-2 text-[10px] font-semibold border transition-colors",
                    storage === gb
                      ? "border-primary bg-primary text-on-primary"
                      : "border-border-strong bg-surface hover:border-primary/50"
                  )}
                >
                  {gb >= 1024 ? `${gb / 1024}TB` : `${gb}GB`}
                </button>
              ))}
            </div>
          </div>
        </Field>

        <Field label="Renk">
          <Input value={color} onChange={(e) => setColor(e.target.value)} placeholder="Siyah" />
        </Field>

        <Field
          label="Kozmetik Kondisyon"
          className="col-span-2"
          hint={grade === null ? "Zorunlu — kaydetmek için kademe seçin" : undefined}
        >
          <GradePicker value={grade} onChange={setGrade} />
        </Field>

        <Field label="Menşei">
          <RegionSegment value={region} onChange={setRegion} />
        </Field>

        {profile.showBatteryHealth && (
          <Field
            label="Pil Sağlığı (%)"
            error={!batteryValid ? "1-100 arasında olmalı" : null}
          >
            <div className="flex items-center gap-2">
              <Input
                value={batteryRaw}
                onChange={(e) => setBatteryRaw(e.target.value.replace(/\D/g, "").slice(0, 3))}
                placeholder="90"
                inputMode="numeric"
                className="tabular w-20 font-mono"
              />
              {battery !== null && batteryValid && (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    QUALITY_TONE_CLASS[batteryStatus(battery).tone]
                  )}
                >
                  {batteryStatus(battery).label}
                </span>
              )}
            </div>
          </Field>
        )}

        {profile.checks.length > 0 && (
          <div className="col-span-2">
            <p className="mb-1.5 text-xs font-medium text-fg-muted">Kalite Kontrolleri</p>
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
                      "flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-xs font-medium",
                      "transition-[border-color,background-color,box-shadow] duration-200",
                      on
                        ? "border-success/60 bg-success/8 text-success shadow-[0_0_10px_-4px_var(--success)]"
                        : "border-border-strong text-fg-muted hover:border-success/40 hover:text-fg"
                    )}
                  >
                    <CheckCircle2 size={13} className={on ? "" : "opacity-30"} />
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <Field
          label="Üretici Garantisi"
          className="col-span-2"
          error={!warrantyValid ? "Format: ay.gün — örn. 20.3 = 20 ay 3 gün" : null}
          hint={
            hasWarranty && warrantySpan
              ? `${warrantySpan.months} Ay ${warrantySpan.days} Gün → bitiş ${formatDate(
                  warrantyEndDate(warrantySpan)
                )}`
              : hasWarranty
                ? "ay.gün yazın — 20.3 = 20 ay 3 gün · 0.25 = 25 gün"
                : undefined
          }
        >
          <div className="flex items-center gap-2">
            <div className="grid w-48 grid-cols-2 gap-1 rounded-lg border border-border-strong bg-surface-2/60 p-1">
              {(
                [
                  [false, "Yok"],
                  [true, "Var"],
                ] as const
              ).map(([v, label]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setHasWarranty(v)}
                  aria-pressed={hasWarranty === v}
                  className={cn(
                    "h-7 cursor-pointer rounded-md border text-xs font-medium transition-all duration-200",
                    hasWarranty === v
                      ? v
                        ? "border-success bg-success text-white shadow-sm"
                        : "border-border-strong bg-surface text-fg shadow-sm"
                      : "border-transparent text-fg-muted hover:bg-surface hover:text-fg"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            {hasWarranty && (
              <Input
                value={warrantyRaw}
                onChange={(e) => setWarrantyRaw(e.target.value.replace(/[^\d.,]/g, ""))}
                placeholder="20.3"
                inputMode="decimal"
                className={cn("tabular w-24 font-mono", !warrantyValid && "border-destructive")}
              />
            )}
          </div>
        </Field>

        <Field label="Kimden alındı" hint={contactId ? undefined : "Yazın: kayıtlıysa seçin, değilse yeni oluşturulur"}>
          <div className="relative">
            <Input
              value={contactQuery}
              onChange={(e) => {
                setContactQuery(e.target.value);
                setContactId(null);
              }}
              placeholder="Ad veya telefon"
              className={cn(contactId && "border-success")}
            />
            {contactId === null && contactHits.length > 0 && (
              <div className="absolute inset-x-0 top-9 z-10 overflow-hidden rounded-md border border-border bg-surface shadow-lg">
                {contactHits.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setContactId(c.id);
                      setContactQuery(c.full_name);
                      if (c.phone_number) setContactPhone(c.phone_number);
                    }}
                    className="flex w-full cursor-pointer items-center justify-between px-2.5 py-1.5 text-left text-xs hover:bg-surface-2"
                  >
                    <span>{c.full_name}</span>
                    <span className="text-fg-muted">{c.phone_number}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </Field>

        <Field label="Telefon Numarası" hint="Opsiyonel — boş bırakılabilir">
          <Input
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value.replace(/[^\d\s+]/g, ""))}
            placeholder="0532 123 45 67"
            inputMode="tel"
            className="font-mono"
          />
        </Field>

        <Field label="Alış fiyatı (₺)">
          <Input
            value={priceRaw}
            onChange={(e) => setPriceRaw(e.target.value)}
            placeholder="14.500"
            className="tabular font-mono"
          />
        </Field>

        <Field label="Ödeme türü">
          <div className="flex gap-1.5">
            {(Object.keys(PAYMENT_LABELS) as PaymentMethod[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setPayment(m)}
                className={cn(
                  "h-8 flex-1 cursor-pointer rounded-md border text-xs font-medium transition-colors",
                  payment === m
                    ? "border-primary bg-primary text-on-primary"
                    : "border-border-strong bg-surface hover:border-primary/50"
                )}
              >
                {PAYMENT_LABELS[m]}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Not" className="col-span-2">
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Opsiyonel — kutu/fatura durumu, çizik detayı…"
          />
        </Field>

        {stats && stats.n > 0 && (
          <div className="col-span-2 rounded-md bg-secondary/8 px-3 py-2 text-xs text-fg-muted">
            Bu model geçmişi ({stats.n} alış): ort. alış{" "}
            <b className="text-fg">{formatKurus(stats.buy_avg)}</b>
            {stats.sell_avg != null && (
              <>
                {" "}
                · ort. satış <b className="text-fg">{formatKurus(stats.sell_avg)}</b>
              </>
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
}
