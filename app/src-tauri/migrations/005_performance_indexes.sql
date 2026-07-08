-- Performans İndeksleri: IMEI aramaları, silme filtreleri ve referans eşleştirmeleri için
CREATE INDEX IF NOT EXISTS idx_phones_imei2 ON phones(imei2) WHERE imei2 IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_phones_deleted ON phones(deleted_at);
CREATE INDEX IF NOT EXISTS idx_sales_deleted ON sales(deleted_at);
CREATE INDEX IF NOT EXISTS idx_acquisitions_deleted ON acquisitions(deleted_at);
CREATE INDEX IF NOT EXISTS idx_till_ref ON till_entries(ref_type, ref_id);
CREATE INDEX IF NOT EXISTS idx_ledger_ref ON ledger_entries(ref_type, ref_id);
