import type { BrandProfile } from "./types";

export const AppleProfile: BrandProfile = {
  id: "apple",
  brands: ["apple"],
  showBatteryHealth: true,
  checks: [
    { key: "face_id_ok", label: "Face ID Çalışıyor", critical: true },
    { key: "true_tone_ok", label: "True Tone Aktif" },
    { key: "icloud_signed_out", label: "iCloud Çıkışı Yapıldı", critical: true },
    { key: "find_my_off", label: "Find My Kapalı", critical: true },
    { key: "original_screen", label: "Orijinal Ekran" },
    { key: "original_battery", label: "Orijinal Batarya" },
    { key: "esim_ok", label: "eSIM Sorunsuz" },
  ],
};
