import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Smartphone,
  ArrowDownToLine,
  ArrowUpFromLine,
  ShieldCheck,
  Wallet,
  Settings,
  Database,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUi } from "@/stores/ui";
import logo from "@/assets/nevalogo.png";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, key: "1" },
  { to: "/telefonlar", label: "Telefonlar", icon: Smartphone, key: "2" },
  { to: "/alislar", label: "Alışlar", icon: ArrowDownToLine, key: "3" },
  { to: "/satislar", label: "Satışlar", icon: ArrowUpFromLine, key: "4" },
  { to: "/garanti", label: "Garanti", icon: ShieldCheck, key: "5" },
  { to: "/kasa", label: "Kasa", icon: Wallet, key: "6" },
  { to: "/ayarlar", label: "Ayarlar", icon: Settings, key: "7" },
  { to: "/veri-yonetimi", label: "Veri Yönetimi", icon: Database, key: "8" },
] as const;

export function Sidebar() {
  const collapsed = useUi((s) => s.sidebarCollapsed);

  return (
    <aside
      className={cn(
        "flex shrink-0 flex-col bg-sidebar text-sidebar-fg transition-[width] duration-200",
        collapsed ? "w-13" : "w-52"
      )}
    >
      <div className={cn("flex items-center gap-2.5 py-3", collapsed ? "px-2 justify-center" : "px-3.5")}>
        <img
          src={logo}
          alt="NEVA MOBILE"
          className="h-9 w-9 shrink-0 object-contain"
          draggable={false}
        />
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold tracking-wide text-white">
              NEVA MOBILE
            </p>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-2">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              cn(
                "flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px] transition-colors duration-150",
                isActive
                  ? "bg-sidebar-active/20 font-medium text-white"
                  : "hover:bg-white/5 hover:text-white"
              )
            }
          >
            <Icon size={16} strokeWidth={1.75} className="shrink-0" />
            {!collapsed && <span className="flex-1 truncate">{label}</span>}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
