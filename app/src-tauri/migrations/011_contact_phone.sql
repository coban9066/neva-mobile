-- v0.1.4 — Alış/satış kayıtlarına kişi adı + telefon numarası (CRM YOK; bilgi
-- doğrudan ilgili alış/satış satırında tutulur). Eski kayıtlar bozulmaz:
-- yeni sütunlar NULL olabilir ve mevcut contacts bağından geriye doldurulur.

ALTER TABLE acquisitions ADD COLUMN contact_name TEXT;
ALTER TABLE acquisitions ADD COLUMN contact_phone TEXT;
ALTER TABLE sales ADD COLUMN contact_name TEXT;
ALTER TABLE sales ADD COLUMN contact_phone TEXT;

-- Geriye doldurma: eskiden contacts tablosuna yazılmış ad/telefonu yeni sütunlara taşı.
UPDATE acquisitions
   SET contact_name  = (SELECT c.full_name    FROM contacts c WHERE c.id = acquisitions.contact_id),
       contact_phone = (SELECT c.phone_number FROM contacts c WHERE c.id = acquisitions.contact_id)
 WHERE contact_id IS NOT NULL;

UPDATE sales
   SET contact_name  = (SELECT c.full_name    FROM contacts c WHERE c.id = sales.contact_id),
       contact_phone = (SELECT c.phone_number FROM contacts c WHERE c.id = sales.contact_id)
 WHERE contact_id IS NOT NULL;
