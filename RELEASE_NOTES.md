# NEVA MOBILE v0.1.4

Bu sürüm, alış-satışta kişi takibini kolaylaştıran yeni özellikler ve önemli bir
kararlılık düzeltmesi içerir.

## Yeni Özellikler

- **Alış kayıtlarına telefon numarası:** "Kimden Alındı" alanına opsiyonel telefon
  numarası eklenebilir.
- **Satış kayıtlarına telefon numarası:** "Kime Satıldı" alanına opsiyonel telefon
  numarası eklenebilir.
- **Yeni "Kişiler" sekmesi:** Telefon detayında, o telefonu kimden aldığınız ve
  (satıldıysa) kime sattığınız bilgisi ad + telefon + tarih olarak birlikte görünür.
- **Kişi bilgilerini düzenleme:** Kişiler sekmesinden ad ve telefon numarası
  güncellenebilir, tek tıkla kaydedilir.
- **Tek tık WhatsApp:** Telefon numarasının yanındaki WhatsApp butonuyla ilgili
  kişiyle sohbet doğrudan açılır (numara otomatik biçimlenir).

## Düzeltmeler

- **"cannot rollback - no transaction is active" hatası giderildi.** Telefon
  düzenleme sırasında bazı kullanıcılarda görülen bu hata tamamen ortadan kaldırıldı.
- **SQLite transaction sistemi yeniden düzenlendi.** Çok adımlı yazma işlemleri artık
  tek bağlantılı gerçek transaction'larda güvenle çalışıyor; hata anında gerçek sebep
  gizlenmiyor.
- **Veritabanı migration iyileştirildi.** Yeni alanlar eski kayıtları bozmadan eklenir;
  mevcut kişi bilgileri otomatik taşınır.

## Sistem Gereksinimleri
- **Standart sürüm:** Windows 10 (1803+) / Windows 11, x64
- **Legacy sürüm:** Windows 7 SP1 x64 (KB4474419 ve TLS 1.2 güncellemeleri kurulu)

Teşekkürler.
