-- v0.2.2 — Etiket Numarası: telefon takibini hızlandırmak için opsiyonel, serbest
-- metin fiziksel etiket/raf numarası (ör. "A-154"). NULL olabilir, zorunlu değil.
-- Girildiğinde benzersiz olmalı (büyük/küçük harf duyarsız) — aynı etiket iki
-- telefona verilemez.
ALTER TABLE phones ADD COLUMN etiket_numarasi TEXT;

CREATE UNIQUE INDEX idx_phones_etiket_numarasi
  ON phones(etiket_numarasi COLLATE NOCASE)
  WHERE etiket_numarasi IS NOT NULL;
