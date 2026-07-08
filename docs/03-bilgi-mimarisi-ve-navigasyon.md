# 03 — Sayfa Ağacı, Navigasyon Akışı ve Bilgi Mimarisi

## 1. Sayfa Ağacı

```
PhoneDealer ERP
│
├── 🏠 Dashboard                            (Ctrl+1)
│
├── 📱 Telefonlar                           (Ctrl+2)
│   ├── Liste (varsayılan: Stokta)          — filtre sekmeleri: Stokta / Rezerve / Tamirde /
│   │                                         Satıldı / Konsinye / Hurda / Tümü
│   ├── Telefon Kartı (sağ panel / tam sayfa)
│   │   ├── Özet sekmesi (kimlik + durum + tur karı)
│   │   ├── Zaman Çizelgesi
│   │   ├── Donanım Testleri (giriş karşılaştırmalı)
│   │   ├── Parçalar & Masraflar
│   │   ├── Fotoğraflar
│   │   └── Garanti & Satış Geçmişi
│   └── Yeni Telefon (yalnızca Alış akışı içinden — tek başına telefon oluşturulmaz*)
│
├── 📥 Alışlar                              (Ctrl+3)
│   ├── Alış Listesi
│   ├── Hızlı Alış (F2 — modal, ≤30 sn akış)
│   └── Ekspertiz / Teklifler
│
├── 📤 Satışlar                             (Ctrl+4)
│   ├── Satış Listesi
│   ├── Hızlı Satış (F3 — modal; takas + taksit adımları içinde)
│   ├── Rezervasyonlar
│   └── İadeler
│
├── 🔧 Tamirler                             (Ctrl+5)
│   ├── Tamir Panosu (kanban: Alındı → Parça Bekliyor → Tamirde → Hazır → Teslim)
│   ├── Tamir Kabul (F6)
│   └── Tamir Detayı
│
├── 🛡 Garanti                              (Ctrl+6)
│   ├── Aktif Garantiler (kalan güne göre)
│   └── Garanti Dönüşleri (garanti tamirleri)
│
├── 👥 Cari Hesaplar                        (Ctrl+7)
│   ├── Kişi Listesi (bakiyeli)
│   ├── Kişi Kartı (özet, işlem geçmişi, taksitler, ekspertiz geçmişi)
│   └── Tahsilat / Ödeme (F7)
│
├── 💰 Kasa                                 (Ctrl+8)
│   ├── Günlük Hareketler (nakit/POS/havale kırılımı)
│   ├── Gün Sonu Kapanışı (F8)
│   └── Kapanış Geçmişi
│
├── 📦 Yan Stok
│   ├── Aksesuarlar (+ hızlı aksesuar satışı, barkodla)
│   └── Yedek Parçalar
│
├── 📊 Raporlar                             (Ctrl+9)
│   ├── Satış (marka/model/aylık)
│   ├── Kar Analizi (aylık kar, en karlı telefonlar, tur bazlı)
│   ├── Stok Yaş Analizi
│   ├── Cari (en çok alış yapılan / en çok satılan kişiler)
│   └── Kasa & Tahsilat
│
└── ⚙ Ayarlar                               (Ctrl+0)
    ├── Dükkân Bilgileri
    ├── Kullanıcılar & Yetkiler
    ├── Katalog (marka/model yönetimi)
    ├── Etiket & Yazdırma Şablonları
    ├── Yedekleme & Geri Yükleme
    ├── Lisans (Device ID, lisans dosyası yükleme)
    └── Görünüm (tema: açık/koyu, yoğunluk)
```

\* Gerekçe: Telefon kayıt olarak yalnızca bir alış (veya müşteri tamiri / konsinye kabul) bağlamında doğar. Bağlamsız "telefon ekle" formu, alışsız hayalet kayıtlar üretir ve IMEI-tekillik disiplinini bozar.

## 2. Global Katmanlar (her ekranın üstünde)

| Katman | Davranış |
|--------|----------|
| **Sidebar** | 10 modül + daralt (Ctrl+B). Rozetler: tamirde bekleyen sayısı, geciken taksit sayısı. |
| **Üst araç çubuğu** | Global arama kutusu, hızlı işlem butonları (Alış/Satış/Tamir), aktif kullanıcı, gün sonu durumu. |
| **Command Palette (Ctrl+K)** | Sayfa + aksiyon + kayıt araması tek yerde. "sat 3521..." yazınca o IMEI için satış akışını açar. |
| **Global IMEI dinleyici** | Barkod okuyucudan gelen 15 haneli hızlı giriş her ekranda yakalanır → telefon kartı açılır; telefon kayıtlı değilse "Hızlı Alış?" önerilir. |
| **Toast + Undo** | Her mutasyon sonrası 6 sn geri al fırsatı. Gerekçe: hız yanlış kayıt doğurur; undo, onay modalından hızlıdır. |
| **Durum çubuğu (alt)** | DB yedek durumu, lisans kalan gün, klavye ipuçları. |

