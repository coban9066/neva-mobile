# NEVA MOBILE — Android

Flutter (Material 3) ile geliştirilen Android sürümü. Masaüstü (Windows,
`app/` — Tauri/Rust) sürümüyle **aynı SQLite şeması** ve **aynı Ed25519
lisans algoritmasını** paylaşır; bu klasördeki değişiklikler masaüstü
kodunu (`app/`, `license-manager/`) etkilemez.

## Mimari

```
mobile/
  lib/
    core/
      database/        # sqflite migration runner (_migrations tablosu)
      license/          # Ed25519 doğrulama, Base32 çözücü, cihaz kimliği
      theme/             # Material 3 tema
      utils/             # para biçimlendirme (kuruş → ₺)
    data/
      repositories/      # SQL sorguları — masaüstü lib.rs komutlarıyla birebir eşdeğer mantık
    domain/
      models/            # PhoneRow, Brand, PhoneStatus, Region…
    presentation/
      screens/
        dashboard/        # KPI kartları
        phones/           # Liste, Alış, Satış, Detay/Düzenle
        license/          # Aktivasyon, Lisans Gerekli
      widgets/            # (paylaşılan bileşenler — büyüdükçe eklenecek)
    main.dart             # LicenseGate → AppShell
  assets/migrations/       # SQL migration dosyaları (001_initial_schema.sql, 002_seed_catalog.sql, …)
  test/                    # Lisans/kripto portu doğrulama testleri
```

## Neden ayrı bir migration numaralandırması?

Masaüstünün migrations/001..017 dosyaları, yıllar içinde birikmiş tarihsel
şema evrimidir (bazıları yalnızca sqlx'in transaction davranışıyla ilgili
geçici SQL numaraları içerir). Android'in geçmiş Windows kullanıcısı yok —
bu yüzden `001_initial_schema.sql`, masaüstünün **bugünkü son hali**
(migration 017 sonrası) ile birebir aynı tablo/görünüm/indeks yapısını tek
seferde kurar. Gelecekte masaüstüne yeni bir migration eklenirse
(`018_...`), aynı SQL içeriği burada da `003_...` (Android'in kendi sıra
numarasıyla) olarak eklenir — iki taraf da migration SİSTEMİ olarak eşdeğer
çalışır, numaralandırma bağımsızdır.

## Lisans sistemi

- Aynı public key, aynı payload biçimi (`version + device_hash[6] + plan + start_days + end_days`, Ed25519 imzalı, Base32 kodlanmış).
- Windows: Device ID = `NVM-XXXX-XXXX-XXXX` (MachineGuid tabanlı).
- Android: Device ID = `ANDROID-XXXXXXXXXXXX` (Settings.Secure.ANDROID_ID tabanlı).
- **NEVA LICENSE MANAGER** (Windows, geliştirici aracı) değişmeden her iki
  formatı da kabul eder — `parse_device_id` fonksiyonuna küçük, geriye dönük
  tam uyumlu bir düzeltme yapıldı (bkz. `license-manager/src/main.rs`):
  filtrelenmiş hex dizisinin TAMAMI yerine SON 12 karakteri alınır, böylece
  "ANDROID" kelimesindeki A/D/D gibi hex-benzeri harfler asıl cihaz özetinden
  önce gelip sonucu bozmaz. Mevcut `NVM-...` kodları birebir aynı şekilde
  çalışmaya devam eder (bkz. `parse_device_id_tests`).

## Faz durumu

Bu ilk teslim **çekirdek** kapsamdadır (kullanıcıyla anlaşılan aşamalı plan):
Dashboard, Telefonlar (liste + iki arama kutusu), Telefon Al, Telefon Sat
(kısmi ödeme destekli), Telefon Düzenle (IMEI/Etiket Numarası yerinde
düzenleme), Lisans Aktivasyon/Gerekli ekranları. Kasa, Masraflar, Garanti
Takibi, Bekleyen Ödemeler listesi, Dashboard grafikleri, Son İşlemler, Veri
Yönetimi (Backup/Restore), PDF Raporlar, Ayarlar, Gizlilik Modu (yalnızca
Dashboard'da kısmi uygulandı) ve Android Auto Update sonraki fazlarda
eklenecektir — ayrıntılı durum için PASS/FAIL raporuna bakın.
