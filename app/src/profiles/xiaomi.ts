import type { BrandProfile } from "./types";

export const XiaomiProfile: BrandProfile = {
  id: "xiaomi",
  brands: ["xiaomi", "redmi", "poco"],
  showBatteryHealth: false,
  checks: [
    { key: "bootloader_locked", label: "Bootloader Kilitli", critical: true },
    { key: "mi_account_out", label: "Mi Hesabı Çıkışı Yapıldı", critical: true },
  ],
};
