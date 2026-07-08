import { useState } from "react";
import { Moon, Sun, Copy, KeyRound, RefreshCw } from "lucide-react";
import { useUi } from "@/stores/ui";
import { useUpdate } from "@/stores/update";
import { useAppVersion } from "@/hooks/useAppVersion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { activateLicense, LICENSE_STATE_LABELS } from "@/lib/license";
import { cn } from "@/lib/utils";
import logo from "@/assets/nevalogo.png";

function UpdatesSection() {
  const { checking, checkForUpdates } = useUpdate();
  const version = useAppVersion();

  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <h2 className="text-xs font-semibold uppercase text-fg-muted">Güncellemeler</h2>
      <div className="mt-3 flex items-center justify-between">
        <div>
          <p className="text-[13px] font-medium">Mevcut Sürüm {version ?? "…"}</p>
          <p className="text-xs text-fg-muted">GitHub Releases üzerinden yeni sürüm kontrolü yapılır.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={checking}
          onClick={() => checkForUpdates()}
        >
          <RefreshCw size={13} className={checking ? "animate-spin" : undefined} />
          {checking ? "Kontrol ediliyor…" : "Güncellemeleri Kontrol Et"}
        </Button>
      </div>
    </section>
  );
}

function LicenseSection() {
  const { license, setLicense, toast } = useUi();
  const [editing, setEditing] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function update() {
    if (!code.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const st = await activateLicense(code.trim());
      setLicense(st);
      setEditing(false);
      setCode("");
      toast({ kind: "success", title: "Lisans güncellendi." });
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  const rows: [string, React.ReactNode][] = [
    [
      "Lisans Durumu",
      license ? (
        <Badge variant={license.state === "valid" ? "success" : "danger"}>
          {LICENSE_STATE_LABELS[license.state]}
        </Badge>
      ) : (
        "…"
      ),
    ],
    ["Lisans Türü", license?.planLabel ?? "—"],
    ["Başlangıç", license?.startDate ?? "—"],
    ["Bitiş", license?.endDate ?? "—"],
    [
      "Kalan Gün",
      license?.daysLeft != null ? `${license.daysLeft} gün` : license?.endDate === "Sınırsız" ? "∞" : "—",
    ],
    ["Lisans Kodu", license?.maskedCode ?? "—"],
  ];

  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <h2 className="text-xs font-semibold uppercase text-fg-muted">Lisans</h2>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 text-[13px]">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt className="text-[11px] uppercase text-fg-muted">{k}</dt>
            <dd className="mt-0.5 font-medium">{v}</dd>
          </div>
        ))}
        <div className="col-span-2">
          <dt className="text-[11px] uppercase text-fg-muted">Device ID</dt>
          <dd className="mt-0.5 flex items-center gap-2">
            <code className="rounded bg-bg px-2 py-1 font-mono text-xs">
              {license?.deviceId ?? "…"}
            </code>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Kopyala"
              onClick={() => {
                if (license?.deviceId) {
                  navigator.clipboard.writeText(license.deviceId);
                  toast({ kind: "info", title: "Device ID kopyalandı" });
                }
              }}
            >
              <Copy size={13} />
            </Button>
          </dd>
        </div>
      </dl>

      <div className="mt-4">
        {editing ? (
          <div className="space-y-2">
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Yeni lisans kodunu yapıştırın (NVM-…)"
              rows={2}
              className={cn(
                "w-full resize-none rounded-md border border-border-strong bg-bg px-3 py-2 font-mono text-xs",
                "focus:border-primary focus:outline-2 focus:outline-offset-[-1px] focus:outline-ring/40",
                error && "border-destructive"
              )}
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button variant="primary" size="sm" disabled={!code.trim() || busy} onClick={update}>
                {busy ? "Doğrulanıyor…" : "Kaydet"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                Vazgeç
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <KeyRound size={13} /> Lisansı Güncelle
          </Button>
        )}
      </div>
    </section>
  );
}

export function SettingsPage() {
  const { theme, setTheme } = useUi();
  const version = useAppVersion();

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="mx-auto flex max-w-2xl flex-col gap-3">
        <section className="rounded-lg border border-border bg-surface p-4">
          <h2 className="text-xs font-semibold uppercase text-fg-muted">Görünüm</h2>
          <div className="mt-3 flex items-center justify-between">
            <div>
              <p className="text-[13px] font-medium">Tema</p>
              <p className="text-xs text-fg-muted">Açık veya koyu görünüm</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
              {theme === "dark" ? "Açık tema" : "Koyu tema"}
            </Button>
          </div>
        </section>

        <LicenseSection />

        <UpdatesSection />

        <section className="rounded-lg border border-border bg-surface p-4">
          <h2 className="text-xs font-semibold uppercase text-fg-muted">Hakkında</h2>
          <div className="mt-3 flex items-center gap-4">
            <img
              src={logo}
              alt="NEVA MOBILE"
              className="h-14 w-14 object-contain"
              draggable={false}
            />
            <div>
              <p className="text-sm font-semibold tracking-wide">NEVA MOBILE</p>
              <p className="text-xs text-fg-muted">Telefon Alım Satım Yönetim Sistemi</p>
              <p className="mt-1 text-xs text-fg-muted">
                Sürüm {version ?? "…"} · © {new Date().getFullYear()} NEVA MOBILE
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
