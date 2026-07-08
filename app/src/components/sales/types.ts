import type { CosmeticGrade, Region } from "@/types";

/** Satılabilir stok telefonu — PhoneSelector sorgusunun satırı. */
export interface StockPhone {
  id: number;
  label: string;
  imei1: string;
  storage_gb: number | null;
  color: string | null;
  cosmetic_grade: CosmeticGrade | null;
  region: Region | null;
  purchase_price: number;
  total_cost: number;
  warranty_until: string | null;
}

/** UI ödeme seçenekleri; DB sales CHECK'i credit_card tanımaz → pos'a eşlenir. */
export type SalePayment = "cash" | "transfer" | "pos" | "credit_card";

export const SALE_PAYMENT_LABELS: Record<SalePayment, string> = {
  cash: "Nakit",
  transfer: "Havale",
  pos: "POS",
  credit_card: "Kredi Kartı",
};

export function toDbPayment(p: SalePayment): string {
  return p === "credit_card" ? "pos" : p;
}
