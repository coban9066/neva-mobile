import type { BrandProfile } from "./types";

export const OppoProfile: BrandProfile = {
  id: "oppo",
  brands: ["oppo", "realme"],
  showBatteryHealth: false,
  checks: [{ key: "account_signed_out", label: "Hesap Çıkışı Yapıldı", critical: true }],
};
