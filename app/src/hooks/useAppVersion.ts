import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";

/** Çalışan uygulamanın gerçek sürümünü döner (build sonrası güncellemelerde de doğru kalır). */
export function useAppVersion(): string | null {
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    getVersion()
      .then(setVersion)
      .catch(() => setVersion(null));
  }, []);

  return version;
}
