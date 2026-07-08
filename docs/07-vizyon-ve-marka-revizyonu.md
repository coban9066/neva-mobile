# 07 — Vizyon ve Marka Revizyonu (2026-07-07)

Bu doküman, 01–05 numaralı dokümanların üzerine gelen ürün kararlarını kaydeder. Çelişki durumunda **bu doküman geçerlidir.**

## Marka

- Uygulamanın tek resmi adı: **NEVA MOBILE**. PhoneDealer ERP / TeleKatip adları geçersiz.
- Tek resmi logo: `assets/img/nevalogo.png` (kopya: `app/src/assets/nevalogo.png`). Oran bozulmaz, crop/stretch yok, şeffaflık korunur. Yeni logo/ikon üretilmez.
- Kullanım yerleri: sidebar üstü (36px), splash, Ayarlar > Hakkında, aktivasyon ekranı, boş durumlar (gerektiğinde). Her sayfada tekrar edilmez.
- Alt başlık: "Telefon Alım Satım Yönetim Sistemi".
- Tauri ikonları nevalogo.png'den üretildi (`npx tauri icon`), identifier: `com.nevamobile.erp`, DB: `neva.db`.

## Ürün Odağı (daralma)

Uygulama **yalnızca telefon alıp satan mağazalar** içindir. Tamir odaklı işletmeler hedef değil.

**Kaldırılanlar:** Tamir panosu/iş emirleri/servis takibi, yedek parça stoğu, aksesuar (yan stok) modülü, ekspertiz modülü, `repairs/part_stock_items/products/stock_movements/appraisals` tabloları, `in_repair` durumu, `ownership=customer`.

**Değişen parçalar:** ayrı süreç değil, telefon kartında bilgi satırı (tür + kalite + tarih + masraf). `part_replacements` tablosu kaldı; maliyeti `v_phone_cost`a dahil.

**Garanti dönüşü:** süreç değil olay — `warranty_returns` tablosu (sorun + tarih + çözüm). Masrafı `expenses.is_warranty_cost` taşır, tur karından düşer.

**Modüller (9):** Dashboard, Telefonlar, Alışlar, Satışlar, Kişiler, Garanti, Kasa, Raporlar, Ayarlar. Kısayollar Ctrl+1..9 bu sırayla.

**Modül filtresi:** "Gerçek bir telefoncu bunu her gün kullanır mı?" Hayırsa eklenmez.

## Raporlar (sabit liste)

En çok satılan marka/model, en çok kar bırakan model, stokta en uzun bekleyenler, ortalama satış süresi, bu ay kar/ciro, telefon başına ortalama kar, en çok telefon alınan kişi, en çok satılan müşteri. Başka rapor eklenmez.

## Lisans

Bkz. `06-lisans-mimarisi.md`. Özet: Ed25519 imzalı offline lisans kodu, Device ID `NVM-XXXX-XXXX-XXXX` (MachineGuid türevi), aktivasyon ekranı zorunlu, süre bitince **salt okunur mod** (veri görünür, yazma kilitli — UI + Rust çift katman), NEVA License Manager (egui, `license-manager/`) yalnız geliştiricide.

- Public key ana uygulamada gömülü: `app/src-tauri/src/license.rs`.
- **KRİTİK:** `license-manager/target/release/neva_private.key` yedeklenmeli — kaybolursa yeni lisans üretilemez (yeni key = eski kodlar geçersiz).
- Headless üretim: `neva-license-manager.exe gen NVM-XXXX-XXXX-XXXX <gün|unlimited>`.

## Demo Notu

`checkImei` "333" değerini test IMEI'si olarak kabul eder (`app/src/lib/imei.ts`, DEMO_IMEI). Yayın öncesi kaldırılmalı.
