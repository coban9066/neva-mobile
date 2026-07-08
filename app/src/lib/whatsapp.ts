import type { Region } from "@/types";
import { formatKurus } from "@/lib/money";

export interface WhatsAppShareInput {
  brandName: string | null;
  modelName: string | null;
  storageGb: number | null;
  cosmeticGrade: string | null;
  batteryHealth: number | null;
  showBattery: boolean;
  region: Region | null;
  priceKurus: number;
}

const REGION_PLAIN_LABELS: Record<Region, string> = {
  domestic: "Yurt İçi",
  import: "Yurt Dışı",
};

/**
 * WhatsApp mesaj şablonu — düz metin, emojisiz. Bazı sistemlerde WhatsApp Web'e
 * giden URL'deki emoji "?" olarak bozulduğu için emoji tamamen kaldırıldı;
 * satırlar "---" ile ayrılarak okunabilirlik korunuyor. IMEI kesinlikle yok.
 */
export function buildWhatsAppMessage(input: WhatsAppShareInput): string {
  const title = [input.brandName, input.modelName].filter(Boolean).join(" ") || "Telefon";
  const lines: string[] = [title];

  if (input.storageGb) lines.push(`${input.storageGb} GB`);
  if (input.cosmeticGrade) lines.push(input.cosmeticGrade);
  if (input.showBattery && input.batteryHealth != null) lines.push(`Pil Sağlığı: %${input.batteryHealth}`);
  if (input.region) lines.push(REGION_PLAIN_LABELS[input.region]);

  lines.push(`Fiyat: ${formatKurus(input.priceKurus)}`);

  return lines.join("\n---\n");
}

export function whatsAppShareUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
