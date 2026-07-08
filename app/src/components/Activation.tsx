import { useState } from "react";
import { Copy, KeyRound, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { activateLicense, LICENSE_STATE_LABELS } from "@/lib/license";
import { useUi } from "@/stores/ui";
import { cn } from "@/lib/utils";
import logo from "@/assets/nevalogo.png";

/**
 * Lisans Aktivasyon ekranı — geçerli lisans yokken uygulamanın tek görünümü.
 * Kullanıcı Device ID'yi geliştiriciye gönderir, aldığı kodu yapıştırır.
 */
export function ActivationScreen() {
  const { license, setLicense, toast } = useUi();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stateNote =
    license && license.state !== "none" ? LICENSE_STATE_LABELS[license.state] : null;

  async function activate() {
    if (!code.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const st = await activateLicense(code.trim());
      setLicense(st);
      toast({ kind: "success", title: "Lisans aktifleştirildi — hoş geldiniz." });
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col items-center justify-center bg-bg px-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-8 shadow-xl animate-in fade-in zoom-in-95 duration-300">
        <div className="flex flex-col items-center gap-2 text-center">
          <img
            src={logo}
            alt="NEVA MOBILE"
            className="h-16 w-16 object-contain"
            draggable={false}
          />
          <h1 className="text-lg font-semibold tracking-wide">NEVA MOBILE</h1>
          <p className="text-xs text-fg-muted">Telefon Alım Satım Yönetim Sistemi</p>
        </div>

        {stateNote && (
          <div className="mt-4 flex items-center gap-2 rounded-md border border-warning/40 bg-warning/8 px-3 py-2 text-xs">
            <AlertTriangle size={13} className="shrink-0 text-warning" />
            {stateNote}
          </div>
        )}

        <div className="mt-6 space-y-4">
          <div>
            <p className="text-xs font-medium text-fg-muted">Device ID</p>
            <div className="mt-1 flex items-center gap-2">
              <code className="flex-1 rounded-md border border-border bg-bg px-3 py-2 font-mono text-sm">
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
                <Copy size={14} />
              </Button>
            </div>
            <p className="mt-1 text-[11px] text-fg-muted">
              Bu kodu geliştiriciye gönderin; size lisans kodu üretilecek.
            </p>
          </div>

          <div>
            <p className="text-xs font-medium text-fg-muted">Lisans Kodu</p>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="NVM-….."
              rows={3}
              className={cn(
                "mt-1 w-full resize-none rounded-md border border-border-strong bg-bg px-3 py-2 font-mono text-xs",
                "focus:border-primary focus:outline-2 focus:outline-offset-[-1px] focus:outline-ring/40",
                error && "border-destructive"
              )}
            />
            {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
          </div>

          <Button
            variant="primary"
            size="lg"
            className="w-full"
            disabled={!code.trim() || busy}
            onClick={activate}
          >
            <KeyRound size={15} />
            {busy ? "Doğrulanıyor…" : "Aktifleştir"}
          </Button>
        </div>
      </div>
      <p className="mt-4 text-[11px] text-fg-muted">
        Aktivasyon tamamen çevrimdışı çalışır — internet gerekmez.
      </p>
    </div>
  );
}
