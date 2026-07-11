import { jsPDF } from "jspdf";
import { save } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";

const COMPANY_NAME = "NEVA MOBILE";

const TR_TO_ASCII: Record<string, string> = {
  ş: "s", Ş: "S", ı: "i", İ: "I", ğ: "g", Ğ: "G",
  ü: "u", Ü: "U", ö: "o", Ö: "O", ç: "c", Ç: "C",
};

/** jsPDF'nin standart fontu Turkce ozel karakterleri desteklemedigi icin ASCII'ye cevrilir. */
function trAscii(s: string): string {
  return s.replace(/[şŞıİğĞüÜöÖçÇ]/g, (c) => TR_TO_ASCII[c] ?? c);
}

function formatKurusPlain(kurus: number): string {
  const lira = kurus / 100;
  const text = lira.toLocaleString("tr-TR", { maximumFractionDigits: 2 });
  return `${trAscii(text)} TL`;
}

export interface DailyReportData {
  date: string;
  dailyRevenue: number;
  dailyProfit: number;
  posCommission: number;
  totalExpenses: number;
  salesCount: number;
  totalStock: number;
}

/**
 * Gun Sonu Raporu'nu PDF olarak uretir ve kullanicinin sectigi konuma yazar.
 * receipt-pdf.ts ile ayni yontem: jsPDF .save() WebView2'de calismadigi icin
 * bayt olarak uretilip Tauri kayit dialogu + write_binary_file ile yaziliyor.
 */
export async function generateDailyReportPdf(data: DailyReportData): Promise<boolean> {
  const doc = new jsPDF({ unit: "mm", format: "a5" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 14;
  let y = 18;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(37, 51, 219);
  doc.text(COMPANY_NAME, pageWidth / 2, y, { align: "center" });
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(110, 110, 120);
  doc.text(trAscii(`Gun Sonu Raporu - ${data.date}`), pageWidth / 2, y, { align: "center" });
  y += 4;
  doc.setDrawColor(230, 230, 236);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 12;

  const rows: [string, string][] = [
    [trAscii("Gunluk Ciro"), formatKurusPlain(data.dailyRevenue)],
    [trAscii("Gunluk Kar"), formatKurusPlain(data.dailyProfit)],
    [trAscii("POS Komisyonu"), formatKurusPlain(data.posCommission)],
    [trAscii("Toplam Masraf"), formatKurusPlain(data.totalExpenses)],
    [trAscii("Satis Sayisi"), `${data.salesCount} adet`],
    [trAscii("Toplam Stok"), `${data.totalStock} adet`],
  ];

  doc.setFontSize(11);
  for (const [label, value] of rows) {
    doc.setTextColor(120, 120, 130);
    doc.text(label, marginX, y);
    doc.setTextColor(20, 20, 26);
    doc.setFont("helvetica", "bold");
    doc.text(value, pageWidth - marginX, y, { align: "right" });
    doc.setFont("helvetica", "normal");
    y += 9;
  }

  y += 6;
  doc.setDrawColor(230, 230, 236);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 12;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(150, 150, 158);
  doc.text(trAscii("Bu rapor NEVA MOBILE tarafindan otomatik olarak olusturulmustur."), pageWidth / 2, y, {
    align: "center",
  });

  const targetPath = await save({
    title: "Gun Sonu Raporu (PDF)",
    defaultPath: `Gun_Sonu_Raporu_${data.date}.pdf`,
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });
  if (!targetPath) return false;

  const bytes = Array.from(new Uint8Array(doc.output("arraybuffer")));
  await invoke("write_binary_file", { targetPath, bytes });
  return true;
}
