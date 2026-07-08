-- model alanını serbest metin olarak phones tablosuna ekle
ALTER TABLE phones ADD COLUMN model TEXT;

-- Mevcut verileri korumak için, models tablosundaki isimleri model kolonuna kopyala
UPDATE phones
SET model = (SELECT name FROM models WHERE models.id = phones.model_id)
WHERE model_id IS NOT NULL;
