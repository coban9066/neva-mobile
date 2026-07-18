import { useState } from "react";
import { PanelLeft, Search, Tag, Plus, Moon, Sun } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { useNavigate } from "react-router-dom";
import { select } from "@/lib/db";
import { useUi, isReadOnly } from "@/stores/ui";
import { PHONE_STATUS_LABELS, type PhoneStatus } from "@/types";

interface TagHit {
  id: number;
  imei1: string | null;
  brand_name: string | null;
  model_name: string | null;
  etiket_numarasi: string | null;
  status: PhoneStatus;
}

export function Topbar() {
  const navigate = useNavigate();
  const { toggleSidebar, setCommandOpen, openQuickPurchase, openPhoneDrawer, theme, setTheme, license } =
    useUi();
  const readOnly = isReadOnly(license);
  const [tagQuery, setTagQuery] = useState("");

  const { data: tagHits = [] } = useQuery({
    queryKey: ["topbar-tag-search", tagQuery],
    enabled: tagQuery.trim().length > 0,
    queryFn: () =>
      select<TagHit>(
        `SELECT p.id, p.imei1, b.name AS brand_name, p.model AS model_name, p.etiket_numarasi, p.status
         FROM phones p
         LEFT JOIN brands b ON b.id = p.brand_id
         WHERE p.deleted_at IS NULL AND p.etiket_numarasi LIKE $1
         ORDER BY p.id DESC LIMIT 8`,
        [`%${tagQuery.trim()}%`]
      ),
  });

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

      <div className="relative w-36">
        <label className="sr-only" htmlFor="topbar-tag-search">
          Etiket No
        </label>
        <Tag size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-muted" />
        <input
          id="topbar-tag-search"
          value={tagQuery}
          onChange={(e) => setTagQuery(e.target.value)}
          placeholder="Etiket No…"
          className="h-8 w-full rounded-md border border-border-strong bg-bg pl-7 pr-2 text-[13px] placeholder:text-fg-muted focus:border-primary/50 focus:outline-none"
        />
        {tagQuery.trim().length > 0 && (
          <div className="absolute inset-x-0 top-9 z-50 overflow-hidden rounded-md border border-border bg-surface shadow-lg">
            {tagHits.length === 0 ? (
              <p className="px-2.5 py-2 text-xs text-fg-muted">Sonuç yok.</p>
            ) : (
              tagHits.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setTagQuery("");
                    openPhoneDrawer(p.id);
                  }}
                  className="flex w-full cursor-pointer items-center justify-between gap-2 px-2.5 py-1.5 text-left text-xs hover:bg-surface-2"
                >
                  <span className="font-mono font-semibold">{p.etiket_numarasi}</span>
                  <span className="flex-1 truncate text-fg-muted">
                    {p.brand_name} {p.model_name}
                  </span>
                  <span className="text-fg-muted">{PHONE_STATUS_LABELS[p.status]}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

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
