# NEVA MOBILE v1.0.0 🎉

**İndirme:** her platformun kendi release sayfası var —
[Windows 10/11](https://github.com/coban9066/neva-mobile/releases/tag/v1.0.0) ·
[Windows 7 Legacy](https://github.com/coban9066/neva-mobile/releases/tag/legacy-win7) ·
[Android](https://github.com/coban9066/neva-mobile/releases/tag/android-v1.0.0)

**NEVA MOBILE artık Android'de de var.** Bu, ürünün ilk büyük dönüm noktası
sürümü — Windows masaüstü uygulamasının yanına, aynı veritabanı yapısını ve
aynı lisans sistemini paylaşan bağımsız bir Android sürümü ekleniyor.

## 📱 Yeni: NEVA MOBILE Android

- **Flutter (Material 3)** ile geliştirildi, dokunmatik kullanım için
  sıfırdan tasarlandı — masaüstü ekranları birebir kopyalanmadı.
- **Aynı SQLite şeması:** Masaüstünün bugünkü (v0.2.6) veritabanı yapısıyla
  bire bir uyumlu — kendi migration sistemi var, gelecekteki güncellemeler
  güvenle uygulanır.
- **Aynı lisans sistemi:** Windows'taki Ed25519 imza algoritmasının birebir
  Android portu. NEVA LICENSE MANAGER (geliştirici aracı) **değişmeden**
  hem Windows (`NVM-XXXX-XXXX-XXXX`) hem Android (`ANDROID-XXXXXXXXXXXX`)
  cihaz kimlikleri için kod üretebiliyor. Platform seçme ekranı yok — lisans
  doğrulama mantığı tüm platformlarda aynı.
- **Tamamen offline çalışır** — telefon ekleme, satış, kasa hesapları hep
  yerel veritabanında; internet yalnızca lisans/güncelleme kontrolü için
  kullanılır.
- **Bu sürümde bulunanlar:** Dashboard (KPI kartları + Gizlilik Modu),
  Telefonlar (liste, Etiket No araması), Telefon Al (IMEI opsiyonel),
  Telefon Sat (kısmi ödeme desteği), Telefon Düzenle (IMEI/Etiket
  Numarası yerinde düzenleme), Lisans Aktivasyonu.
- **Sonraki sürümlerde gelecek:** Kasa, Masraflar, Garanti Takibi, Bekleyen
  Ödemeler listesi, Dashboard grafikleri, Veri Yönetimi (Backup/Restore),
  PDF Raporlar, Ayarlar ve Android üzerinden otomatik güncelleme kontrolü.

## 🖥️ Windows Sürümü

Windows 10/11 ve Windows 7 Legacy sürümleri her zamanki gibi güncellendi ve
bozulmadan çalışmaya devam ediyor. Son sürümlerde (v0.2.2 – v0.2.6) eklenen
ve bu sürümde de yer alan özellikler:

- 🏷️ Etiket Numarası sistemi (ekleme, düzenleme, Etiket No ile hızlı arama)
- 📱 Opsiyonel IMEI — sonradan Telefon Detayı'ndan eklenebilir/değiştirilebilir
- 💳 Eksik Ödeme / Bekleyen Tahsilat takibi (Kasa ve Dashboard'da görünür)
- 🙈 Gizlilik Modu — tek tuşla tüm parasal değerleri maskele
- 🐞 Kritik düzeltmeler: satılan telefonların Garanti ekranında görünmesi ve
  etiket numarası benzersizlik kontrolündeki yanlış-pozitif hatası giderildi

## Sistem Gereksinimleri
- **Windows (Standart):** Windows 10 (1803+) / Windows 11, x64
- **Windows (Legacy):** Windows 7 SP1 x64 (KB4474419 ve TLS 1.2 güncellemeleri kurulu)
- **Android:** Android 7.0 (API 24) ve üzeri

Teşekkürler.
