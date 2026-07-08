# 06 — Offline Lisans Sistemi Mimarisi (NEVA MOBILE)

## 1. Genel Model

Tamamen offline, kod tabanlı, asimetrik imzalı lisans.

```
Geliştirici (NEVA License Manager)          Müşteri (NEVA MOBILE)
────────────────────────────────           ─────────────────────
private key (yalnız geliştiricide)          public key (uygulamaya gömülü)
Device ID + tür + tarihler → payload
payload'ı Ed25519 ile imzala
payload+imza → Base32 → LİSANS KODU  ───▶   kodu yapıştır → imza doğrula
                                            → Device ID eşleşmesi → tarih kontrolü
```

**Neden Ed25519 (HMAC değil):** HMAC'te gizli anahtar uygulama binary'sine gömülür; çıkarılırsa herkes lisans üretebilir. Ed25519'da binary'de yalnız *public key* vardır — binary tamamen çözülse bile lisans üretilemez. Kod biraz uzun olur (~125 karakter) ama kullanıcı kodu elle yazmaz, yapıştırır.

## 2. Device ID

- Kaynak: Windows `MachineGuid` (`HKLM\SOFTWARE\Microsoft\Cryptography\MachineGuid`). Windows yeniden kurulmadıkça değişmez; uygulama silinse de sabit kalır.
- Üretim: `SHA-256(MachineGuid + "NEVA")` → ilk 8 bayt → Base32 → `NVM-XXXX-XXXX-XXXX` (gösterim).
- Doğrulamada gösterim değil 8 baytlık hash kullanılır.

## 3. Lisans Kodu İçeriği

Payload (14 bayt, big-endian):

| Alan | Boyut | Açıklama |
|------|-------|----------|
| version | 1 | Format sürümü (=1) |
| device_hash | 8 | Device ID hash'i |
| plan | 1 | 0=Deneme 1=1Ay 2=3Ay 3=6Ay 4=12Ay 5=Sınırsız (6+ ileride) |
| start_days | 2 | 2024-01-01'den gün sayısı |
| end_days | 2 | Bitiş günü; 0xFFFF = sınırsız |

Kod = Base32-Crockford(payload ‖ Ed25519-imza[64B]), 5'li gruplar, `NVM-` öneki.

## 4. Doğrulama Akışı (her açılışta)

1. `settings.license_code` oku → yoksa **Aktivasyon ekranı**.
2. Base32 çöz → imzayı gömülü public key ile doğrula → geçersizse Aktivasyon.
3. `payload.device_hash == bu cihazın hash'i` → değilse Aktivasyon ("kod bu cihaza ait değil").
4. Saat geri alma koruması: `settings.license_last_seen` > şimdi + 24h ise şüpheli → Aktivasyon uyarısı. Her açılışta `last_seen = max(last_seen, now)`.
5. `end_days` geçtiyse → **Salt Okunur Mod**; geçmediyse normal mod.

## 5. Lisans Bitince: Salt Okunur Mod

- Uygulama açılır, tüm veriler görüntülenebilir.
- Engellenen: alış (F2), satış, kayıt düzenleme, yeni işlem.
- Çift katman: UI butonları kilitli **ve** Rust yazma komutları (`save_purchase` vb.) lisans kontrolü yapar — UI atlatılsa bile yazılamaz.
- Her ekranda üstte amber bant: "Lisans süresi doldu — salt okunur mod. Yenilemek için Device ID'nizi gönderin."

## 6. UI Akışı

- **Aktivasyon ekranı** (lisans yok/geçersiz): logo, NEVA MOBILE, Device ID + Kopyala, kod giriş alanı, Aktifleştir. Uygulama bu ekran geçilmeden kullanılamaz.
- **Ayarlar → Lisans:** durum, tür, başlangıç/bitiş, kalan gün, Device ID, maskelenmiş kod, "Lisansı Güncelle" (aktivasyon modalını açar).
- **Durum çubuğu:** kalan gün (son 30 günde amber, son 7 günde kırmızı).
- **Dashboard uyarısı:** kalan gün ≤ 14 ise görev listesinde satır.

## 7. Veritabanı

Ayrı tablo yerine `settings` anahtarları (tek satırlık durum için tablo şişkinliği gereksiz):
`license_code`, `license_last_seen`. Türetilen her şey (plan, tarihler, kalan gün) koddan çözülür — kopyalanabilir alan tutulmaz, tutarsızlık imkânsız.

## 8. NEVA License Manager (geliştirici uygulaması)

- Ayrı masaüstü uygulaması (Rust + egui, tek exe; müşteriye verilmez).
- Alanlar: Device ID, Lisans Türü (combo), Başlangıç, Bitiş (türe göre otomatik + elle değiştirilebilir), Açıklama.
- "Lisans Oluştur" → kod üretilir + panoya kopyala + `licenses.json`'a kayıt (müşteri geçmişi).
- İlk çalıştırmada `keygen`: `neva_private.key` (geliştiricide kalır) + public key Rust sabiti olarak ana uygulamaya gömülür.
- Yeni paket eklemek = plan enum'una satır eklemek; kod formatı değişmez (bitiş tarihi payload'da açık).

## 9. Uygulama Planı

1. Keypair üret (License Manager `--keygen`).
2. Ana uygulama Rust: `license.rs` — `get_license_status`, `activate_license(code)`, yazma komutlarında `ensure_writable` kontrolü.
3. Frontend: lisans store, Aktivasyon ekranı, Ayarlar > Lisans, salt okunur kilitler, durum çubuğu.
4. License Manager egui UI.
