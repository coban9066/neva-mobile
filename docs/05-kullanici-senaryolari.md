# 05 — Kullanıcı Senaryoları (uçtan uca)

Her senaryo gerçek tezgâh akışıdır; adım sayısı ve hedef süre tasarım kabul kriteridir.

---

## S1 — Sokaktan Alış (en sık işlem)

**Aktör:** Çalışan. **Hedef:** ≤ 30 sn.

1. Müşteri iPhone 13 satmak istiyor. Çalışan **F2**.
2. Barkod okuyucuyla kutu/cihaz IMEI'si taranır → Luhn ✓, kayıt yok → yeni.
3. "iph 13" yazar → iPhone 13 seçer → 128GB çipi, renk.
4. Satıcı: telefon numarasıyla arar → yok → satır içi ekle (ad + tel).
5. Fiyat alanında bilgi kutusu: "Son 6 ay: ort. alış ₺14.200, ort. satış ₺16.800, 7 işlem."
6. ₺14.000 girer, nakit, **Ctrl+Enter**.
7. Toast: "Kaydedildi · Test Ekle · Etiket Yazdır · Kimlik Ekle". Etiket yazdırır, müşteri kimliğini çeker (fotoğraf → KVKK klasörü).
8. Müsait kalınca Testler sekmesinden 17 testi klavyeyle (1/2/3) 40 saniyede doldurur.

**Sonuç:** Telefon `in_stock`, tur #1 açık, kasadan ₺14.000 çıkış, satıcı carisine işlendi, timeline'da "Alındı".

---

## S2 — Takaslı Satış

**Aktör:** Patron.

1. Müşteri stoktaki iPhone 14'ü istiyor, iPhone 11'ini + fark verecek. **F3**.
2. iPhone 14 seçilir (₺22.000 etiket, maliyet rozeti ₺19.400). Müşteri seçilir.
3. Ödeme adımında **Takas**: gömülü mini alış → iPhone 11 IMEI taranır → *kayıt bulundu*: "Bu telefonu 14 ay önce siz sattınız — garanti bitmiş, 1. tur karı +₺1.900". Patron cihaz geçmişini bilerek pazarlık eder.
4. Takas bedeli ₺8.000 → fark ₺14.000 otomatik → ₺10.000 nakit + ₺4.000 POS (karma ödeme).
5. Garanti 6 ay önerili → onay → **Ctrl+Enter**.

**Sonuç (tek atomik işlem):** iPhone 14 `sold` + garanti başladı; iPhone 11'de **yeni tur** açıldı (`in_stock`, kaynak: takas); kasaya ₺10.000 nakit + ₺4.000 POS; iki telefonun timeline'ı çapraz referanslı.

---

## S3 — Garanti Dönüşü

1. Müşteri "aldığım telefonun hoparlörü bozuk" der. Çalışan cihazı tarar (herhangi ekranda).
2. Kart açılır: **"AKTİF GARANTİ — 47 gün"** rozeti. "Garanti Tamiri Aç".
3. Tamir kaydı `kind=warranty`, ücret ₺0, sorun: hoparlör. Teslim fişi yazdırılır.
4. Panoda ilerler; hoparlör parça stoğundan düşülür (yan sanayi, ₺350) → telefonun aktif satış turuna **garanti gideri** yazılır.
5. Tamir sonrası test seti: hoparlör ✓. Teslim.

**Sonuç:** O satışın net karı ₺350 azaldı; Garanti modülünde "bu ay garanti gideri" güncellendi; timeline: Satıldı → Garanti dönüşü → Tamir → Teslim.

---

## S4 — Aynı Telefonun İkinci Kez Alınması (IMEI kuralı)

1. 8 ay önce satılan Samsung S21 geri geliyor, sahibi satmak istiyor. **F2** → IMEI taranır.
2. Sistem: "**Bu telefon kayıtlı** — 8 ay önce ₺11.000'e Ahmet Y.'ye satıldı (1. tur karı +₺2.100). Batarya %88'di." → "Yeniden Alış".
3. Form model bilgilerini kartından getirir; yalnız fiyat/satıcı/ödeme girilir. ₺8.500.
4. Testlerde karşılaştırma kolonu: geçen girişte Face ID ✓, şimdi ⚠ → pazarlık/karar verisi.

**Sonuç:** **Yeni telefon oluşturulmadı**; mevcut karta tur #2 açıldı. Timeline tek akışta: Alındı → Satıldı → Tekrar Alındı. Tur #2 karı sıfırdan hesaplanır.

