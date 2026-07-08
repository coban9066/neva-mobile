import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import logo from "@/assets/nevalogo.png";

/** Açılış ekranı: logo + marka, fade-out. Toplam <1 sn — hız kuralını bozmaz. */
export function Splash() {
  const [phase, setPhase] = useState<"visible" | "fading" | "gone">("visible");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("fading"), 650);
    const t2 = setTimeout(() => setPhase("gone"), 950);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  if (phase === "gone") return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-[100] flex flex-col items-center justify-center gap-3 bg-bg transition-opacity duration-300",
        phase === "fading" ? "opacity-0" : "opacity-100"
      )}
    >
      <img
        src={logo}
        alt="NEVA MOBILE"
        className="h-20 w-20 object-contain animate-in fade-in zoom-in-95 duration-500"
        draggable={false}
      />
      <div className="text-center animate-in fade-in duration-500">
        <p className="text-lg font-semibold tracking-wide">NEVA MOBILE</p>
        <p className="text-xs text-fg-muted">Telefon Alım Satım Yönetim Sistemi</p>
      </div>
    </div>
  );
}
