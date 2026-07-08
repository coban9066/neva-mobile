# 04 — Ekran Spesifikasyonları

Tüm ekranlar `design-system/phonedealer-erp/MASTER.md`'deki design system'e bağlıdır (Data-Dense Dashboard stili, durum renkleri yeşil/amber/kırmızı, açık+koyu tema). Her ekranda: loading skeleton, empty state (aksiyon önerili), error state tanımlı olmalıdır.

---

## 1. Dashboard

**Görev:** Dükkânın günlük nabzı. Kullanıcı sabah açtığında 5 saniyede "bugün ne yapmalıyım"ı görmeli.

**Layout:** 12 kolonlu grid, 3 bölge.

1. **KPI şeridi (üst, 6 kart):** Bugünkü Satış (adet+tutar), Bu Ayki Satış, Stoktaki Telefon, Toplam Stok Değeri (maliyet bazlı), Bu Ayki Net Kar, Kasadaki Nakit. Kar/maliyet kartları `see_profit` yetkisine bağlı gizlenir.
2. **Görev bölgesi (orta-sol):** *Aksiyon gerektirenler* — geciken taksitler, teslim sözü geçen tamirler, süresi dolan rezervasyonlar, 60+ gün bekleyen telefonlar, eksik bilgili telefonlar. Her satır tıklanınca ilgili kayda gider.
   Gerekçe: Dashboard sadece gösterge değil, iş kuyruğudur — ERP'yi "her sabah açılan program" yapan budur.
3. **Analiz bölgesi (orta-sağ + alt):** Son 30 gün satış/kar çizgi grafiği, En Çok Kar Eden 5 Telefon, En Uzun Bekleyen 5 Telefon, Bekleyen Garantiler (30 gün içinde dolacaklar), Son İşlemler akışı.

**Aksiyonlar:** Tüm KPI kartları tıklanabilir → ilgili filtreli listeye gider.

---

## 2. Telefonlar — Liste

**Görev:** Stok yönetiminin merkezi; tüm telefonlere durum bazlı erişim.

**Layout:** Üstte durum sekmeleri (Stokta 42 / Rezerve 3 / Tamirde 5 / ...), altında yoğun veri tablosu.

**Kolonlar:** Durum rozeti, Model (marka+model+depolama+renk tek hücrede, iki satır), IMEI (son 6 hane vurgulu — telefoncular son haneyle konuşur), Kozmetik, Pil %, Maliyet*, Etiket Fiyatı, Stokta Gün (30/60/90 renk kodu), Son Hareket. (*yetkiye bağlı)

**Etkileşim:**
- Satır tık → sağ panel (drawer) telefon kartı; çift tık → tam sayfa.
- Sağ tık menü: Sat (F3), Rezerve Et, Tamire Al, Etiket Yazdır, Hurdaya Ayır, Zaman Çizelgesi.
- Çoklu seçim (Space) → toplu etiket, toplu fiyat güncelleme.
- Filtre çubuğu: marka, model, depolama, kozmetik, pil aralığı, gün aralığı; filtreler URL-state olarak saklanır (geri dönünce aynı görünüm).
- Görünüm anahtarı: tablo ↔ kart grid (vitrin fotoğraflı).

---

## 3. Telefon Kartı (drawer / tam sayfa)

**Görev:** Telefonun tüm yaşamı tek yerde. Sistemin kalbi.

**Başlık bloğu:** Model + renk + depolama, IMEI1/IMEI2 (kopyala butonu), büyük durum rozeti, kozmetik + pil sağlığı göstergesi, aktif tur kar özeti ("Maliyet ₺9.700 → Etiket ₺11.500 → Beklenen kar ₺1.800").

**Sekmeler:**

