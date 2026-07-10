import { jsPDF } from "jspdf";
import { save } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { formatDateTime } from "@/lib/utils";

export interface ReceiptData {
  saleId: number;
  model: string;
  imei: string;
  date: string;
  price: number;
  paymentLabel: string;
  commissionAmount: number;
  warrantyText: string | null;
  buyerName: string | null;
}

const COMPANY_NAME = "NEVA MOBILE";

const TR_TO_ASCII: Record<string, string> = {
  ş: "s", Ş: "S", ı: "i", İ: "I", ğ: "g", Ğ: "G",
  ü: "u", Ü: "U", ö: "o", Ö: "O", ç: "c", Ç: "C",
};

/**
 * jsPDF'nin standart (Helvetica) fontu Türkçe özel karakterleri (ş,ı,ğ,ü,ö,ç)
 * ve ₺ işaretini WinAnsi kod sayfasında bulamadığı için bozuk gösteriyor
 * (ör. "Satış" -> "Sat1_"). Unicode font gömmek yerine (ek bağımlılık, risk)
 * PDF'e özel ASCII'ye çeviriyoruz — okunabilir ve garantili doğru render olur.
 */
function trAscii(s: string): string {
  return s.replace(/[şŞıİğĞüÜöÖçÇ]/g, (c) => TR_TO_ASCII[c] ?? c);
}

/** PDF'te ₺ sembolü yerine "TL" son eki — Helvetica'da ₺ glifi yok. */
function formatKurusPlain(kurus: number): string {
  const lira = kurus / 100;
  const text = lira.toLocaleString("tr-TR", { maximumFractionDigits: 2 });
  return `${trAscii(text)} TL`;
}

/**
 * Satış fişini PDF olarak üretir ve kullanıcının seçtiği konuma yazar.
 * jsPDF'nin kendi `.save()` çağrısı tarayıcı indirme API'sine (Blob/`<a download>`)
 * dayanır ve WebView2 içinde çalışmaz; bunun yerine PDF bayt olarak üretilip
 * Tauri kayıt diyaloğu + `write_binary_file` komutuyla gerçek dosyaya yazılır.
 * Kullanıcı diyaloğu iptal ederse sessizce çıkar.
 */
export async function generateReceiptPdf(data: ReceiptData): Promise<void> {
  const doc = new jsPDF({ unit: "mm", format: "a5" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 14;
  let y = 18;

  // Başlık
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(37, 51, 219);
  doc.text(COMPANY_NAME, pageWidth / 2, y, { align: "center" });
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(110, 110, 120);
  doc.text(trAscii("Telefon Alım Satım Yönetim Sistemi"), pageWidth / 2, y, { align: "center" });
  y += 4;
  doc.setDrawColor(230, 230, 236);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 10;

  doc.setFontSize(14);
  doc.setTextColor(20, 20, 26);
  doc.setFont("helvetica", "bold");
  doc.text(trAscii("Satış Fişi"), marginX, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(140, 140, 150);
  doc.text(trAscii(`Fiş No: #${data.saleId}`), pageWidth - marginX, y, { align: "right" });
  y += 10;

  const rows: [string, string][] = [
    [trAscii("Telefon Modeli"), trAscii(data.model)],
    ["IMEI", data.imei],
    [trAscii("Satış Tarihi"), formatDateTime(data.date)],
    [trAscii("Alıcı Adı"), trAscii(data.buyerName ?? "-")],
    [trAscii("Ödeme Türü"), trAscii(data.paymentLabel)],
    [trAscii("Satış Fiyatı"), formatKurusPlain(data.price)],
    ...(data.commissionAmount > 0
      ? ([[trAscii("Banka Komisyonu"), `-${formatKurusPlain(data.commissionAmount)}`]] as [
          string,
          string,
        ][])
      : []),
    ["Garanti", trAscii(data.warrantyText ?? "Yok")],
  ];

  doc.setFontSize(10.5);
  for (const [label, value] of rows) {
    doc.setTextColor(120, 120, 130);
    doc.text(label, marginX, y);
    doc.setTextColor(20, 20, 26);
    doc.setFont("helvetica", "bold");
    doc.text(value, pageWidth - marginX, y, { align: "right" });
    doc.setFont("helvetica", "normal");
    y += 7.5;
  }

  y += 4;
  doc.setDrawColor(230, 230, 236);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 8;

  const netTotal = data.price - data.commissionAmount;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(37, 51, 219);
  doc.text(trAscii("Kasaya Giren"), marginX, y);
  doc.text(formatKurusPlain(netTotal), pageWidth - marginX, y, { align: "right" });

  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(150, 150, 158);
  doc.text(trAscii("Bu fiş NEVA MOBILE tarafından otomatik olarak oluşturulmuştur."), pageWidth / 2, y, {
    align: "center",
  });

  const targetPath = await save({
    title: "PDF Satış Fişi",
    defaultPath: `Satis_Fisi_${data.saleId}.pdf`,
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });
  if (!targetPath) return;

  const bytes = Array.from(new Uint8Array(doc.output("arraybuffer")));
  await invoke("write_binary_file", { targetPath, bytes });
}
