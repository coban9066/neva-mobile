export type PhoneStatus =
  | "in_stock"
  | "reserved"
  | "sold"
  | "returned"
  | "scrap"
  | "consigned";

export type Ownership = "stock" | "consignment";
export type PaymentMethod = "cash" | "pos" | "transfer" | "mixed";
export type CosmeticGrade = "Sıfır" | "Sıfır Gibi" | "İyi" | "Normal" | "Temiz Kullanılmış";
export type Region = "domestic" | "import";

export const REGION_LABELS: Record<Region, string> = {
  domestic: "🇹🇷 Yurt İçi",
  import: "🌍 Yurt Dışı",
};

export const PHONE_STATUS_LABELS: Record<PhoneStatus, string> = {
  in_stock: "Stokta",
  reserved: "Rezerve",
  sold: "Satıldı",
  returned: "İade",
  scrap: "Hurda",
  consigned: "Konsinye",
};

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: "Nakit",
  pos: "POS",
  transfer: "Havale",
  mixed: "Karma",
};

export interface Brand {
  id: number;
  name: string;
}

export interface Model {
  id: number;
  brand_id: number;
  name: string;
  storage_options: string; // JSON dizisi: [64,128,256]
}

export interface Contact {
  id: number;
  type: "customer" | "supplier" | "both";
  full_name: string;
  phone_number: string | null;
}

export interface PhoneRow {
  id: number;
  imei1: string;
  imei2: string | null;
  brand_name: string | null;
  model_name: string | null;
  color: string | null;
  storage_gb: number | null;
  cosmetic_grade: CosmeticGrade | null;
  battery_health: number | null;
  status: PhoneStatus;
  ownership: Ownership;
  region: Region | null;
  total_cost: number | null;
  last_event_at: string | null;
  notes: string | null;
  etiket_numarasi: string | null;
}

export interface TimelineEvent {
  phone_id: number;
  date: string;
  event_type:
    | "acquisition"
    | "sale"
    | "expense"
    | "part"
    | "warranty_return"
    | "return"
    | "reservation";
  ref_id: number;
  amount: number;
  note: string | null;
}

export const TIMELINE_LABELS: Record<TimelineEvent["event_type"], string> = {
  acquisition: "Alındı",
  sale: "Satıldı",
  expense: "Masraf",
  part: "Parça değişimi",
  warranty_return: "Garanti dönüşü",
  return: "İade",
  reservation: "Rezervasyon",
};

/** Bir alış turuna ("current_acquisition_id") bağlı serbest metin masraf kaydı. */
export interface Expense {
  id: number;
  acquisition_id: number;
  category: string;
  amount: number;
  date: string;
}
