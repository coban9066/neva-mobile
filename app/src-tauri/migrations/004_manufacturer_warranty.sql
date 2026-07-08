-- Üretici garantisi: alışta girilir, bitiş tarihi hesaplanıp saklanır.
-- Kalan süre her açılışta bu tarihten türetilir; süresi geçen listeden düşer.

ALTER TABLE phones ADD COLUMN warranty_until TEXT;
