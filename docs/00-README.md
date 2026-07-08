# PhoneDealer ERP — Ürün Tasarım Dokümantasyonu

> Durum: **Tasarım fazı tamamlandı — geliştirmeye hazır.** Kod yok, tamamı ürün tasarımı.
> Tarih: 2026-07-07

## Doküman Haritası

| # | Dosya | İçerik |
|---|-------|--------|
| 01 | [01-analiz-ve-kapsam.md](01-analiz-ve-kapsam.md) | Proje analizi, eksik modüller, profesyonel öneriler |
| 02 | [02-veritabani-mimarisi.md](02-veritabani-mimarisi.md) | SQLite şeması, tüm tablolar, entity ilişkileri (ERD) |
| 03 | [03-bilgi-mimarisi-ve-navigasyon.md](03-bilgi-mimarisi-ve-navigasyon.md) | Sayfa ağacı, navigasyon akışı, klavye kısayolları, bilgi mimarisi |
| 04 | [04-ekran-spesifikasyonlari.md](04-ekran-spesifikasyonlari.md) | Her ekranın görevi, layout'u, bileşenleri, aksiyonları |
| 05 | [05-kullanici-senaryolari.md](05-kullanici-senaryolari.md) | Gerçek iş akışına dayalı uçtan uca senaryolar |
| — | [KURALLAR.md](KURALLAR.md) | Zorunlu geliştirme workflow'u (UI/UX Pro Max, 21st.dev MCP, Design System) |
| — | `../design-system/phonedealer-erp/MASTER.md` | Üretilmiş design system (renk, tipografi, efekt) |

## Temel Prensipler (özet)

1. **IMEI merkezli:** Telefon bir kez oluşturulur; tüm yaşam döngüsü tek kartta birikir.
2. **Offline-first:** SQLite, internet gerektiren hiçbir özellik yok. Açılış < 1 sn.
3. **Klavye-öncelikli UX:** Command palette (Ctrl+K), F-tuşları, barkod okuyucu ile IMEI tarama her ekranda çalışır.
4. **Premium desktop hissi:** Linear / Raycast / Stripe Dashboard kalitesi. Windows Forms görünümü yasak.
5. **Stack:** Tauri + React + TypeScript + SQLite.
