-- Kozmetik kademe listesi yeniden tanımlandı: olumsuz ifade (Kötü/Yıpranmış) kaldırıldı.
-- Eski A/B/C/D verisi en yakın yeni karşılığa taşınır.
--
-- ÖNEMLİ (bkz. 009): v_stock_value, "phones" tablosunu doğrudan referans eder;
-- ALTER TABLE ... RENAME TO sırasında bu view yeniden çözümlenmeye çalışılıp
-- "no such table: phones" hatası verdiği için önce kaldırılıp sonra yeniden kurulur.
--
-- ÖNEMLİ #2: acquisitions/sales/phone_checks/reservations/attachments phones(id)'e
-- FK ile bağlı. sqlx migration'ı bir transaction içinde çalıştırdığından ve
-- "PRAGMA foreign_keys" transaction içindeyken no-op olduğundan, migration'ın
-- sardığı transaction'ı COMMIT ile erken kapatıp foreign_keys'i kapatıyoruz;
-- sonda tekrar BEGIN ederek sqlx'in yapacağı son COMMIT'e "açık" bir transaction
-- bırakıyoruz (SQLite'ın önerdiği prosedür).
COMMIT;
PRAGMA foreign_keys = OFF;

DROP TABLE IF EXISTS phones_new; -- önceki başarısız bir denemeden kalmış olabilir

DROP VIEW IF EXISTS v_stock_value;

CREATE TABLE phones_new (
  id INTEGER PRIMARY KEY,
  imei1 TEXT NOT NULL UNIQUE,
  imei2 TEXT,
  brand_id INTEGER REFERENCES brands(id),
  model_id INTEGER REFERENCES models(id),
  model TEXT,
  color TEXT,
  storage_gb INTEGER,
  serial_no TEXT,
  cosmetic_grade TEXT CHECK(cosmetic_grade IN ('Sıfır','Sıfır Gibi','İyi','Normal','Temiz Kullanılmış')),
  battery_health INTEGER,
  battery_cycles INTEGER,
  ownership TEXT NOT NULL DEFAULT 'stock' CHECK(ownership IN ('stock','consignment')),
  status TEXT NOT NULL DEFAULT 'in_stock' CHECK(status IN ('in_stock','reserved','sold','returned','scrap','consigned')),
  current_acquisition_id INTEGER,
  list_price INTEGER,
  notes TEXT,
  region TEXT CHECK(region IN ('domestic','import')),
  warranty_until TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at TEXT,
  deleted_at TEXT
);

INSERT INTO phones_new (id, imei1, imei2, brand_id, model_id, model, color, storage_gb, serial_no,
  cosmetic_grade, battery_health, battery_cycles, ownership, status, current_acquisition_id,
  list_price, notes, region, warranty_until, created_at, updated_at, deleted_at)
SELECT id, imei1, imei2, brand_id, model_id, model, color, storage_gb, serial_no,
  CASE cosmetic_grade
    WHEN 'A' THEN 'Sıfır Gibi'
    WHEN 'B' THEN 'İyi'
    WHEN 'C' THEN 'Normal'
    WHEN 'D' THEN 'Temiz Kullanılmış'
    ELSE cosmetic_grade
  END,
  battery_health, battery_cycles, ownership, status, current_acquisition_id,
  list_price, notes, region, warranty_until, created_at, updated_at, deleted_at
FROM phones;

DROP TABLE phones;
ALTER TABLE phones_new RENAME TO phones;

CREATE INDEX idx_phones_status ON phones(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_phones_model ON phones(model_id);
CREATE INDEX idx_phones_imei2 ON phones(imei2) WHERE imei2 IS NOT NULL;
CREATE INDEX idx_phones_deleted ON phones(deleted_at);

-- 001_initial.sql'deki tanımla birebir aynı.
CREATE VIEW v_stock_value AS
SELECT COUNT(*) AS phone_count, COALESCE(SUM(c.total_cost), 0) AS total_value
FROM phones p JOIN v_phone_cost c ON c.acquisition_id = p.current_acquisition_id
WHERE p.status = 'in_stock' AND p.ownership = 'stock' AND p.deleted_at IS NULL;

PRAGMA foreign_keys = ON;
BEGIN;
