import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Command } from "cmdk";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Smartphone,
  ArrowDownToLine,
  ArrowUpFromLine,
  Wallet,
  Settings,
  Plus,
  Moon,
  ShieldCheck,
} from "lucide-react";
import { select } from "@/lib/db";
import { useUi } from "@/stores/ui";
import { formatKurus } from "@/lib/money";
import { PHONE_STATUS_LABELS, type PhoneStatus } from "@/types";
import { Kbd } from "@/components/ui/kbd";

interface PhoneHit {
  id: number;
  imei1: string;
  brand_name: string | null;
  model_name: string | null;
  storage_gb: number | null;
  color: string | null;
  status: PhoneStatus;
  total_cost: number | null;
}

const PAGES = [
  { label: "Dashboard", to: "/", icon: LayoutDashboard },
  { label: "Telefonlar", to: "/telefonlar", icon: Smartphone },
  { label: "Alışlar", to: "/alislar", icon: ArrowDownToLine },
  { label: "Satışlar", to: "/satislar", icon: ArrowUpFromLine },
  { label: "Garanti", to: "/garanti", icon: ShieldCheck },
  { label: "Kasa", to: "/kasa", icon: Wallet },
  { label: "Ayarlar", to: "/ayarlar", icon: Settings },
];

export function CommandPalette() {
  const { commandOpen, setCommandOpen, openQuickPurchase, openPhoneDrawer, theme, setTheme } =
    useUi();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!commandOpen) setQuery("");
  }, [commandOpen]);

  const { data: phones = [] } = useQuery({
    queryKey: ["palette-phones", query],
    enabled: commandOpen && query.trim().length >= 2,
    queryFn: () =>
      select<PhoneHit>(
        `SELECT p.id, p.imei1, b.name AS brand_name, p.model AS model_name,
                p.storage_gb, p.color, p.status,
                (SELECT c.total_cost FROM v_phone_cost c
                 WHERE c.acquisition_id = p.current_acquisition_id) AS total_cost
         FROM phones p
         LEFT JOIN brands b ON b.id = p.brand_id
         WHERE p.deleted_at IS NULL AND (
           p.imei1 LIKE $1 OR p.imei2 LIKE $1 OR
           (b.name || ' ' || p.model) LIKE $1 OR p.color LIKE $1
         )
         ORDER BY p.updated_at DESC, p.id DESC LIMIT 8`,
        [`%${query.trim()}%`]
      ),
  });

  if (!commandOpen) return null;

  const close = () => setCommandOpen(false);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[14vh]">
      <div className="absolute inset-0 bg-black/50" onClick={close} />
      <Command
        shouldFilter={query.trim().length < 2 || phones.length === 0}
        className="relative w-[620px] overflow-hidden rounded-lg border border-border bg-surface shadow-2xl"
      >
        <Command.Input
          autoFocus
          value={query}
          onValueChange={setQuery}
          placeholder="IMEI, model, kişi veya komut yaz…"
          className="h-11 w-full border-b border-border bg-transparent px-4 text-sm outline-none placeholder:text-fg-muted"
          onKeyDown={(e) => {
            if (e.key === "Escape") close();
          }}
        />
        <Command.List className="max-h-[50vh] overflow-y-auto p-1.5">
          <Command.Empty className="py-8 text-center text-xs text-fg-muted">
            Sonuç yok.
          </Command.Empty>

          {phones.length > 0 && (
            <Command.Group
              heading="Telefonlar"
              className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:text-fg-muted"
            >
              {phones.map((p) => (
                <Command.Item
                  key={p.id}
                  value={`phone-${p.id}`}
                  onSelect={() => {
                    close();
                    openPhoneDrawer(p.id);
                  }}
                  className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-[13px] data-[selected=true]:bg-primary/10"
                >
                  <Smartphone size={15} className="text-fg-muted" />
                  <span className="font-medium">
                    {p.brand_name} {p.model_name}
                  </span>
                  <span className="text-fg-muted">
                    {p.storage_gb ? `${p.storage_gb}GB` : ""} {p.color ?? ""}
                  </span>
                  <span className="font-mono text-xs text-fg-muted">…{p.imei1.slice(-6)}</span>
                  <span className="flex-1" />
                  <span className="text-xs text-fg-muted">
                    {PHONE_STATUS_LABELS[p.status]}
                  </span>
                  {p.total_cost != null && (
                    <span className="tabular text-xs font-medium">
                      {formatKurus(p.total_cost)}
                    </span>
                  )}
                </Command.Item>
              ))}
            </Command.Group>
          )}

          <Command.Group
            heading="Aksiyonlar"
            className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:text-fg-muted"
          >
            <Command.Item
              value="hızlı alış yeni telefon al"
              onSelect={() => openQuickPurchase(query && /^\d+$/.test(query) ? query : undefined)}
              className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-[13px] data-[selected=true]:bg-primary/10"
            >
              <Plus size={15} className="text-fg-muted" /> Hızlı Alış
              <span className="flex-1" />
              <Kbd>F2</Kbd>
            </Command.Item>
            <Command.Item
              value="tema koyu açık değiştir"
              onSelect={() => {
                setTheme(theme === "dark" ? "light" : "dark");
                close();
              }}
              className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-[13px] data-[selected=true]:bg-primary/10"
            >
              <Moon size={15} className="text-fg-muted" /> Temayı değiştir
            </Command.Item>
          </Command.Group>

          <Command.Group
            heading="Sayfalar"
            className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:text-fg-muted"
          >
            {PAGES.map(({ label, to, icon: Icon }) => (
              <Command.Item
                key={to}
                value={`sayfa ${label}`}
                onSelect={() => {
                  close();
                  navigate(to);
                }}
                className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-[13px] data-[selected=true]:bg-primary/10"
              >
                <Icon size={15} className="text-fg-muted" /> {label}
              </Command.Item>
            ))}
          </Command.Group>
        </Command.List>
      </Command>
    </div>
  );
}
