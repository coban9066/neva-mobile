import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { getDb } from "./db";

/**
 * Veritabanını kullanıcının seçtiği konuma .nevabackup olarak dışarı aktarır.
 * Lisans durumundan bağımsız çalışır — deneme süresi dolsa bile veri her zaman
 * yedeklenebilir. Kullanıcı diyaloğu iptal ederse null döner, başarıda dosya yolu.
 */
export async function exportBackup(): Promise<string | null> {
  const stamp = new Date().toLocaleDateString("tr-TR").split(".").join("-"); // 09-07-2026
  const targetPath = await save({
    title: "Verilerimi Yedekle",
    defaultPath: `NEVA-YEDEK-${stamp}.nevabackup`,
    filters: [{ name: "NEVA MOBILE Yedek", extensions: ["nevabackup"] }],
  });
  if (!targetPath) return null;

  await getDb(); // havuz yüklü olmadan backup_database çalışamaz
  await invoke("backup_database", { targetPath });
  return targetPath;
}
