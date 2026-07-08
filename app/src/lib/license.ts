import { invoke } from "@tauri-apps/api/core";
import { getDb } from "./db";

export type LicenseState =
  | "none"
  | "invalid"
  | "device_mismatch"
  | "clock_rollback"
  | "expired"
  | "valid";

export interface LicenseStatus {
  state: LicenseState;
  deviceId: string;
  planLabel: string | null;
  startDate: string | null;
  endDate: string | null;
  daysLeft: number | null;
  maskedCode: string | null;
}

/** DB yüklendikten sonra çağrılmalı (settings tablosu gerekli). */
export async function fetchLicenseStatus(): Promise<LicenseStatus> {
  await getDb();
  return invoke<LicenseStatus>("get_license_status");
}

export async function activateLicense(code: string): Promise<LicenseStatus> {
  await getDb();
  return invoke<LicenseStatus>("activate_license", { code });
}

export const LICENSE_STATE_LABELS: Record<LicenseState, string> = {
  none: "Lisans yok",
  invalid: "Geçersiz kod",
  device_mismatch: "Kod bu cihaza ait değil",
  clock_rollback: "Sistem saati tutarsız",
  expired: "Süresi doldu",
  valid: "Aktif",
};
