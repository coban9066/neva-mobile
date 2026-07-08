import { CheckCircle2, XCircle, Info, X } from "lucide-react";
import { useUi } from "@/stores/ui";
import { cn } from "@/lib/utils";

const ICONS = {
  success: <CheckCircle2 size={15} className="text-success" />,
  error: <XCircle size={15} className="text-destructive" />,
  info: <Info size={15} className="text-secondary" />,
};

export function Toaster() {
  const { toasts, dismissToast } = useUi();
  if (!toasts.length) return null;

  return (
    <div className="pointer-events-none fixed bottom-8 right-4 z-[60] flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "pointer-events-auto flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2.5 shadow-lg",
            "animate-in slide-in-from-bottom-2 fade-in duration-200"
          )}
        >
          {ICONS[t.kind]}
          <span className="text-[13px]">{t.title}</span>
          {t.actions?.map((a) => (
            <button
              key={a.label}
              onClick={() => {
                a.onClick();
                dismissToast(t.id);
              }}
              className="cursor-pointer rounded px-1.5 py-0.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
            >
              {a.label}
            </button>
          ))}
          <button
            onClick={() => dismissToast(t.id)}
            aria-label="Kapat"
            className="cursor-pointer rounded p-0.5 text-fg-muted hover:text-fg"
          >
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}