| Sekme | İçerik |
|-------|--------|
| **Özet** | Kimlik alanları (düzenlenebilir), aktif rezervasyon/garanti uyarıları, hızlı aksiyon butonları |
| **Zaman Çizelgesi** | `v_phone_timeline` dikey akış: ikon + başlık + tutar + tarih + kullanıcı. Tur sınırları görsel ayraçla ("— 2. TUR —"). Her olay tıklanınca kaynak kayda gider. |
| **Testler** | Test matrisi: satırlar test türleri, kolonlar girişler (Alış #1, Tamir #4, Alış #2). Hücreler ✓/⚠/✗. Fark hücreleri vurgulu. Yeni test seti tek ekranda hızlı doldurma (klavyeyle 1=ok 2=issue 3=fail, otomatik sonraki satır). |
| **Parçalar & Masraflar** | Değişen parçalar (tür + kalite rozeti: Orijinal/Yan Sanayi/Refurb) ve tur bazlı masraf listesi + tur maliyet toplamı. |
| **Fotoğraflar** | Sürükle-bırak yükleme, alış/satış anı etiketli galeri. |
| **Satış & Garanti** | Tüm satış turları, her birinin garantisi ve kalan gün, iade kayıtları. |

Gerekçe: Sekmeli kart, tek uzun sayfadan hızlıdır; telefoncu %90 Özet+Zaman Çizelgesi kullanır, gerisi talep üzerine yüklenir.

---

## 4. Hızlı Alış (F2 — modal)

**Görev:** Tezgâhta ≤30 saniyede alış kaydı.

**Akış (tek modal, adım göstergeli):**
1. IMEI alanı otomatik odaklı (barkod okuyucu doğrudan yazar). Luhn doğrulama anlık. Kayıtlı IMEI ise geçmiş özeti + "Yeniden Alış" onayı.
2. Marka/model combobox (yazarak ara, katalogtan); model seçilince depolama seçenekleri çip olarak gelir.
3. Satıcı: son kullanılanlar + arama + satır içi "yeni kişi" (ad+telefon yeter, kimlik sonra).
4. Fiyat alanı — yanında bilgi kutusu: "Bu model son 6 ayda ort. alış ₺X / satış ₺Y" (kendi verisinden).
5. Ödeme türü (nakit varsayılan) → **Ctrl+Enter kaydet**.

**Kayıt sonrası toast:** "Test Ekle · Etiket Yazdır · Kimlik Ekle · Geri Al". Atlanırsa telefon "eksik bilgili" görev listesine düşer.

Gerekçe: Zorunlu alan minimumu (IMEI, model, satıcı, fiyat); kalite verileri ikinci aşamaya itilir — hız ile veri zenginliği çatışması böyle çözülür.

---

## 5. Hızlı Satış (F3 — modal)

**Görev:** Satış + ödeme + garanti tek akışta.

**Akış:**
1. Telefon seç (IMEI tara veya stok araması; stok dışı seçilemez).
2. Müşteri seç/ekle.
3. Fiyat — maliyet ve beklenen kar canlı rozet (yetkili kullanıcıya). Maliyet altına satışta uyarı + not zorunlu.
4. Ödeme: Peşin / Taksit (peşinat, adet, vade → plan önizleme tablosu) / **Takas** (gömülü mini Hızlı Alış: müşteri telefonu IMEI + model + takdir fiyatı → fark otomatik).
5. Garanti: varsayılan süre önerili, düzenlenebilir, "garanti yok" seçilebilir.
6. Ctrl+Enter → atomik kayıt (satış+ledger+kasa+garanti+taksit) → fiş/etiket yazdırma önerisi.

---

## 6. Alışlar / Satışlar — Listeler

**Görev:** İşlem defteri; tarih aralıklı, kişi/model filtreli dökümler.

Tablo + üst özet şeridi (adet, toplam tutar, ort. fiyat; satışta + toplam kar). Satır → ilgili telefon kartının o olayına gider. İade başlatma sağ tık menüsünde.

---

## 7. Ekspertiz / Teklifler

**Görev:** Alınmayan telefonların fiyat hafızası.

Hızlı form: model + depolama + kozmetik + teklif + müşteri beklentisi + kişi (opsiyonel). Sonuç: Beklemede/Alındı/Reddedildi. "Alındı" → tek tuşla Hızlı Alış'a dönüşür (alanlar taşınır).

---

## 8. Tamir Panosu (kanban)

**Görev:** Servis iş takibi; hangi cihaz hangi aşamada.

Kolonlar: Alındı → Parça Bekliyor → Tamirde → Hazır → Teslim Edildi. Kart: model, sorun özeti, tür rozeti (Müşteri/İç/Garanti), söz verilen tarih (geçmişse kırmızı), fiyat. Sürükle-bırak durum değiştirir; "Hazır"a geçince müşteri tamirinde tahsilat adımı sorulur.

**Tamir Kabul (F6):** IMEI tara → kayıtlıysa kart bağlanır, değilse `ownership=customer` minimal kayıt (stok raporlarına girmez). Sorun, teslim sözü, tahmini fiyat → çıktı: teslim fişi.

**Tamir Detayı:** problem/teşhis, kullanılan parçalar (parça stoğundan düşer, kalite seçimi), işçilik, test sonuçları (tamir sonrası set), tahsilat.

---

## 9. Garanti

**Görev:** Aktif garantilerin ve garanti maliyetinin takibi.

İki liste: **Aktif Garantiler** (kalan güne göre sıralı, 30 günden azı amber) ve **Garanti Dönüşleri** (garanti tamirleri + maliyeti). Üstte özet: aktif adet, bu ay dönüş adedi, bu ay garanti gideri.
Gerekçe: Garanti gideri gizli kar kaçağıdır; ayrı görünürlük ister.

---

## 10. Cari Hesaplar

**Liste:** kişi, tür (müşteri/tedarikçi/ikisi), bakiye (borçlu kırmızı / alacaklı yeşil), son işlem, toplam alış/satış hacmi.

**Kişi Kartı:** başlıkta bakiye + iletişim; sekmeler: İşlem Geçmişi (ledger, ref'e tıklanabilir), Taksitler (vade takvimli, gecikenler vurgulu), Telefonları (bu kişiden alınan/bu kişiye satılan cihazler), Ekspertiz Geçmişi, Kimlik/KVKK (maskeli, yetkiyle açılır).

**Tahsilat/Ödeme (F7):** kişi → yön (tahsilat/ödeme) → tutar → yöntem → varsa açık taksitlere otomatik dağıtım (en eski vadeden) → kasa kaydı otomatik.

---

## 11. Kasa

**Görev:** Günlük para akışının tek doğruluk noktası.

Günlük görünüm: giriş/çıkış listesi + yöntem kırılım kartları (Nakit/POS/Havale). Elle kasa hareketi (gider: kira, çay, kargo) eklenebilir.

**Gün Sonu (F8):** beklenen nakit vs sayılan nakit → fark (not zorunlu) → kapanış + otomatik yedek. Kapanış sonrası o güne kayıt girişi `manager+` yetkisi ister.

---

## 12. Yan Stok (Aksesuar + Parça)

**Aksesuarlar:** barkodlu hızlı satış (okut → adet → ödeme), kritik stok uyarısı, basit giriş/çıkış.
**Yedek Parçalar:** parça türü + kalite + uyumlu modeller + adet + maliyet; tamirde kullanılınca otomatik düşer. Hurda hasadı buradan giriş alır.

---

## 13. Raporlar

**Görev:** Karar desteği. Her rapor: tarih aralığı seçici + grafik + tablo + CSV/PDF dışa aktarım.

| Rapor | İçerik |
|-------|--------|
| Marka/Model Bazlı Satış | adet, ciro, ort. fiyat, ort. stokta kalma süresi |
| Kar Analizi | aylık net kar trendi, tur bazlı kar dağılımı, garanti gideri ayrımı |
| Stok Yaş Analizi | 0-30/31-60/61-90/90+ kovaları, kovadaki bağlı para |
| En Karlı Telefonlar | tur karına göre sıralı |
| Cari Analiz | en çok alış yapılan tedarikçiler, en çok alan müşteriler, hacim |
| Kasa & Tahsilat | yöntem kırılımı, taksit tahsilat performansı, geciken alacak yaşlandırma |

Gerekçe: Tüm raporlar view katmanından okur; Dashboard ile aynı sayıyı gösterir — tutarlılık pazarlanabilir bir özelliktir.

---

## 14. Ayarlar

Dükkân bilgileri (fiş başlığı), kullanıcılar & roller (owner/manager/staff + kritik yetki bayrakları), katalog yönetimi (marka/model birleştirme dahil), etiket şablon editörü (alan seç + önizleme), yedekleme (otomatik plan + hedef klasör + geri yükleme + son yedek durumu), lisans (Device ID göster/kopyala, lisans dosyası yükle, kalan gün), görünüm (açık/koyu/sistem, yoğunluk: rahat/sıkı).

---

## 15. İlk Açılış (Onboarding)

1. Dükkân adı → 2. Yönetici kullanıcı oluştur → 3. Lisans (Device ID göster → "lisans dosyanız varsa yükleyin, yoksa 14 gün deneme") → 4. Varsayılanlar (para birimi, garanti süresi, yedek klasörü) → 5. "İlk telefonunuzu alın (F2)" yönlendirmesi.
Gerekçe: Boş programa bakan kullanıcı kaybedilir; onboarding ilk kaydı yaptırarak bitirmelidir.
