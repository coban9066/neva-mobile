import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Modal: scrim %50 siyah, Esc ile kapanır, panel klavye odağını içeride tutar.
 * Kayıt formlarında Esc yanlışlıkla veri kaybettirmesin diye onClose üst bileşende korunabilir.
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  width = 560,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[8vh]">
      <div
        className="absolute inset-0 bg-black/50 animate-in fade-in duration-150"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative max-h-[82vh] overflow-hidden rounded-lg border border-border bg-surface shadow-2xl",
          "flex flex-col animate-in fade-in zoom-in-95 duration-150"
        )}
        style={{ width }}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Kapat"
            className="cursor-pointer rounded p-1 text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-border bg-surface-2/50 px-4 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
