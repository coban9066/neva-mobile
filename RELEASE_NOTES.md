# NEVA MOBILE v0.2.5

Bu sürüm, kullanım hızını artıran iyileştirmeler ve kritik bir garanti takip
hatasının düzeltilmesini içerir. Mevcut hiçbir özellik bozulmadı.

## 🏷️ Etiket Numarası ile Hızlı Arama

- **Telefonlar** sayfasındaki "Bu listede ara…" kutusunun yanına ikinci,
  küçük bir "Etiket No ile Ara…" kutusu eklendi. Tam/kısmi eşleşme
  desteklenir, büyük/küçük harf duyarsızdır, liste anlık filtrelenir.

## 📱 IMEI Artık Zorunlu Değil

- Telefon alırken IMEI alanı boş bırakılabilir — bazı telefoncular cihazı
  aldıktan sonra IMEI girmeyi tercih eder.
- IMEI sonradan **Telefon Detayı**'ndan eklenebilir veya değiştirilebilir
  (IMEI'nin yanındaki kalem ikonuyla).
- IMEI girildiğinde benzersizlik kontrolü aynen korunur; boş bırakmak hata
  vermez.

## 🐞 Kritik Düzeltme — Garanti Takibi

- Satılan telefonlar artık **Garanti** ekranında görünmüyor. Daha önce
  satıştan sonra bile üretici garantisi süresi dolmamış telefonlar listede
  kalmaya devam ediyordu — bu düzeltildi.
- Dashboard'daki "Bekleyen Garanti" ve "Yakında Bitecek Garanti" sayaçları da
  artık yalnızca stoktaki (satılmamış) telefonları sayıyor.

## 🙈 Gizlilik Modu (Dashboard)

- Dashboard'ın sağ üstüne **Gizlilik** butonu eklendi. Müşteri ekranı
  görebildiğinde tek tuşla tüm parasal değerleri "********" ile maskeleyin —
  Bugünkü Kâr, Bugünkü Satış, Bu Ay Net Kâr, Kasadaki Nakit, Toplam Stok
  Değeri, Bekleyen Tahsilat, En Kârlı Marka'nın kâr tutarı, grafiklerin para
  eksenleri ve Son İşlemler'deki tutarlar dahil. Telefon modeli, IMEI, Etiket
  No, Garanti, Pil ve Kozmetik gibi bilgiler görünmeye devam eder.
- Son seçiminiz kalıcıdır — uygulamayı kapatıp açsanız da Gizlilik Modu son
  durumunda kalır.
- **Kar Hesapla** kartındaki aç/kapat özelliği kaldırıldı; kart artık her
  zaman açık.

## Sistem Gereksinimleri
- **Standart sürüm:** Windows 10 (1803+) / Windows 11, x64
- **Legacy sürüm:** Windows 7 SP1 x64 (KB4474419 ve TLS 1.2 güncellemeleri kurulu)

Teşekkürler.
