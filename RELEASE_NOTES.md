# NEVA MOBILE v0.2.0

Bu sürümün amacı yeni özellik yığmak değil, telefoncunun daha hızlı çalışmasını ve
daha doğru karar vermesini sağlamaktır: garanti alarmı, daha zengin Dashboard
analizleri, gün sonu PDF raporu ve Windows 7 Legacy'de WebView2 kurulum düzeltmesi.

## Yeni Özellikler

### 🔔 Garanti Alarmı
- Dashboard'a **"Yakında Bitecek Garanti"** kartı eklendi.
- Üretici garantisi 30 günden az kalan telefonları tek bakışta gösterir.
- Karta tıklayınca Garanti Takibi ekranı yalnızca bu telefonları listeler;
  filtre etiketinden tek tıkla tüm listeye dönülebilir.

### 📊 Dashboard Analizleri
- **Bugünkü Kâr**, **Toplam Stok Değeri**, **En Kârlı Marka** kartları eklendi.
- Mevcut kartlar (Toplam Telefon, Toplam Kâr, Bekleyen Garanti, En Çok Satılan
  Marka, kâr grafikleri) korunuyor — hiçbir özellik kaldırılmadı.

### 🧾 Gün Sonu PDF Raporu
- Kasa ekranına **"Gün Sonu PDF"** butonu eklendi.
- Tek tıkla PDF: Günlük Ciro, Günlük Kâr, POS Komisyonu, Toplam Masraf,
  Satış Sayısı, Toplam Stok.
- İstediğiniz konuma kaydedilir, yazdırılabilir ve paylaşılabilir.

## Düzeltmeler

### 🛠️ Windows 7 Legacy — WebView2 Kurulum Sorunu
- Kurulum sonrası "Could not find the WebView2 Runtime" hatası giderildi.
- Kök neden: kurulum betiği WebView2 bileşeninin gerçekten kurulup kurulmadığını
  hiç doğrulamıyordu; kurulum sessizce başarısız olsa bile işlem "başarılı"
  sayılıp devam ediyordu.
- Artık kurulumdan sonra WebView2 bileşeni kayıt defterinden tekrar doğrulanıyor;
  gerçekten kurulamazsa kullanıcıya açık bir uyarı ve doğru indirme adresi
  gösteriliyor.
- Windows 10/11 sürümü bu değişiklikten etkilenmez.

## Sistem Gereksinimleri
- **Standart sürüm:** Windows 10 (1803+) / Windows 11, x64
- **Legacy sürüm:** Windows 7 SP1 x64 (KB4474419 ve TLS 1.2 güncellemeleri kurulu)

Teşekkürler.
