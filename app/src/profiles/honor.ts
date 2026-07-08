import type { BrandProfile } from "./types";

export const HonorProfile: BrandProfile = {
  id: "honor",
  brands: ["honor"],
  showBatteryHealth: false,
  checks: [
    { key: "google_services", label: "Google Servisleri Var" },
    { key: "honor_id_out", label: "Honor ID Çıkışı Yapıldı", critical: true },
  ],
};
