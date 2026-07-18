-- v0.2.3 — Eksik Ödeme (Bekleyen Tahsilat): satış anında müşteri ödemenin tamamını
-- yapmayabilir. Telefon yine satılmış sayılır ve stoktan düşer; kalan alacak,
-- ayrı bir "durum" sütunu tutulmadan price - amount_paid farkından türetilir.
ALTER TABLE sales ADD COLUMN amount_paid INTEGER NOT NULL DEFAULT 0;

-- Geçmiş satışlar bu alan eklenmeden önce hep tam ödenmiş kabul edilir; eski
-- kullanıcıların verisi bozulmaz, hiçbiri "bekleyen tahsilat" olarak görünmez.
UPDATE sales SET amount_paid = price;

-- Bekleyen Ödemeler listesi bu koşulu sık sık sorgular.
CREATE INDEX idx_sales_pending_payment ON sales(date)
  WHERE deleted_at IS NULL AND amount_paid < price;
