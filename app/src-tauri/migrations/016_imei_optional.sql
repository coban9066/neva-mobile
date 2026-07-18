-- v0.2.4 — IMEI artik zorunlu degil: bazi telefoncular cihazi aldiktan sonra
-- IMEI girmeyi tercih ediyor. imei1 NOT NULL kisitlamasi kaldirilir; UNIQUE
-- korunur (SQLite'ta UNIQUE, birden fazla NULL degere izin verir, boylece iki
-- IMEI'siz telefon birbiriyle celismez). Girildiginde benzersizlik hala saglanir.
--
-- ONEMLI: SQLite ALTER TABLE ile NOT NULL kaldiramaz; migration 010/009'daki
-- ayni tablo-yeniden-kurma deseni kullanilir. v_stock_value "phones" tablosunu
-- dogrudan referans eder; RENAME sirasinda yeniden cozumlenmeye calisilip
-- "no such table: phones" hatasi verdigi icin once kaldirilip sonra
-- yeniden kurulur. idx_phones_etiket_numarasi da phones'a bagli oldugundan
-- tablo DROP edilince kendiliginden dusuyor; asagida yeniden olusturuluyor.
COMMIT;
PRAGMA foreign_keys = OFF;

DROP TABLE IF EXISTS phones_new; -- onceki basarisiz bir denemeden kalmis olabilir

DROP VIEW IF EXISTS v_stock_value;

CREATE TABLE phones_new (
  id INTEGER PRIMARY KEY,
  imei1 TEXT UNIQUE,
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
  deleted_at TEXT,
  etiket_numarasi TEXT
);

INSERT INTO phones_new (id, imei1, imei2, brand_id, model_id, model, color, storage_gb, serial_no,
  cosmetic_grade, battery_health, battery_cycles, ownership, status, current_acquisition_id,
  list_price, notes, region, warranty_until, created_at, updated_at, deleted_at, etiket_numarasi)
SELECT id, imei1, imei2, brand_id, model_id, model, color, storage_gb, serial_no,
  cosmetic_grade, battery_health, battery_cycles, ownership, status, current_acquisition_id,
  list_price, notes, region, warranty_until, created_at, updated_at, deleted_at, etiket_numarasi
FROM phones;

DROP TABLE phones;
ALTER TABLE phones_new RENAME TO phones;

CREATE INDEX idx_phones_status ON phones(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_phones_model ON phones(model_id);
CREATE INDEX idx_phones_imei2 ON phones(imei2) WHERE imei2 IS NOT NULL;
CREATE INDEX idx_phones_deleted ON phones(deleted_at);
CREATE UNIQUE INDEX idx_phones_etiket_numarasi
  ON phones(etiket_numarasi COLLATE NOCASE)
  WHERE etiket_numarasi IS NOT NULL;

-- 001_initial.sql'deki tanımla birebir aynı.
CREATE VIEW v_stock_value AS
SELECT COUNT(*) AS phone_count, COALESCE(SUM(c.total_cost), 0) AS total_value
FROM phones p JOIN v_phone_cost c ON c.acquisition_id = p.current_acquisition_id
WHERE p.status = 'in_stock' AND p.ownership = 'stock' AND p.deleted_at IS NULL;

PRAGMA foreign_keys = ON;
BEGIN;
