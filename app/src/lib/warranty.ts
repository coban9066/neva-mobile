/**
 * Üretici garantisi: kullanıcı "ay.gün" formatında tek değer girer.
 *   "20.3" → 20 ay 3 gün · "2.17" → 2 ay 17 gün · "3" → 3 ay · "0.25" → 25 gün
 * Nokta ondalık değil ayraçtır; bitiş tarihi program tarafından hesaplanır,
 * kalan süre her açılışta bitiş tarihinden yeniden türetilir.
 */

export interface WarrantySpan {
  months: number;
  days: number;
}

export function parseWarrantyInput(raw: string): WarrantySpan | null {
  const cleaned = raw.trim().replace(",", ".");
  if (!/^\d{1,2}(\.\d{1,2})?$/.test(cleaned)) return null;
  const [m, d = "0"] = cleaned.split(".");
  const months = Number(m);
  const days = Number(d);
  if (days > 30 || (months === 0 && days === 0)) return null;
  return { months, days };
}

/** Bugünden itibaren bitiş tarihi (yerel, YYYY-MM-DD). */
export function warrantyEndDate({ months, days }: WarrantySpan): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Bitiş tarihine kalan gün; geçmişse negatif. */
export function remainingDays(until: string): number {
  const end = new Date(`${until}T23:59:59`);
  return Math.ceil((end.getTime() - Date.now()) / 86_400_000);
}

/** Kalan süreyi "20 Ay 3 Gün" biçiminde yazar (30 günlük ay yaklaşımı). */
export function formatSpan(totalDays: number): string {
  if (totalDays <= 0) return "Bitti";
  const months = Math.floor(totalDays / 30);
  const days = totalDays % 30;
  if (months === 0) return `${days} Gün`;
  if (days === 0) return `${months} Ay`;
  return `${months} Ay ${days} Gün`;
}

export type WarrantyTone = "default" | "warning" | "danger";

/** 30 gün altı turuncu, 7 gün altı kırmızı. */
export function warrantyTone(days: number): WarrantyTone {
  if (days < 7) return "danger";
  if (days < 30) return "warning";
  return "default";
}
