import { Copy } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { useUi } from "@/stores/ui";

export function ImeiCopyDialog({
  open,
  onClose,
  imei1,
  imei2,
}: {
  open: boolean;
  onClose: () => void;
  imei1: string | null;
  imei2: string | null;
}) {
  const { toast } = useUi();

  function copy(value: string) {
    navigator.clipboard.writeText(value);
    toast({ kind: "info", title: "IMEI panoya kopyalandı" });
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} title="IMEI Kopyala" width={340}>
      <div className="space-y-2">
        {imei1 ? (
          <button
            onClick={() => copy(imei1)}
            className="flex w-full cursor-pointer items-center justify-between rounded-md border border-border-strong bg-surface px-3 py-2 text-left transition-colors hover:border-primary/50 hover:bg-surface-2"
          >
            <span>
              <span className="block text-[10px] uppercase text-fg-muted">IMEI 1</span>
              <span className="font-mono text-sm">{imei1}</span>
            </span>
            <Copy size={14} className="text-fg-muted" />
          </button>
        ) : (
          <p className="rounded-md border border-dashed border-border-strong px-3 py-2 text-xs text-fg-muted">
            Bu telefona IMEI girilmemiş.
          </p>
        )}

        {imei2 && (
          <button
            onClick={() => copy(imei2)}
            className="flex w-full cursor-pointer items-center justify-between rounded-md border border-border-strong bg-surface px-3 py-2 text-left transition-colors hover:border-primary/50 hover:bg-surface-2"
          >
            <span>
              <span className="block text-[10px] uppercase text-fg-muted">IMEI 2</span>
              <span className="font-mono text-sm">{imei2}</span>
            </span>
            <Copy size={14} className="text-fg-muted" />
          </button>
        )}
      </div>
    </Dialog>
  );
}
