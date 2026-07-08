-- PhoneDealer ERP — şema (vizyon: yalnız alım-satım; tamir/servis/parça modülü YOK)
-- Para: INTEGER kuruş. Tarih: TEXT ISO-8601 yerel. Silme: soft (deleted_at).

CREATE TABLE brands (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE models (
  id INTEGER PRIMARY KEY,
  brand_id INTEGER NOT NULL REFERENCES brands(id),
  name TEXT NOT NULL,
  default_ram INTEGER,
  storage_options TEXT NOT NULL DEFAULT '[]',
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE(brand_id, name)
);

CREATE TABLE contacts (
  id INTEGER PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'both' CHECK(type IN ('customer','supplier','both')),
  full_name TEXT NOT NULL,
  phone_number TEXT,
  tc_no_encrypted TEXT,
  address TEXT,
  notes TEXT,
  id_photo_path TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at TEXT,
  deleted_at TEXT
);

CREATE TABLE phones (
  id INTEGER PRIMARY KEY,
  imei1 TEXT NOT NULL UNIQUE,
  imei2 TEXT,
  brand_id INTEGER REFERENCES brands(id),
  model_id INTEGER REFERENCES models(id),
  color TEXT,
  storage_gb INTEGER,
  ram_gb INTEGER,
  serial_no TEXT,
  cosmetic_grade TEXT CHECK(cosmetic_grade IN ('A','B','C','D')),
  battery_health INTEGER,
  battery_cycles INTEGER,
  ownership TEXT NOT NULL DEFAULT 'stock' CHECK(ownership IN ('stock','consignment')),
  status TEXT NOT NULL DEFAULT 'in_stock' CHECK(status IN ('in_stock','reserved','sold','returned','scrap','consigned')),
  current_acquisition_id INTEGER,
  list_price INTEGER,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at TEXT,
  deleted_at TEXT
);

CREATE TABLE acquisitions (
  id INTEGER PRIMARY KEY,
  phone_id INTEGER NOT NULL REFERENCES phones(id),
  contact_id INTEGER REFERENCES contacts(id),
  date TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  price INTEGER NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'cash' CHECK(payment_method IN ('cash','pos','transfer','mixed')),
  source TEXT NOT NULL DEFAULT 'walk_in' CHECK(source IN ('walk_in','trade_in','wholesale','return')),
  trade_in_sale_id INTEGER,
  notes TEXT,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  deleted_at TEXT
);

CREATE TABLE sales (
  id INTEGER PRIMARY KEY,
  phone_id INTEGER NOT NULL REFERENCES phones(id),
  acquisition_id INTEGER NOT NULL REFERENCES acquisitions(id),
  contact_id INTEGER REFERENCES contacts(id),
  date TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  price INTEGER NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'cash' CHECK(payment_method IN ('cash','pos','transfer','mixed','installment')),
  trade_in_acquisition_id INTEGER REFERENCES acquisitions(id),
  installment_plan_id INTEGER,
  notes TEXT,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  deleted_at TEXT
);

CREATE TABLE warranties (
  id INTEGER PRIMARY KEY,
  sale_id INTEGER NOT NULL UNIQUE REFERENCES sales(id),
  type TEXT NOT NULL DEFAULT 'store' CHECK(type IN ('store','import','manufacturer','none')),
  months INTEGER NOT NULL DEFAULT 0,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  terms TEXT,
  voided_at TEXT
);

-- Garanti dönüşü: süreç değil, olay. Masrafı expenses.is_warranty_cost taşır.
CREATE TABLE warranty_returns (
  id INTEGER PRIMARY KEY,
  warranty_id INTEGER NOT NULL REFERENCES warranties(id),
  phone_id INTEGER NOT NULL REFERENCES phones(id),
  date TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  issue TEXT NOT NULL,
  resolved_at TEXT,
  note TEXT
);

CREATE TABLE expenses (
  id INTEGER PRIMARY KEY,
  phone_id INTEGER NOT NULL REFERENCES phones(id),
  acquisition_id INTEGER NOT NULL REFERENCES acquisitions(id),
  category TEXT NOT NULL CHECK(category IN ('screen','battery','repair','labor','shipping','other')),
  description TEXT,
  amount INTEGER NOT NULL,
  date TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  is_warranty_cost INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER,
  deleted_at TEXT
);

CREATE TABLE hardware_tests (
  id INTEGER PRIMARY KEY,
  phone_id INTEGER NOT NULL REFERENCES phones(id),
  acquisition_id INTEGER REFERENCES acquisitions(id),
  test_type TEXT NOT NULL CHECK(test_type IN ('face_id','touch_id','true_tone','wifi','bluetooth','gps','nfc','sim','speaker','mic','vibration','proximity','light_sensor','charging','front_camera','rear_camera','flash')),
  result TEXT NOT NULL CHECK(result IN ('ok','issue','fail')),
  note TEXT,
  tested_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- Değişen parça = telefon geçmişi bilgisi (süreç değil). Masraf tutarı da burada.
CREATE TABLE part_replacements (
  id INTEGER PRIMARY KEY,
  phone_id INTEGER NOT NULL REFERENCES phones(id),
  acquisition_id INTEGER REFERENCES acquisitions(id),
  part_type TEXT NOT NULL CHECK(part_type IN ('screen','battery','back_glass','housing','camera','charging_port','speaker','mic','motherboard','face_id','touch_id')),
  quality TEXT NOT NULL CHECK(quality IN ('original','aftermarket','refurbished')),
  cost INTEGER NOT NULL DEFAULT 0,
  date TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  note TEXT
);

CREATE TABLE ledger_entries (
  id INTEGER PRIMARY KEY,
  contact_id INTEGER NOT NULL REFERENCES contacts(id),
  date TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  ref_type TEXT NOT NULL CHECK(ref_type IN ('acquisition','sale','payment','return','consignment','adjustment')),
  ref_id INTEGER,
  debit INTEGER NOT NULL DEFAULT 0,
  credit INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  created_by INTEGER
);

CREATE TABLE installment_plans (
  id INTEGER PRIMARY KEY,
  sale_id INTEGER NOT NULL REFERENCES sales(id),
  total INTEGER NOT NULL,
  down_payment INTEGER NOT NULL DEFAULT 0,
  installment_count INTEGER NOT NULL
);

CREATE TABLE installments (
  id INTEGER PRIMARY KEY,
  plan_id INTEGER NOT NULL REFERENCES installment_plans(id),
  seq INTEGER NOT NULL,
  due_date TEXT NOT NULL,
  amount INTEGER NOT NULL,
  paid_payment_id INTEGER
);

CREATE TABLE payments (
  id INTEGER PRIMARY KEY,
  contact_id INTEGER NOT NULL REFERENCES contacts(id),
  date TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  amount INTEGER NOT NULL,
  direction TEXT NOT NULL CHECK(direction IN ('in','out')),
  method TEXT NOT NULL DEFAULT 'cash' CHECK(method IN ('cash','pos','transfer')),
  installment_id INTEGER REFERENCES installments(id),
  note TEXT,
  created_by INTEGER
);

CREATE TABLE till_entries (
  id INTEGER PRIMARY KEY,
  date TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  direction TEXT NOT NULL CHECK(direction IN ('in','out')),
  method TEXT NOT NULL DEFAULT 'cash' CHECK(method IN ('cash','pos','transfer','other')),
  amount INTEGER NOT NULL,
  ref_type TEXT,
  ref_id INTEGER,
  note TEXT,
  created_by INTEGER
);

CREATE TABLE till_closures (
  id INTEGER PRIMARY KEY,
  date TEXT NOT NULL UNIQUE,
  expected_cash INTEGER NOT NULL,
  counted_cash INTEGER NOT NULL,
  difference INTEGER NOT NULL,
  pos_total INTEGER NOT NULL DEFAULT 0,
  transfer_total INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  closed_by INTEGER,
  closed_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE reservations (
  id INTEGER PRIMARY KEY,
  phone_id INTEGER NOT NULL REFERENCES phones(id),
  contact_id INTEGER NOT NULL REFERENCES contacts(id),
  deposit INTEGER NOT NULL DEFAULT 0,
  until_date TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','completed','cancelled','expired')),
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE returns (
  id INTEGER PRIMARY KEY,
  kind TEXT NOT NULL CHECK(kind IN ('sale_return','purchase_return')),
  sale_id INTEGER REFERENCES sales(id),
  acquisition_id INTEGER REFERENCES acquisitions(id),
  phone_id INTEGER NOT NULL REFERENCES phones(id),
  date TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  reason TEXT,
  refund_amount INTEGER NOT NULL DEFAULT 0,
  restock INTEGER NOT NULL DEFAULT 1,
  note TEXT,
  created_by INTEGER
);

CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff' CHECK(role IN ('owner','manager','staff')),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY,
  user_id INTEGER,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id INTEGER,
  before_json TEXT,
  after_json TEXT,
  at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE attachments (
  id INTEGER PRIMARY KEY,
  entity TEXT NOT NULL CHECK(entity IN ('phone','contact')),
  entity_id INTEGER NOT NULL,
  kind TEXT NOT NULL DEFAULT 'photo' CHECK(kind IN ('photo','id_scan','receipt')),
  path TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE backups (
  id INTEGER PRIMARY KEY,
  path TEXT NOT NULL,
  size INTEGER,
  kind TEXT NOT NULL DEFAULT 'auto' CHECK(kind IN ('auto','manual')),
  checksum TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- İndeksler
CREATE INDEX idx_phones_status ON phones(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_phones_model ON phones(model_id);
CREATE INDEX idx_acq_phone ON acquisitions(phone_id, date);
CREATE INDEX idx_sales_phone ON sales(phone_id, date);
CREATE INDEX idx_sales_date ON sales(date);
CREATE INDEX idx_expenses_acq ON expenses(acquisition_id);
CREATE INDEX idx_ledger_contact ON ledger_entries(contact_id, date);
CREATE INDEX idx_inst_due ON installments(due_date) WHERE paid_payment_id IS NULL;
CREATE INDEX idx_till_date ON till_entries(date);

-- Türetilmiş görünümler
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

CREATE VIEW v_contact_balance AS
SELECT contact_id, SUM(credit) - SUM(debit) AS balance
FROM ledger_entries GROUP BY contact_id;

CREATE VIEW v_stock_value AS
SELECT COUNT(*) AS phone_count, COALESCE(SUM(c.total_cost), 0) AS total_value
FROM phones p JOIN v_phone_cost c ON c.acquisition_id = p.current_acquisition_id
WHERE p.status = 'in_stock' AND p.ownership = 'stock' AND p.deleted_at IS NULL;

CREATE VIEW v_stock_aging AS
SELECT p.id AS phone_id, a.date AS acquired_at,
       CAST(julianday('now','localtime') - julianday(a.date) AS INTEGER) AS days_in_stock
FROM phones p JOIN acquisitions a ON a.id = p.current_acquisition_id
WHERE p.status IN ('in_stock','reserved') AND p.ownership = 'stock' AND p.deleted_at IS NULL;

CREATE VIEW v_warranty_active AS
SELECT w.*, s.phone_id, s.contact_id,
       CAST(julianday(w.end_date) - julianday('now','localtime') AS INTEGER) AS days_left
FROM warranties w JOIN sales s ON s.id = w.sale_id
WHERE w.voided_at IS NULL AND s.deleted_at IS NULL
  AND julianday(w.end_date) >= julianday('now','localtime');

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
