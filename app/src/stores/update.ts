import { create } from "zustand";
import { checkForUpdate, installPendingUpdate, type UpdateInfo } from "@/lib/updater";
import { useUi } from "@/stores/ui";

interface UpdateState {
  info: UpdateInfo | null;
  dialogOpen: boolean;
  checking: boolean;
  downloading: boolean;
  progress: number | null;

  checkForUpdates: (opts?: { silent?: boolean }) => Promise<void>;
  installUpdate: () => Promise<void>;
  closeDialog: () => void;
}

export const useUpdate = create<UpdateState>((set, get) => ({
  info: null,
  dialogOpen: false,
  checking: false,
  downloading: false,
  progress: null,

  checkForUpdates: async (opts = {}) => {
    if (get().checking || get().downloading) return;
    set({ checking: true });
    try {
      const info = await checkForUpdate();
      set({ checking: false, info, dialogOpen: info != null });
      if (!info && !opts.silent) {
        useUi.getState().toast({ kind: "info", title: "NEVA MOBILE güncel — yeni sürüm yok." });
      }
    } catch (e) {
      set({ checking: false });
      if (!opts.silent) {
        useUi.getState().toast({ kind: "error", title: `Güncelleme kontrolü başarısız: ${String(e)}` });
      }
    }
  },

  installUpdate: async () => {
    if (get().downloading) return;
    set({ downloading: true, progress: null });
    try {
      // Başarılıysa uygulama yeniden başlatılır; bu satırın altına dönülmez.
      await installPendingUpdate((percent) => set({ progress: percent }));
    } catch (e) {
      set({ downloading: false, progress: null });
      useUi.getState().toast({ kind: "error", title: `Güncelleme başarısız: ${String(e)}` });
    }
  },

  closeDialog: () => set({ dialogOpen: false, info: null }),
}));
