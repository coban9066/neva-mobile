import { create } from "zustand";
import type { LicenseStatus } from "@/lib/license";

export interface Toast {
  id: number;
  title: string;
  kind: "success" | "error" | "info";
  actions?: { label: string; onClick: () => void }[];
}

interface UiState {
  theme: "light" | "dark";
  sidebarCollapsed: boolean;
  commandOpen: boolean;
  quickPurchaseOpen: boolean;
  /** Hızlı Alış'a önceden doldurulacak IMEI (barkod/komut paletinden) */
  quickPurchaseImei: string | null;
  phoneDrawerId: number | null;
  toasts: Toast[];
  license: LicenseStatus | null;

  setTheme: (t: "light" | "dark") => void;
  toggleSidebar: () => void;
  setCommandOpen: (v: boolean) => void;
  openQuickPurchase: (imei?: string) => void;
  closeQuickPurchase: () => void;
  openPhoneDrawer: (id: number) => void;
  closePhoneDrawer: () => void;
  toast: (t: Omit<Toast, "id">) => void;
  dismissToast: (id: number) => void;
  setLicense: (l: LicenseStatus) => void;
}

/** Salt okunur mod: lisans 'valid' değilse yazma işlemleri kilitli. */
export function isReadOnly(license: LicenseStatus | null): boolean {
  return license?.state !== "valid";
}

let toastSeq = 1;

export const useUi = create<UiState>((set) => ({
  theme: (localStorage.getItem("theme") as "light" | "dark") || "light",
  sidebarCollapsed: localStorage.getItem("sidebarCollapsed") === "1",
  commandOpen: false,
  quickPurchaseOpen: false,
  quickPurchaseImei: null,
  phoneDrawerId: null,
  toasts: [],
  license: null,

  setTheme: (theme) => {
    localStorage.setItem("theme", theme);
    document.documentElement.classList.toggle("dark", theme === "dark");
    set({ theme });
  },
  toggleSidebar: () =>
    set((s) => {
      localStorage.setItem("sidebarCollapsed", s.sidebarCollapsed ? "0" : "1");
      return { sidebarCollapsed: !s.sidebarCollapsed };
    }),
  setCommandOpen: (commandOpen) => set({ commandOpen }),
  openQuickPurchase: (imei) =>
    set({ quickPurchaseOpen: true, quickPurchaseImei: imei ?? null, commandOpen: false }),
  closeQuickPurchase: () => set({ quickPurchaseOpen: false, quickPurchaseImei: null }),
  openPhoneDrawer: (phoneDrawerId) => set({ phoneDrawerId }),
  closePhoneDrawer: () => set({ phoneDrawerId: null }),
  toast: (t) => {
    const id = toastSeq++;
    set((s) => ({ toasts: [...s.toasts, { ...t, id }] }));
    setTimeout(() => {
      useUi.getState().dismissToast(id);
    }, 6000);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  setLicense: (license) => set({ license }),
}));
