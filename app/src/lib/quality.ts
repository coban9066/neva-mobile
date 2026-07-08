import type { CosmeticGrade } from "@/types";

/** Kozmetik kademeleri — DB'deki metin aynen etiket olarak kullanılır, olumsuz ifade yok. */
export interface GradeMeta {
  grade: CosmeticGrade;
  stars: number; // 5 üzerinden
  label: string;
  description: string;
}

export const GRADES: GradeMeta[] = [
  { grade: "Sıfır", stars: 5, label: "Sıfır", description: "Kutulu / hiç açılmamış" },
  { grade: "Sıfır Gibi", stars: 5, label: "Sıfır Gibi", description: "Neredeyse yeni" },
  { grade: "İyi", stars: 4, label: "İyi", description: "Az kullanılmış" },
  { grade: "Normal", stars: 3, label: "Normal", description: "Normal kullanım izleri" },
  { grade: "Temiz Kullanılmış", stars: 2, label: "Temiz Kullanılmış", description: "Kullanılmış, bakımlı" },
];

export const GRADE_META: Record<CosmeticGrade, GradeMeta> = Object.fromEntries(
  GRADES.map((g) => [g.grade, g])
) as Record<CosmeticGrade, GradeMeta>;

export type QualityTone = "success" | "warning" | "danger";

export interface BatteryStatus {
  label: string;
  tone: QualityTone;
}

/** Pil yüzdesini anlamlı geri bildirime çevirir: ≥90 Çok İyi, ≥85 İyi, ≥80 Normal, <80 Değişmeli. */
export function batteryStatus(pct: number): BatteryStatus {
  if (pct >= 90) return { label: "Çok İyi", tone: "success" };
  if (pct >= 85) return { label: "İyi", tone: "success" };
  if (pct >= 80) return { label: "Normal", tone: "warning" };
  return { label: "Değişmeli", tone: "danger" };
}

export const QUALITY_TONE_CLASS: Record<QualityTone, string> = {
  success: "bg-success/12 text-success",
  warning: "bg-warning/12 text-warning",
  danger: "bg-destructive/12 text-destructive",
};
