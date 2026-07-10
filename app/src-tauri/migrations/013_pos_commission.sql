-- v0.1.6 — POS satislarinda banka komisyonu destegi.
-- Komisyon ayri bir masraf DEGIL; satisin kendi satirinda tutulur ve
-- Net Kar = (Satis - Komisyon) - Toplam Maliyet olarak hesaplanir.

ALTER TABLE sales ADD COLUMN commission_type TEXT CHECK(commission_type IN ('percent','fixed'));
-- percent: yuzde * 100 (ör. %2.39 -> 239); fixed: kurus cinsinden tutar
ALTER TABLE sales ADD COLUMN commission_value INTEGER;
-- Hesaplanmis komisyon tutari (kurus). Her zaman dolu (POS degilse 0).
ALTER TABLE sales ADD COLUMN commission_amount INTEGER NOT NULL DEFAULT 0;

DROP VIEW IF EXISTS v_phone_profit;

CREATE VIEW v_phone_profit AS
SELECT s.id AS sale_id, s.phone_id, s.acquisition_id,
       s.price AS sale_price, s.commission_amount, c.total_cost,
       (s.price - s.commission_amount) - c.total_cost AS net_profit,
       s.date AS sale_date
FROM sales s JOIN v_phone_cost c ON c.acquisition_id = s.acquisition_id
WHERE s.deleted_at IS NULL;
