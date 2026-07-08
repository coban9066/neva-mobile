import type { BrandProfile } from "./types";

/** Tanımlı profili olmayan markalar: yalnızca ortak alanlar gösterilir. */
export const DefaultProfile: BrandProfile = {
  id: "default",
  brands: [],
  showBatteryHealth: false,
  checks: [],
};
