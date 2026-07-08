# 01 — Proje Analizi, Eksik Modüller ve Profesyonel Öneriler

## 1. Proje Analizi

### 1.1 Ürünün Özü

PhoneDealer ERP bir "stok programı" değil, bir **varlık yaşam döngüsü sistemi**dir. Sistemdeki temel varlık telefondur ve telefon; alınır, test edilir, tamir edilir, satılır, garanti kapsamında geri gelir, tekrar alınır, tekrar satılır. Klasik stok programları bu döngüyü modelleyemez çünkü onlarda "ürün" satıldığında yaşam döngüsü biter.

**Mimari sonuç:** Telefon kaydı (asset) ile telefon hareketi (event) birbirinden ayrılmalıdır. `phones` tablosu kimliği tutar, hareket tabloları (alış, satış, tamir, masraf, parça değişimi, iade) telefona referans verir. Zaman çizelgesi bu hareketlerin kronolojik birleşimidir. Bu, "EN ÖNEMLİ KURAL"ın (IMEI tekilliği) doğrudan veritabanı karşılığıdır.

### 1.2 Kritik Gerçek Dünya Tespitleri

Sektörün günlük akışından çıkan, briefte örtük kalan gerçekler:

1. **Bir telefonun birden fazla alışı ve satışı olur.** "Alış fiyatı" telefonun değil, alış işleminin özelliğidir. Kar hesabı her zaman *son alış + o alıştan sonraki masraflar* üzerinden yapılmalıdır, tüm geçmiş masraflar üzerinden değil. (Aksi halde ikinci kez alınan telefonun karı ilk turdaki masraflarla kirlenir.)
2. **Donanım testi de alışa bağlıdır.** Telefon ikinci kez geldiğinde testler yeniden yapılır; test sonuçları telefonun değil, "giriş"in (intake) fotoğrafıdır. İki giriş arasındaki test farkı ("geçen sefer Face ID çalışıyordu") ticari olarak çok değerlidir.
3. **Tamirdeki her cihaz stok değildir.** Müşteri tamiri için gelen telefon dükkânın malı değildir; stok değeri ve kar raporlarına girmemelidir. Telefon kaydında **sahiplik** (stok / müşteri cihazı) ayrımı zorunludur.
4. **Telefoncu ekran başında değil, tezgâh başındadır.** İşlem hızı satıştan önemlidir: müşteri beklerken 8 alanlı form doldurulamaz. Hızlı alış akışı ≤ 30 saniye hedeflenmelidir (IMEI tara → model otomatik gelsin → fiyat → kaydet; detaylar sonra tamamlanır).
5. **Nakit yoğun sektör.** Gün sonu kasa sayımı, nakit/POS/havale ayrımı olmadan cari ve kar raporları güven vermez.

## 2. Eksik Modüller (tespit)

Briefteki 10 modül iskelet olarak doğru; ancak gerçek bir telefoncunun günü şu eksikler yüzünden programın *dışına* taşar. Dışına taşan her iş = deftere dönüş = ürünün terk edilmesi.

| # | Eksik Modül | Neden zorunlu |
|---|-------------|---------------|
| 1 | **Takas (Trade-in)** | En yaygın satış şekli: müşteri eski telefonunu verir + fark öder. Tek işlemde bir satış + bir alış + fark tahsilatı oluşmalı. Bu yoksa kullanıcı iki ayrı işlem girip carileri elle düzeltmek zorunda kalır. |
| 2 | **Kasa / Gün Sonu** | Nakit, POS, havale ayrımı; gün sonu sayım ve fark. Kar raporunun güvenilirliği kasaya bağlı. |
| 3 | **Taksit / Vadeli Tahsilat** | Elden taksit bu sektörde standarttır. Satışa ödeme planı bağlanmalı, geciken taksit dashboard'da uyarı vermeli. |
| 4 | **Ekspertiz / Teklif** | Müşteri telefon satmaya gelir, teklif verilir, gitmesine izin verilir. Teklif kaydı tutulmazsa geri geldiğinde fiyat hafızası yoktur. Teklif → tek tuşla alışa dönüşmeli. |
| 5 | **Rezervasyon / Kapora** | "Bu telefonu ayır, akşam geleyim." Kaporalı telefon satılabilir görünmemeli. |
| 6 | **İade Yönetimi** | Satış iadesi (para iade / değişim) ve alış iadesi. İade telefonu otomatik stoğa dönmeli, cari düzelmeli. |
| 7 | **Yedek Parça Stoğu** | Tamir yapan dükkânda ekran/batarya stoğu vardır. Tamirde kullanılan parça stoktan düşmeli ve telefonun masrafına yazılmalı. |
| 8 | **Aksesuar Satışı** | Kılıf, şarj aleti, kulaklık: IMEI'siz, adetli ürün. Günlük cironun önemli parçası; sistem dışında kalamaz. |
| 9 | **Kullanıcı & Yetki** | Patron/çalışan ayrımı: çalışan alış fiyatını ve karı görmemeli. Tek kullanıcılı ERP güven vermez. |
| 10 | **Yedekleme & Veri Güvenliği** | Offline sistemde veri tek kopyadır. Otomatik yerel yedek + harici diske/klasöre yedek + geri yükleme zorunlu. |
| 11 | **Etiket & Barkod Yazdırma** | Raf etiketi (model, fiyat, IMEI barkodu). Barkod okuyucu ile her ekranda IMEI taranabilmeli. |
| 12 | **Kimlik / Yasal Kayıt (KVKK)** | Türkiye'de ikinci el telefon alımında satıcı kimlik bilgisi kaydı fiili zorunluluktur. Alış akışında kimlik alanları + isteğe bağlı kimlik fotoğrafı; KVKK gereği maskeleme ve yetkiye bağlı görünürlük. |
| 13 | **Denetim Kaydı (Audit Log)** | Fiyat değiştiren, kayıt silen kim? Çalışanlı dükkânda vazgeçilmez. |
| 14 | **Konsinye (Emanet) Satış** | Başkasının telefonunu satıp komisyon alma. Konsinye cihaz stok değerine girmez, satışta sahibine borç doğar. |

