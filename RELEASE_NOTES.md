# NEVA MOBILE v0.2.6

Bu sürüm, etiket numarası benzersizlik kontrolündeki kritik bir hatayı
düzeltir.

## 🐞 Kritik Düzeltme — Etiket Numarası Benzersizlik Kontrolü

- Etiket numarası kontrolü daha önce büyük/küçük harf duyarsız (`COLLATE
  NOCASE`) karşılaştırma kullanıyordu; bazı durumlarda bu, veritabanında
  hiç bulunmayan etiket numaralarının ("251", "274", "277", "278" gibi)
  yanlışlıkla "kullanımda" olarak işaretlenmesine yol açıyordu.
- Kontrol artık **kesin (BINARY) tam eşleşme** kullanıyor — LIKE, contains,
  startsWith veya harf-duyarsız karşılaştırma yok. Yalnızca birebir aynı
  metin çakışma sayılır.
- Aynı kaydın kendi etiket numarasını tekrar kaydetmesi (örn. Telefon
  Detayı'ndan düzenlerken değer değişmese de) çakışma sayılmaz.
- 250, 251, 252, 253… gibi ardışık boş etiket numaraları artık sorunsuz,
  kesintisiz kaydedilebiliyor.
- Migration eski veritabanlarını bozmaz; mevcut etiket numaraları ve
  benzersizlik korunur.

## Sistem Gereksinimleri
- **Standart sürüm:** Windows 10 (1803+) / Windows 11, x64
- **Legacy sürüm:** Windows 7 SP1 x64 (KB4474419 ve TLS 1.2 güncellemeleri kurulu)

Teşekkürler.
