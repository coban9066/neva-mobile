import type { BrandProfile } from "./types";
import { AppleProfile } from "./apple";
import { SamsungProfile } from "./samsung";
import { XiaomiProfile } from "./xiaomi";
import { OppoProfile } from "./oppo";
import { HuaweiProfile } from "./huawei";
import { HonorProfile } from "./honor";
import { DefaultProfile } from "./default";

export type { BrandProfile, CheckDef } from "./types";

/** Kayıtlı profiller — yeni marka eklemek için dosyayı yazıp buraya ekleyin. */
const REGISTRY: BrandProfile[] = [
  AppleProfile,
  SamsungProfile,
  XiaomiProfile,
  OppoProfile,
  HuaweiProfile,
  HonorProfile,
];

/** Marka adından profil çözer; eşleşme yoksa DefaultProfile (ortak alanlar). */
export function getProfile(brandName: string | null | undefined): BrandProfile {
  if (!brandName) return DefaultProfile;
  const name = brandName.trim().toLowerCase();
  return REGISTRY.find((p) => p.brands.some((b) => name.includes(b))) ?? DefaultProfile;
}

/** check_key → etiket; badge üretiminde profil dışı hızlı erişim için. */
export function checkLabel(profile: BrandProfile, key: string): string | null {
  return profile.checks.find((c) => c.key === key)?.label ?? null;
}