## 3. Profesyonel Öneriler

### 3.1 Ürün Kararları

1. **Telefon durumu tek bir state machine olsun.**
   `EKSPERTIZ → STOKTA → REZERVE → SATILDI → (GARANTİ DÖNÜŞÜ) → TAMİRDE → STOKTA/İADE` + `HURDA (parça kaynağı)` + `KONSİNYE` + `MÜŞTERİ CİHAZI (tamir)`.
   Gerekçe: Durum geçişleri kurala bağlanır (satılmış telefon tekrar satılamaz; rezerve telefon önce rezervasyon iptali ister). UI'daki tüm rozetler ve filtreler bu enum'dan beslenir.

2. **Hurdaya ayırma + parça hasadı.** Satılamayan telefon hurdaya ayrılır, ekranı/bataryası parça stoğuna girer, kalan maliyet gider yazılır. Refurbished satıcısının gerçek akışıdır.

3. **Karlılıkta "tur" kavramı.** Her alış bir *tur* başlatır (acquisition). Kar = o turun satışı − (o turun alış fiyatı + o tur içindeki masraflar). Telefon kartı tur bazlı kar kırılımı gösterir: "1. tur: +₺1.500, 2. tur: +₺700, toplam: +₺2.200".

4. **Fiyat önerisi (yerel istihbarat).** Aynı model+depolama için geçmiş alış/satış ortalaması alış ekranında gösterilsin ("Bu modeli ort. ₺9.200'e alıp ₺11.400'e sattınız"). İnternet gerektirmez, kendi verisinden gelir; pazarlıkta gerçek koz.

5. **Garanti = satışın çocuğu.** Garanti telefona değil satışa bağlanır (aynı telefon iki kez satılırsa iki ayrı garanti). Garanti dönüşü akışı: IMEI tara → aktif garanti otomatik bulunur → tamir kaydı garanti bayrağıyla açılır → masraf "garanti gideri" olarak o turun karından düşer.

6. **Stok yaşlanma uyarısı.** 30/60/90 gün eşikleriyle renk kodu; dashboard "eriyen para" listesi. Telefonda fiyat düşer; bekleyen telefon zarardır — ürün bunu görünür kılmalı.

### 3.2 Teknik Kararlar

7. **Zaman çizelgesi türetilmiş olsun, kopyalanmış değil.** Timeline ayrı tablo olarak yazılmaz; alış/satış/tamir/masraf/parça/iade tablolarının UNION görünümünden türetilir. Gerekçe: Çift kayıt tutarsızlığı imkânsızlaşır; her olayın tek doğruluk kaynağı kendi tablosudur.
8. **Parasal değerler INTEGER kuruş olarak saklansın.** SQLite'ta REAL yuvarlama hatası kar raporunu bozar.
9. **Soft delete + audit.** Kayıt silinmez, `deleted_at` işaretlenir; her mutasyon audit_log'a yazılır.
10. **FTS5 ile global arama.** IMEI, model, müşteri adı, not içeriği tek indekste; Ctrl+K araması < 50 ms.
11. **Lisans: Ed25519 imzalı offline lisans dosyası.** Device ID = makine GUID + donanım parmak izinin SHA-256 özeti. Geliştirici, private key ile `{device_id, expiry, plan}` payload'ını imzalar; uygulama gömülü public key ile doğrular. Saat geri alma koruması: uygulama gördüğü en ileri zamanı şifreli saklar, sistem saati bunun gerisine düşerse lisans uyarısı verir. İnternet hiç gerekmez.
12. **Barkod okuyucu = klavye.** HID modda çalışan okuyucular klavye gibi yazar; global bir "IMEI dinleyici" 15 haneli hızlı ardışık girişi yakalayıp telefon kartını açar. Ek donanım entegrasyonu gerekmez.

### 3.3 UX Kararları (zorunlu workflow ile uyumlu)

13. **Command palette (Ctrl+K) birinci sınıf vatandaş:** her kayıt, her aksiyon, her sayfa buradan erişilebilir.
14. **Hızlı işlem tuşları:** F2 Hızlı Alış, F3 Hızlı Satış, F4 IMEI Ara, F6 Tamir Kabul, F8 Kasa. Tezgâh senaryosunda fare kullanımı sıfıra iner.
15. **İki aşamalı veri girişi:** Hızlı kayıt (zorunlu 4-5 alan) → sonradan zenginleştirme (testler, fotoğraf, kozmetik). "Eksik bilgili telefonlar" dashboard'da görev listesi olur.
16. **Satır içi işlem:** tabloda sağ tık menüsü (Sat, Rezerve Et, Tamire Al, Etiket Yazdır, Zaman Çizelgesi), çoklu seçim + toplu işlem (toplu etiket, toplu durum değişimi).
17. **Detaylar sağ panelde (drawer):** liste bağlamı kaybolmadan telefon kartı sağdan açılır; çift tık tam sayfa açar. Linear'ın issue paneli modeli.
