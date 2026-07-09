import { useEffect, useState } from "react";
import {
  Hourglass,
  KeyRound,
  MessageCircle,
  HardDriveDownload,
  X,
  Copy,
  ShieldCheck,
  Smartphone,
  Banknote,
  Receipt,
  Users,
  History,
  CheckCircle2,
} from "lucide-react";
import { exit } from "@tauri-apps/plugin-process";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Button } from "@/components/ui/button";
import { activateLicense } from "@/lib/license";
import { exportBackup } from "@/lib/backup";
import { select, selectOne } from "@/lib/db";
import { useUi } from "@/stores/ui";
import { cn } from "@/lib/utils";
import logo from "@/assets/nevalogo.png";

const WHATSAPP_URL =
  "https://wa.me/905051042851?text=" +
  encodeURIComponent(
    "Merhaba.\n\nNEVA MOBILE deneme sürem sona erdi.\n\nLisans satın almak istiyorum."
  );

interface Snapshot {
  phones: number;
  sales: number;
  expenses: number;
  customers: number;
  lastActivity: string | null;
}

/** Ekran açılırken TEK SEFER okunur; sürekli sorgu çalıştırılmaz. */
async function readSnapshot(): Promise<Snapshot> {
  const [row] = await select<{
    phones: number;
    sales: number;
    expenses: number;
    customers: number;
  }>(
    `SELECT
       (SELECT COUNT(*) FROM phones   WHERE deleted_at IS NULL) AS phones,
       (SELECT COUNT(*) FROM sales)                             AS sales,
       (SELECT COUNT(*) FROM expenses)                          AS expenses,
       (SELECT COUNT(*) FROM contacts WHERE type = 'customer')  AS customers`
  );
  const last = await selectOne<{ t: string | null }>(
    `SELECT MAX(t) AS t FROM (
       SELECT MAX(created_at) AS t FROM phones
       UNION ALL SELECT MAX(created_at) FROM sales
       UNION ALL SELECT MAX(created_at) FROM acquisitions
       UNION ALL SELECT MAX(date) FROM till_entries
     )`
  );
  let lastActivity: string | null = null;
  if (last?.t) {
    const d = new Date(last.t.replace(" ", "T"));
    if (!Number.isNaN(d.getTime())) {
      lastActivity =
        d.toLocaleDateString("tr-TR") +
        " " +
        d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
    }
  }
  return { ...row, lastActivity };
}

/** "📊 Verileriniz Güvende" bilgi kartı — canlı sayılar, cam efekti, giriş animasyonu. */
function DataSafePanel() {
  const [snap, setSnap] = useState<Snapshot | null>(null);

  useEffect(() => {
    readSnapshot()
      .then(setSnap)
      .catch(() => setSnap({ phones: 0, sales: 0, expenses: 0, customers: 0, lastActivity: null }));
  }, []);

  const items = snap
    ? ([
        { icon: Smartphone, label: `${snap.phones} Telefon Kaydı`, show: snap.phones > 0 },
        { icon: Banknote, label: `${snap.sales} Satış Kaydı`, show: snap.sales > 0 },
        { icon: Receipt, label: `${snap.expenses} Masraf Kaydı`, show: snap.expenses > 0 },
        { icon: Users, label: `${snap.customers} Müşteri Kaydı`, show: snap.customers > 0 },
        { icon: History, label: `Son işlem: ${snap.lastActivity}`, show: !!snap.lastActivity },
      ].filter((i) => i.show))
    : [];

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-surface/60 p-4 backdrop-blur-md",
        "animate-in fade-in slide-in-from-bottom-2 duration-500"
      )}
    >
      <div className="flex items-center gap-2">
        <ShieldCheck size={15} className="text-success" />
        <h2 className="text-[13px] font-semibold">Verileriniz Güvende</h2>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-1.5">
        {!snap ? (
          <p className="col-span-2 text-xs text-fg-muted">Kayıtlar okunuyor…</p>
        ) : items.length === 0 ? (
          <p className="col-span-2 flex items-center gap-1.5 text-xs text-fg-muted">
            <CheckCircle2 size={13} className="text-success" /> Henüz kayıt bulunmuyor.
          </p>
        ) : (
          items.map(({ icon: Icon, label }) => (
            <div
              key={label}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs",
                "transition-colors duration-150 hover:bg-surface-2",
                label.startsWith("Son işlem") && "col-span-2"
              )}
            >
              <Icon size={13} className="shrink-0 text-primary" />
              <span className="truncate">{label}</span>
            </div>
          ))
        )}
      </div>

      <p className="mt-3 border-t border-border pt-3 text-[11px] leading-relaxed text-fg-muted">
        Tüm kayıtlarınız güvenli bir şekilde korunmaktadır. Lisansınızı girdikten sonra
        hiçbir veri kaybetmeden kaldığınız yerden devam edebilirsiniz.
      </p>
    </div>
  );
}

