# PhoneDealer ERP — Uygulama

Tauri 2 + React 18 + TypeScript + SQLite (tauri-plugin-sql). Tasarım kaynakları: `../docs/`, `../design-system/phonedealer-erp/MASTER.md`.

## Çalıştırma

```
npm install
npm run tauri dev      # geliştirme
npm run tauri build    # dağıtım (NSIS/MSI)
```

DB dosyası: `%APPDATA%/com.phonedealer.erp/phonedealer.db`. Migration'lar `src-tauri/migrations/` altında, uygulama açılışında otomatik koşar.

## M1'de var

- App shell: sidebar, topbar, statusbar, açık/koyu tema, Ctrl+B daralt
- Klavye: Ctrl+K command palette, Ctrl+1..0 modül, F2 Hızlı Alış, F4 arama
- Barkod okuyucu: her ekranda 15 haneli hızlı rakam serisi → IMEI yakalanır (kayıtlıysa kart, değilse Hızlı Alış)
- Hızlı Alış (F2): IMEI Luhn doğrulama, kayıtlı IMEI'de **yeniden alış / yeni tur**, katalog combobox, satır içi kişi oluşturma, model fiyat istihbaratı, ledger + kasa kaydı
- Telefonlar: durum sekmeli liste, stok yaşı renk kodu, telefon kartı drawer (özet + zaman çizelgesi)
- Alışlar listesi, Dashboard (6 KPI + bekleyen telefonlar + son işlemler)
- Tam SQLite şeması (30 tablo + 7 view) — M2 modülleri şemada hazır

## M2 kapsamı (sırada)

1. Hızlı Satış (F3): takas + taksit + garanti
2. Tamir panosu (kanban) + tamir kabul (F6)
3. Cari kartı + tahsilat (F7), Kasa + gün sonu (F8)
4. Donanım test matrisi, masraf/parça girişi
5. Raporlar, Ayarlar (katalog, kullanıcı, yedekleme, lisans)
6. Etiket yazdırma, undo altyapısı, audit log yazımı

## Bilinen teknik borç

- `transaction()` (src/lib/db.ts): plugin-sql bağlantı havuzu birden çok bağlantı açabildiği için BEGIN/COMMIT'in aynı bağlantıda koşması garanti değil. M2'de kritik akışlar (satış, alış) tek Rust komutuna taşınacak → gerçek atomiklik.
- Arama LIKE tabanlı; FTS5 M2'de değerlendirilecek (bundled sqlite FTS5 desteği doğrulanmalı).
- Kullanıcı girişi yok; `created_by` alanları şimdilik boş.

## 21st.dev Magic MCP

`../.mcp.json` hazır; `YOUR_21ST_DEV_API_KEY` yerine https://21st.dev/magic/console anahtarı yazılmalı. Bağlanana kadar bileşen kaynağı: shadcn idiomunda el yazımı primitifler (`src/components/ui/`).
