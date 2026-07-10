# NEVA MOBILE v0.1.6

Bu sürüm, telefoncuların günlük kullanımını kolaylaştıran yeni özellikler içerir:
POS komisyon takibi, PDF satış fişi ve Dashboard'da kâr grafikleri.

## Yeni Özellikler

### 💳 POS Komisyonu Desteği
- Satışta ödeme türü POS seçildiğinde "Banka Komisyonu" alanı görünür.
- Komisyon yüzde (%) veya sabit tutar (₺) olarak girilebilir.
- **Kasaya Giren** tutarı otomatik hesaplanır (Satış − Komisyon).
- **Net Kar**, Kasaya Giren üzerinden hesaplanır (Kasaya Giren − Toplam Maliyet).
- Komisyon ayrı bir masraf olarak eklenmez; satışın kendi kaydında tutulur.
- Tüm raporlar (Kasa, Gün/Ay Sonu, Dashboard) bu hesabı kullanır.

### 🧾 PDF Satış Fişi
- Satış listesinden tek tıkla PDF satış fişi oluşturulur.
- Fiş içeriği: firma adı, telefon modeli, IMEI, satış tarihi, satış fiyatı,
  ödeme türü, komisyon (varsa), garanti bilgisi, alıcı adı.
- Modern, sade tasarım; istenilen konuma kaydedilir.

### 📈 Dashboard Kâr Grafikleri
- **Son 12 Ay Kâr**: aylık kâr sütun grafiği.
- **Bu Ay Günlük Kâr**: gün gün kâr çizgi grafiği.
- Grafikler doğrudan SQLite verilerinden üretilir; sade ve hızlı.

### 🧮 Yeni Dashboard Kartları
- Toplam Telefon, Toplam Kâr, Bekleyen Garanti, En Çok Satılan Marka.

## Sistem Gereksinimleri
- **Standart sürüm:** Windows 10 (1803+) / Windows 11, x64
- **Legacy sürüm:** Windows 7 SP1 x64 (KB4474419 ve TLS 1.2 güncellemeleri kurulu)

Teşekkürler.
