/**
 * Türk telefon numarası yardımcıları.
 * - Girdi serbest ("0532 123 45 67", "+90 532...", "532...") kabul edilir.
 * - Saklama biçimi: yalnız rakamlar, 11 hane, başında 0 (05321234567).
 * - Gösterim biçimi: "0532 123 45 67".
 */

/** Kaydetmeden önce normalize: sadece rakam; +90/90 baş kırpılır; 0 ile 11 haneye tamamlanır. */
export function normalizePhone(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("90") && d.length === 12) d = d.slice(2);
  if (d.length === 10 && d.startsWith("5")) d = "0" + d;
  return d.slice(0, 11);
}

/** Ekranda okunur biçim: 0532 123 45 67. Tanınmayan girdiyi olduğu gibi döndürür. */
export function formatPhone(value: string | null | undefined): string {
  if (!value) return "";
  const d = normalizePhone(value);
  if (d.length === 11 && d.startsWith("0")) {
    return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7, 9)} ${d.slice(9, 11)}`;
  }
  return value;
}

/** wa.me için ülke kodlu biçim: 905321234567. Geçersizse null. */
export function whatsappNumber(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = normalizePhone(value);
  if (d.length === 11 && d.startsWith("0")) return "90" + d.slice(1);
  return null;
}
