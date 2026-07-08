import type { BrandProfile } from "./types";

export const SamsungProfile: BrandProfile = {
  id: "samsung",
  brands: ["samsung"],
  showBatteryHealth: false,
  checks: [
    { key: "amoled_clean", label: "AMOLED Yanığı Yok", critical: true },
    { key: "knox_ok", label: "Knox Sorunsuz", critical: true },
  ],
};
