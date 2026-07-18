/** Tüm tutarlar DB'de INTEGER kuruş. UI'da ₺ olarak gösterilir. */

const fmt = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  maximumFractionDigits: 0,
});

const fmtPrecise = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  minimumFractionDigits: 2,
});

export function formatKurus(kurus: number | null | undefined): string {
  if (kurus == null) return "—";
  const lira = kurus / 100;
  return Number.isInteger(lira) ? fmt.format(lira) : fmtPrecise.format(lira);
}

/** Gizlilik Modu açıkken parasal değeri "********" ile maskeler. */
export function formatKurusPrivate(
  kurus: number | null | undefined,
  hidden: boolean
): string {
  return hidden ? "********" : formatKurus(kurus);
}

/** "14.500" | "14500" | "14500,50" → kuruş. Geçersizse null. */
export function parseLiraInput(raw: string): number | null {
  const cleaned = raw.trim().replace(/[₺\s]/g, "").replace(/\./g, "").replace(",", ".");
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}
