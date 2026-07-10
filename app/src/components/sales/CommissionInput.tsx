import { cn } from "@/lib/utils";
import { parseLiraInput } from "@/lib/money";
import type { CommissionMode } from "./types";

/**
 * POS seçiliyken gösterilen banka komisyonu alanı. Yüzde veya TL olarak
 * girilebilir; ham metin state'te tutulur, sayısal değer üst bileşende
 * calcCommissionAmount ile hesaplanır.
 */
export function CommissionInput({
  mode,
  raw,
  onMode,
  onRaw,
}: {
  mode: CommissionMode;
  raw: string;
  onMode: (m: CommissionMode) => void;
  onRaw: (raw: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-fg-muted">Banka Komisyonu</label>
        <div className="flex rounded-md border border-border-strong p-0.5">
          {(["percent", "fixed"] as CommissionMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onMode(m)}
              className={cn(
                "h-6 cursor-pointer rounded px-2.5 text-[11px] font-medium transition-colors",
                mode === m ? "bg-primary text-on-primary" : "text-fg-muted hover:text-fg"
              )}
            >
              {m === "percent" ? "%" : "₺"}
            </button>
          ))}
        </div>
      </div>
      <div className="relative">
        <input
          value={raw}
          onChange={(e) => onRaw(e.target.value.replace(/[^\d.,]/g, ""))}
          placeholder={mode === "percent" ? "2.39" : "650"}
          inputMode="decimal"
          className="h-8 w-full rounded-md border border-border-strong bg-surface px-2.5 pr-8 text-[13px] tabular font-mono outline-none focus:border-primary"
        />
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-fg-muted">
          {mode === "percent" ? "%" : "₺"}
        </span>
      </div>
    </div>
  );
}

/** Komisyon giriş metnini (mode'a göre) hesap için sayısal değere çevirir. */
export function parseCommissionRaw(mode: CommissionMode, raw: string): number {
  if (!raw.trim()) return 0;
  if (mode === "percent") {
    const n = Number(raw.replace(",", "."));
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.round(n * 100); // yüzde*100 (Rust tarafındaki temsille aynı)
  }
  return parseLiraInput(raw) ?? 0; // fixed: kuruş
}
