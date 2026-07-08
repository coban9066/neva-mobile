import { PanelLeft, Search, Plus, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { useNavigate } from "react-router-dom";
import { useUi, isReadOnly } from "@/stores/ui";

export function Topbar() {
  const navigate = useNavigate();
  const { toggleSidebar, setCommandOpen, openQuickPurchase, theme, setTheme, license } = useUi();
  const readOnly = isReadOnly(license);

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-surface px-3">
      <Button variant="ghost" size="icon" onClick={toggleSidebar} aria-label="Kenar çubuğunu daralt">
        <PanelLeft size={16} />
      </Button>

      <button
        onClick={() => setCommandOpen(true)}
        className="flex h-8 w-80 cursor-pointer items-center gap-2 rounded-md border border-border-strong bg-bg px-2.5 text-[13px] text-fg-muted transition-colors hover:border-primary/50"
      >
        <Search size={14} />
        <span className="flex-1 text-left">IMEI, model, kişi ara…</span>
        <Kbd>Ctrl K</Kbd>
      </button>

      <div className="flex-1" />

      <Button
        variant="outline"
        size="sm"
        disabled={readOnly}
        title={readOnly ? "Salt okunur mod — lisans gerekli" : undefined}
        onClick={() => openQuickPurchase()}
      >
        <Plus size={14} /> Alış <Kbd>F2</Kbd>
      </Button>
      <Button
        variant="primary"
        size="sm"
        disabled={readOnly}
        title={readOnly ? "Salt okunur mod — lisans gerekli" : undefined}
        onClick={() => navigate("/satislar", { state: { mode: "checkout" } })}
      >
        <Plus size={14} /> Satış <Kbd>F3</Kbd>
      </Button>

      <Button
        variant="ghost"
        size="icon"
        aria-label="Tema değiştir"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      >
        {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
      </Button>
    </header>
  );
}
