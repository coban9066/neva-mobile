-- Smart Device Profile: menşei (yurt içi/dışı) + marka-özel kalite kontrolleri.
-- Kontroller key-value tutulur; yeni marka profili şema değişikliği gerektirmez.

ALTER TABLE phones ADD COLUMN region TEXT CHECK(region IN ('domestic','import'));

CREATE TABLE phone_checks (
  id INTEGER PRIMARY KEY,
  phone_id INTEGER NOT NULL REFERENCES phones(id),
  check_key TEXT NOT NULL,
  value INTEGER NOT NULL DEFAULT 1,
  checked_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  UNIQUE(phone_id, check_key)
);

CREATE INDEX idx_phone_checks_phone ON phone_checks(phone_id);
