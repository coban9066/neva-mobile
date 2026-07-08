import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export interface UpdateInfo {
  currentVersion: string;
  version: string;
  notes: string | null;
  date: string | null;
}

/** check() sonucundaki Update kaynağı; installPendingUpdate bunu kullanır. */
let pending: Update | null = null;

export async function checkForUpdate(): Promise<UpdateInfo | null> {
  const update = await check();
  pending = update;
  if (!update) return null;
  return {
    currentVersion: update.currentVersion,
    version: update.version,
    notes: update.body ?? null,
    date: update.date ?? null,
  };
}

/** İndirir, sessizce kurar ve uygulamayı yeniden başlatır. Yarım bırakmaz: hata durumunda eski sürüm çalışmaya devam eder. */
export async function installPendingUpdate(
  onProgress?: (percent: number | null) => void
): Promise<void> {
  const update = pending;
  if (!update) throw new Error("Kontrol edilmiş bir güncelleme yok.");

  let total = 0;
  let received = 0;
  await update.downloadAndInstall((event) => {
    if (event.event === "Started") {
      total = event.data.contentLength ?? 0;
      received = 0;
      onProgress?.(total ? 0 : null);
    } else if (event.event === "Progress") {
      received += event.data.chunkLength;
      onProgress?.(total ? Math.min(100, Math.round((received / total) * 100)) : null);
    } else if (event.event === "Finished") {
      onProgress?.(100);
    }
  });

  pending = null;
  await relaunch();
}