## 3. Klavye Kısayolları

| Tuş | Aksiyon | | Tuş | Aksiyon |
|-----|---------|---|-----|---------|
| Ctrl+K | Command palette | | F2 | Hızlı Alış |
| Ctrl+1..0 | Modül geçişi | | F3 | Hızlı Satış |
| Ctrl+F | Sayfa içi arama | | F4 | IMEI ara |
| Ctrl+B | Sidebar daralt | | F6 | Tamir kabul |
| Esc | Panel/modal kapat | | F7 | Tahsilat/Ödeme |
| Enter | Satır aç (panel) | | F8 | Kasa / gün sonu |
| Ctrl+Enter | Formu kaydet | | F9 | Etiket yazdır (seçili) |
| ↑↓ + Space | Liste gezinme + çoklu seçim | | Ctrl+Z | Son işlemi geri al |

Gerekçe: F-tuşları modsuzdur — tezgâhta müşteri beklerken tek tuşla akış açılır. Ctrl+rakam ERP standartıdır (tarayıcı sekmesi alışkanlığı).

## 4. Navigasyon Akışları (ana yollar)

### 4.1 Alış (tezgâh senaryosu — hedef ≤ 30 sn)
```
F2 → IMEI tara/yaz
   ├─ IMEI yeni → model önerisi (katalogtan) → renk/depolama → satıcı seç/ekle
   │              → fiyat (yanında: bu modelin ort. alış/satış istatistiği)
   │              → ödeme türü → Ctrl+Enter = KAYIT
   │              → toast: "Kaydedildi — [Test Ekle] [Etiket Yazdır] [Geri Al]"
   └─ IMEI kayıtlı → mevcut kart açılır + geçmiş özeti ("2 ay önce sizden ₺X'e satın alındı")
                    → "Yeniden Alış" onayı → yeni tur açılır, form aynı
```

### 4.2 Satış (takas dahil)
```
F3 → IMEI/arama ile stoktan telefon seç → müşteri seç/ekle
   → fiyat (maliyet + hedef kar rozetli) → ödeme adımı:
      ├─ Peşin (nakit/POS/havale)
      ├─ Taksit → peşinat + taksit sayısı + vade günü → plan önizleme
      └─ Takas → müşterinin telefonu için gömülü Hızlı Alış → fark otomatik hesap
   → garanti süresi (varsayılan ayarlardan) → Ctrl+Enter
   → satış fişi/etiket yazdır? → stok durumu SATILDI, garanti başlar, kasa + cari işlenir
```

### 4.3 Garanti dönüşü
```
Müşteri telefonu getirir → herhangi bir ekranda IMEI tara
→ kart açılır: "AKTİF GARANTİ — 47 gün kaldı" rozeti
→ sağ tık / buton: "Garanti Tamiri Aç" → tamir kaydı (kind=warranty, ücret 0)
→ tamir panosunda ilerler → parça kullanımı tur karına 'garanti gideri' yazılır
→ teslim → zaman çizelgesine işlenir
```

### 4.4 Gün sonu
```
F8 → bugünün özeti: nakit girş/çıkış, POS, havale, beklenen kasa
→ sayılan nakit girilir → fark hesaplanır (fark varsa not zorunlu)
→ kapanış kaydı → otomatik yedek tetiklenir
```

## 5. Bilgi Mimarisi (özet model)

```
KİMLİK KATMANI      phones (IMEI) ─ contacts ─ users
OLAY KATMANI        acquisitions → expenses/tests/parts → sales → warranties → repairs → returns
PARA KATMANI        ledger_entries ─ payments ─ installments ─ till_entries
YAN STOK KATMANI    products ─ part_stock_items ─ stock_movements
TÜRETİLMİŞ KATMAN   timeline, maliyet, kar, bakiye, stok değeri, yaşlanma  (hepsi view)
SUNUM KATMANI       Dashboard ─ listeler ─ kartlar ─ raporlar  (yalnız türetilmiş katmandan okur)
```

Gerekçe: Katmanlar arasında tek yönlü akış vardır; hiçbir ekran ham tabloya iş kuralı uygulamaz. Bu, raporların birbiriyle asla çelişmemesini garanti eder — klasik stok programlarının en büyük güven kaybı noktası budur.
