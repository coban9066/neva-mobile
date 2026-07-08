import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";

/** Kaydet + kısayol ipuçları. */
export function SaleActions({
  canSave,
  saving,
  onSave,
}: {
  canSave: boolean;
  saving: boolean;
  onSave: () => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="mr-auto text-[11px] text-fg-muted">
        <Kbd>⏎</Kbd> kaydet · <Kbd>Esc</Kbd> iptal · <Kbd>Ctrl F</Kbd> ara
      </span>
      <Button variant="primary" disabled={!canSave} onClick={onSave} className="min-w-36">
        {saving ? (
          "Kaydediliyor…"
        ) : (
          <>
            <Check size={14} /> Satışı Kaydet
          </>
        )}
      </Button>
    </div>
  );
}
