-- v0.2.6 — BUGFIX: Etiket numarası benzersizlik kontrolü artık kesin (BINARY)
-- tam eşleşme kullanıyor. Önceki COLLATE NOCASE'li benzersizlik indeksi
-- kaldırılıp yerine düz eşitlik kontrolü yapan bir indeks kuruluyor; uygulama
-- katmanındaki kontrol sorguları da (lib.rs) COLLATE NOCASE olmadan çalışacak
-- şekilde güncellendi. LIKE/contains gibi kısmi karşılaştırmalar zaten
-- kullanılmıyordu — bu değişiklik yalnızca büyük/küçük harf duyarsızlığını
-- (ki rakamlar için zaten etkisizdi) kaldırıp indeks ile uygulama kontrolünü
-- birebir aynı (BINARY, tam eşleşme) semantiğe sabitliyor.
DROP INDEX IF EXISTS idx_phones_etiket_numarasi;

CREATE UNIQUE INDEX idx_phones_etiket_numarasi
  ON phones(etiket_numarasi)
  WHERE etiket_numarasi IS NOT NULL;
