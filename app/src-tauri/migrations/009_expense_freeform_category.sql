-- Masraf sistemi: kategori artık serbest metin (kullanıcı kendi başlığını yazar, sabit liste yok).
--
-- ÖNEMLİ: SQLite'ta "ALTER TABLE ... RENAME TO" çalıştığında, o tabloya doğrudan
-- veya dolaylı bağımlı VIEW'ları yeniden çözümlemeye çalışır; tablo DROP edilip
-- henüz yeniden adlandırılmadan bu adım çalıştığı için "no such table: expenses"
-- hatası verir. Bu yüzden expenses'e bağımlı tüm VIEW'lar önce kaldırılır, tablo
-- yeniden kurulduktan sonra aynen geri eklenir.
DROP TABLE IF EXISTS expenses_new; -- önceki başarısız bir denemeden kalmış olabilir

DROP VIEW IF EXISTS v_stock_value;
DROP VIEW IF EXISTS v_phone_profit;
DROP VIEW IF EXISTS v_phone_cost;
DROP VIEW IF EXISTS v_phone_timeline;

CREATE TABLE expenses_new (
  id INTEGER PRIMARY KEY,
  phone_id INTEGER NOT NULL REFERENCES phones(id),
  acquisition_id INTEGER NOT NULL REFERENCES acquisitions(id),
  category TEXT NOT NULL,
  description TEXT,
  amount INTEGER NOT NULL,
  date TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  is_warranty_cost INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER,
  deleted_at TEXT
);

INSERT INTO expenses_new (id, phone_id, acquisition_id, category, description, amount, date, is_warranty_cost, created_by, deleted_at)
SELECT id, phone_id, acquisition_id, category, description, amount, date, is_warranty_cost, created_by, deleted_at
FROM expenses;

DROP TABLE expenses;
ALTER TABLE expenses_new RENAME TO expenses;

CREATE INDEX idx_expenses_acq ON expenses(acquisition_id);

-- Aşağıdaki 4 view, 001_initial.sql'deki tanımlarla birebir aynıdır.
CREATE VIEW v_phone_cost AS
SELECT a.id AS acquisition_id, a.phone_id,
       a.price
       + COALESCE((SELECT SUM(e.amount) FROM expenses e
                   WHERE e.acquisition_id = a.id AND e.deleted_at IS NULL), 0)
       + COALESCE((SELECT SUM(pr.cost) FROM part_replacements pr
                   WHERE pr.acquisition_id = a.id), 0) AS total_cost
FROM acquisitions a WHERE a.deleted_at IS NULL;

CREATE VIEW v_phone_profit AS
SELECT s.id AS sale_id, s.phone_id, s.acquisition_id,
       s.price AS sale_price, c.total_cost,
       s.price - c.total_cost AS net_profit,
       s.date AS sale_date
FROM sales s JOIN v_phone_cost c ON c.acquisition_id = s.acquisition_id
WHERE s.deleted_at IS NULL;

CREATE VIEW v_stock_value AS
SELECT COUNT(*) AS phone_count, COALESCE(SUM(c.total_cost), 0) AS total_value
FROM phones p JOIN v_phone_cost c ON c.acquisition_id = p.current_acquisition_id
WHERE p.status = 'in_stock' AND p.ownership = 'stock' AND p.deleted_at IS NULL;

CREATE VIEW v_phone_timeline AS
SELECT phone_id, date, 'acquisition' AS event_type, id AS ref_id, price AS amount, notes AS note
  FROM acquisitions WHERE deleted_at IS NULL
UNION ALL
SELECT phone_id, date, 'sale', id, price, notes FROM sales WHERE deleted_at IS NULL
UNION ALL
SELECT phone_id, date, 'expense', id, amount, COALESCE(description, category) FROM expenses WHERE deleted_at IS NULL
UNION ALL
SELECT phone_id, date, 'part', id, cost, part_type || ' (' || quality || ')' FROM part_replacements
UNION ALL
SELECT phone_id, date, 'warranty_return', id, 0, issue FROM warranty_returns
UNION ALL
SELECT phone_id, date, 'return', id, refund_amount, reason FROM returns
UNION ALL
SELECT phone_id, created_at, 'reservation', id, deposit, status FROM reservations;