/**
 * LICENSE REQUIRED — deneme süresi dolduğunda ana uygulamanın yerine geçen tam
 * ekran deneyim. Veri silinmez; kullanıcı lisans girer girmez LicenseGate yeniden
 * "valid" görür ve bu ekran otomatik kapanıp ana uygulama açılır.
 */
export function LicenseRequiredScreen() {
  const { license, setLicense, toast } = useUi();
  const [entryOpen, setEntryOpen] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function activate() {
    if (!code.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const st = await activateLicense(code.trim());
      setLicense(st); // state=valid → LicenseGate ana uygulamayı açar
      toast({ kind: "success", title: "Lisansınız aktifleştirildi — hoş geldiniz!" });
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function backup() {
    try {
      const path = await exportBackup();
      if (path) toast({ kind: "success", title: `Yedek oluşturuldu: ${path}` });
    } catch (e) {
      toast({ kind: "error", title: `Yedekleme başarısız: ${String(e)}` });
    }
  }

  return (
    <div className="flex h-full flex-col items-center justify-center overflow-y-auto bg-bg px-4 py-6">
      <div
        className={cn(
          "w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-xl",
          "animate-in fade-in zoom-in-95 duration-300"
        )}
      >
        {/* Başlık */}
        <div className="flex flex-col items-center gap-2 text-center">
          <img src={logo} alt="NEVA MOBILE" className="h-14 w-14 object-contain" draggable={false} />
          <div className="flex items-center gap-2">
            <Hourglass size={16} className="text-accent" />
            <h1 className="text-base font-semibold tracking-wide">Deneme Süreniz Sona Erdi</h1>
          </div>
          <p className="text-xs leading-relaxed text-fg-muted">
            NEVA MOBILE deneme sürümünü kullandığınız için teşekkür ederiz.
            <br />
            Deneme süreniz sona ermiştir. Tüm verileriniz güvenli bir şekilde korunmaktadır.
          </p>
          <p className="text-xs font-medium text-fg">
            Lisansınızı girdikten sonra kaldığınız yerden devam edebilirsiniz.
          </p>
        </div>

        {/* Bilgi paneli — butonların üstünde */}
        <div className="mt-5">
          <DataSafePanel />
        </div>

        {/* Lisans girişi (açılır bölüm) */}
        {entryOpen && (
          <div className="mt-4 space-y-3 rounded-lg border border-border bg-bg p-3 animate-in fade-in slide-in-from-top-1 duration-200">
            <div>
              <p className="text-xs font-medium text-fg-muted">Device ID</p>
              <div className="mt-1 flex items-center gap-2">
                <code className="flex-1 truncate rounded-md border border-border bg-surface px-2.5 py-1.5 font-mono text-xs">
                  {license?.deviceId ?? "…"}
                </code>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Device ID kopyala"
                  onClick={() => {
                    if (license?.deviceId) {
                      navigator.clipboard.writeText(license.deviceId);
                      toast({ kind: "info", title: "Device ID kopyalandı" });
                    }
                  }}
                >
                  <Copy size={13} />
                </Button>
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-fg-muted">Lisans Kodu</p>
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="NVM-….."
                rows={3}
                autoFocus
                className={cn(
                  "mt-1 w-full resize-none rounded-md border border-border-strong bg-surface px-3 py-2 font-mono text-xs",
                  "focus:border-primary focus:outline-2 focus:outline-offset-[-1px] focus:outline-ring/40",
                  error && "border-destructive"
                )}
              />
              {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
            </div>
            <Button
              variant="primary"
              className="w-full"
              disabled={!code.trim() || busy}
              onClick={activate}
            >
              <KeyRound size={14} />
              {busy ? "Doğrulanıyor…" : "Aktifleştir"}
            </Button>
          </div>
        )}

        {/* Aksiyonlar */}
        <div className="mt-4 space-y-2">
          {!entryOpen && (
            <Button variant="primary" size="lg" className="w-full" onClick={() => setEntryOpen(true)}>
              <KeyRound size={15} /> Lisans Kodu Gir
            </Button>
          )}
          <Button
            variant="secondary"
            size="lg"
            className="w-full"
            onClick={() => openUrl(WHATSAPP_URL)}
          >
            <MessageCircle size={15} className="text-success" /> WhatsApp ile İletişime Geç
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={backup}>
              <HardDriveDownload size={14} /> Verilerimi Yedekle
            </Button>
            <Button variant="ghost" onClick={() => exit(0)}>
              <X size={14} /> Uygulamayı Kapat
            </Button>
          </div>
        </div>
      </div>

      <p className="mt-4 text-[11px] text-fg-muted">
        Verileriniz güvende. Lisansınızı girdikten sonra kaldığınız yerden devam edebilirsiniz.
      </p>
    </div>
  );
}
