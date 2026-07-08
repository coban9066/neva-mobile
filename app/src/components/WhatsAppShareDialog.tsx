import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { parseLiraInput } from "@/lib/money";
import { getProfile } from "@/profiles";
import { buildWhatsAppMessage, whatsAppShareUrl } from "@/lib/whatsapp";
import { useUi } from "@/stores/ui";
import type { Region } from "@/types";

export interface ShareablePhone {
  brand_name: string | null;
  model_name: string | null;
  storage_gb: number | null;
  cosmetic_grade: string | null;
  battery_health: number | null;
  region: Region | null;
  total_cost: number | null;
  notes?: string | null;
}

/** WhatsApp Desktop/Web'i hazır mesajla açar; gönderimi ve alıcı seçimini kullanıcı yapar. */
export function WhatsAppShareDialog({
  open,
  onClose,
  phone,
}: {
  open: boolean;
  onClose: () => void;
  phone: ShareablePhone | null;
}) {
  const { toast } = useUi();
  const [priceRaw, setPriceRaw] = useState("");

  useEffect(() => {
    if (open && phone) {
      setPriceRaw(phone.total_cost != null ? String(phone.total_cost / 100) : "");
    }
  }, [open, phone]);

  if (!phone) return null;
  const price = parseLiraInput(priceRaw);
  const showBattery = getProfile(phone.brand_name).showBatteryHealth;

  const message = buildWhatsAppMessage({
    brandName: phone.brand_name,
    modelName: phone.model_name,
    storageGb: phone.storage_gb,
    cosmeticGrade: phone.cosmetic_grade,
    batteryHealth: phone.battery_health,
    showBattery,
    region: phone.region,
    priceKurus: price ?? 0,
  });

  async function share() {
    await openUrl(whatsAppShareUrl(message));
    toast({ kind: "info", title: "WhatsApp açıldı — göndermek için alıcıyı seçin." });
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="WhatsApp'ta Paylaş"
      width={420}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Vazgeç
          </Button>
          <Button variant="primary" size="sm" disabled={price === null} onClick={share}>
            <MessageCircle size={13} /> WhatsApp'ta Aç
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Fiyat (₺)">
          <Input
            value={priceRaw}
            onChange={(e) => setPriceRaw(e.target.value.replace(/[^\d.,]/g, ""))}
            placeholder="35.000"
            inputMode="decimal"
            className="tabular font-mono"
          />
        </Field>
        <div>
          <p className="mb-1 text-[11px] uppercase text-fg-muted">Önizleme</p>
          <pre className="max-h-52 overflow-y-auto whitespace-pre-wrap rounded-md bg-bg p-2.5 font-sans text-xs text-fg">
            {message}
          </pre>
        </div>
        {price === null && (
          <p className="text-xs text-destructive">Paylaşmak için geçerli bir fiyat girin.</p>
        )}
        <p className="text-[11px] text-fg-muted">
          Mesajı hazırlar; alıcıyı seçip göndermeyi WhatsApp'ta siz yaparsınız.
        </p>
      </div>
    </Dialog>
  );
}
