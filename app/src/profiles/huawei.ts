import type { BrandProfile } from "./types";

export const HuaweiProfile: BrandProfile = {
  id: "huawei",
  brands: ["huawei"],
  showBatteryHealth: false,
  checks: [
    { key: "google_services", label: "Google Servisleri Var" },
    { key: "huawei_id_out", label: "Huawei ID Çıkışı Yapıldı", critical: true },
  ],
};
