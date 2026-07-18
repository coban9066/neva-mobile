# NEVA MOBILE v0.2.3

Bu sürüm, satış anında ödemenin tamamı alınmadığında kalan alacağı otomatik
takip eden bir **Eksik Ödeme (Bekleyen Tahsilat)** sistemi ekler.

## 💳 Eksik Ödeme / Bekleyen Tahsilat

- **Satış ekranına** üç yeni alan eklendi: Toplam Satış Tutarı, Alınan Ödeme
  ve otomatik hesaplanan Kalan Alacak. Alınan Ödeme varsayılan olarak Toplam
  Satış Tutarı'nı takip eder (tam ödeme); düşürüldüğünde kalan tutar
  "Bekleyen Ödemeler"e düşer. POS/Kredi Kartı ödemesinde tutar her zaman tam
  işlenir (kısmi POS ödemesi desteklenmez).
- Eksik ödemeyle satılan telefon yine **satılmış** kabul edilir ve stoktan
  düşer; yalnızca kalan alacak ayrıca takip edilir.
- **Yeni sayfa: Bekleyen Ödemeler** (kısayol `Ctrl 9`). Ad Soyad, Telefon
  Numarası, Satılan Telefon, Toplam Satış, Ödenen Tutar ve Kalan Alacak
  kolonlarıyla listelenir; en yüksek borçtan en düşüğe (veya tersi)
  sıralanabilir.
- Her kayıtta **"Ödeme Al"** butonuyla kısmi tahsilat girilebilir; tutar
  otomatik olarak kalan alacaktan düşer. Kalan alacak sıfırlandığı anda kayıt
  Bekleyen Ödemeler listesinden otomatik kalkar.
- **Satış Geçmişi**'nde her satışın yanında "Tamamlandı" veya "Bekleyen
  Tahsilat" rozeti gösterilir.
- **Dashboard**'a sistemdeki toplam bekleyen alacağı gösteren yeni "Bekleyen
  Tahsilat" kartı eklendi.
- Migration eski veritabanlarını bozmaz: mevcut satışların tamamı bu sürüme
  geçişte otomatik olarak "tam ödenmiş" kabul edilir, hiçbiri Bekleyen
  Ödemeler'de görünmez.

## Sistem Gereksinimleri
- **Standart sürüm:** Windows 10 (1803+) / Windows 11, x64
- **Legacy sürüm:** Windows 7 SP1 x64 (KB4474419 ve TLS 1.2 güncellemeleri kurulu)

Teşekkürler.
