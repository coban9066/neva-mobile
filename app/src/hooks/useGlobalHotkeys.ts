import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useUi, isReadOnly } from "@/stores/ui";
import { selectOne } from "@/lib/db";

const NAV_KEYS: Record<string, string> = {
  "1": "/",
  "2": "/telefonlar",
  "3": "/alislar",
  "4": "/satislar",
  "5": "/garanti",
  "6": "/kasa",
  "7": "/ayarlar",
  "8": "/veri-yonetimi",
  "9": "/bekleyen-odemeler",
};

/**
 * Global kısayollar + barkod okuyucu dinleyici.
 * Barkod okuyucular HID klavye gibi çok hızlı rakam basar; 15 haneyi
 * ≤400ms aralıklı ardışık girişle tamamlarsa IMEI kabul edilir.
 */
export function useGlobalHotkeys() {
  const navigate = useNavigate();
  const buffer = useRef("");
  const lastKeyAt = useRef(0);

  useEffect(() => {
    async function onImeiScanned(imei: string) {
      const { openPhoneDrawer, openQuickPurchase, toast, license } = useUi.getState();
      const row = await selectOne<{ id: number }>(
        "SELECT id FROM phones WHERE (imei1 = $1 OR imei2 = $1) AND deleted_at IS NULL",
        [imei]
      );
      if (row) {
        openPhoneDrawer(row.id);
      } else if (isReadOnly(license)) {
        toast({ kind: "info", title: "IMEI kayıtlı değil — salt okunur modda alış yapılamaz." });
      } else {
        toast({ kind: "info", title: `IMEI kayıtlı değil: …${imei.slice(-6)}` });
        openQuickPurchase(imei);
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      const { setCommandOpen, openQuickPurchase, toggleSidebar, commandOpen } =
        useUi.getState();
      const inField =
        e.target instanceof HTMLElement &&
        (e.target.tagName === "INPUT" ||
          e.target.tagName === "TEXTAREA" ||
          e.target.isContentEditable);

      // Ctrl+K — command palette
      if (e.ctrlKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen(!commandOpen);
        return;
      }
      // Ctrl+B — sidebar
      if (e.ctrlKey && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleSidebar();
        return;
      }
      // Ctrl+1..0 — modül geçişi
      if (e.ctrlKey && !e.shiftKey && NAV_KEYS[e.key]) {
        e.preventDefault();
        navigate(NAV_KEYS[e.key]);
        return;
      }
      // F2 — hızlı alış, F3 — satış, F4 — IMEI ara (palette)
      if (e.key === "F2") {
        e.preventDefault();
        const { license, toast } = useUi.getState();
        if (isReadOnly(license)) {
          toast({ kind: "info", title: "Salt okunur mod — alış için lisans gerekli." });
        } else {
          openQuickPurchase();
        }
        return;
      }
      if (e.key === "F3") {
        e.preventDefault();
        const { license, toast } = useUi.getState();
        if (isReadOnly(license)) {
          toast({ kind: "info", title: "Salt okunur mod — satış için lisans gerekli." });
        } else {
          navigate("/satislar", { state: { mode: "checkout" } });
        }
        return;
      }
      if (e.key === "F4") {
        e.preventDefault();
        setCommandOpen(true);
        return;
      }

      // Barkod dinleyici: input dışında hızlı rakam serisi
      if (!inField && !e.ctrlKey && !e.altKey && /^\d$/.test(e.key)) {
        const now = Date.now();
        if (now - lastKeyAt.current > 400) buffer.current = "";
        lastKeyAt.current = now;
        buffer.current += e.key;
        if (buffer.current.length === 15) {
          const imei = buffer.current;
          buffer.current = "";
          void onImeiScanned(imei);
        }
      } else if (!/^\d$/.test(e.key)) {
        buffer.current = "";
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate]);
}