---

## S5 — Taksitli Satış + Geciken Tahsilat

1. Satış ₺18.000: peşinat ₺6.000 + 6 × ₺2.000 (ayın 15'i). Plan önizlemesi → onay.
2. 45 gün sonra Dashboard görev bölgesi: "Geciken taksit: Mehmet K. — ₺2.000, 3 gün gecikti."
3. Satıra tık → kişi kartı Taksitler sekmesi. Müşteri arandı, geldi, ödedi: **F7** → tahsilat ₺2.000 nakit → en eski açık taksite otomatik eşleşti, kasaya işlendi.

---

## S6 — Müşteri Tamiri (dükkân malı olmayan cihaz)

1. Müşteri kendi Xiaomi'sinin ekranını değiştirtmek istiyor. **F6** → IMEI taranır → kayıt yok → `ownership=customer` minimal kayıt.
2. Sorun: ekran kırık; söz: yarın 18:00; teklif ₺2.400. Teslim fişi yazdırılır.
3. Panoda: Alındı → Tamirde (ekran parça stoğundan, yan sanayi ₺1.400) → Hazır → teslimde tahsilat ₺2.400 POS.

**Sonuç:** İşçilik karı ₺1.000 servis gelirlerinde; cihaz **stok değerine ve telefon karlılık raporlarına hiç girmedi**; cihaz geçmişi saklı — müşteri 6 ay sonra "ekranı siz taktınız" dediğinde kayıt ortada.

---

## S7 — Ekspertiz Reddi → Sonradan Alış

1. Müşteri iPhone 12 için ₺10.000 istiyor; patron ₺9.000 teklif ediyor, anlaşamıyorlar. Ekspertiz kaydı: teklif ₺9.000, beklenti ₺10.000, sonuç: Reddedildi.
2. İki hafta sonra müşteri döner. F2 → IMEI → kayıt yok ama **ekspertiz eşleşmesi** bulunur: "14 gün önce ₺9.000 teklif edildi."
3. "Alışa dönüştür" → alanlar taşınır, ₺9.200'de anlaşılır.

**Sonuç:** Fiyat hafızası pazarlık gücü verdi; ekspertiz kaydı `bought` olarak kapandı.

---

## S8 — Gün Sonu

1. 21:00, patron **F8**. Ekran: nakit giriş ₺31.500 / çıkış ₺14.000 → beklenen kasa ₺17.500 + devir; POS ₺22.400; havale ₺4.000.
2. Nakit sayılır: ₺17.350 → fark −₺150 → not: "çay-su gideri işlenmemiş" (isterse gider kaydı ekler, fark kapanır).
3. Kapanış → otomatik yedek harici klasöre; durum çubuğunda "Son yedek: bugün 21:04 ✓".

---

## S9 — Satılamayan Telefonun Hurdaya Ayrılması

1. Stokta 120 gündür duran hasarlı telefon (maliyet ₺6.500) satılmıyor. Dashboard "90+ gün" uyarısında.
2. Sağ tık → "Hurdaya Ayır" → parça hasadı ekranı: ekran (₺1.500 değer) ve batarya (₺300) parça stoğuna girer, kalan ₺4.700 zarar yazılır.

**Sonuç:** Stok değeri gerçeği yansıtır; parça stoğu beslendi; kar raporu zararı gizlemez.

---

## S10 — Satış İadesi

1. Dün satılan telefon "beğenmedim" iadesiyle döner. Satış kaydında sağ tık → "İade Al".
2. Tür: para iadesi ₺16.800; cihaz kontrol testi hızlı set → sorun yok → stoğa geri (`restock=true`).

**Sonuç:** Telefon `in_stock` (aynı tur devam eder), garanti `voided`, ledger ve kasa ters kayıtla düzeltildi, timeline'da "İade" olayı; hiçbir kayıt silinmedi.

---

## Kabul Kriterleri (senaryolardan türeyen)

| Kriter | Eşik |
|--------|------|
| Hızlı Alış tamamlanma | ≤ 30 sn (yeni kişi dahil) |
| IMEI tarama → kart açılma | ≤ 300 ms |
| Global arama sonucu | ≤ 50 ms |
| Satış atomikliği | satış+ledger+kasa+garanti+taksit tek transaction |
| Uygulama açılışı | ≤ 1 sn kullanılabilir |
| Tüm ana akışlar | fare olmadan tamamlanabilir |
| Her mutasyon | 6 sn geri alınabilir + audit_log kaydı |
