# ZORUNLU GELİŞTİRME WORKFLOW'U — PhoneDealer ERP

Bu kurallar her geliştirme oturumunda geçerlidir. İstisna yok.

## 1. UI/UX — UI UX Pro Max Skill

- Her yeni ekran/bileşen tasarımından **önce** `ui-ux-pro-max` skill'i kullanılır.
- Design system kaynağı: `design-system/phonedealer-erp/MASTER.md` (üretildi, persist edildi).
- Sayfa bazlı override: `design-system/phonedealer-erp/pages/<sayfa>.md` varsa MASTER'ı ezer.
- Hedef kalite: Linear / Raycast / Notion / Stripe Dashboard. Windows Forms görünümü yasak.
- Basit CRUD ekranı yasak; her ekran: loading skeleton + empty state + error state + klavye erişimi.

## 2. Component Önceliği — 21st.dev MCP

Sıra kesin:
```
21st.dev MCP  →  shadcn/ui  →  Custom component (son çare)
```
- Yeni ekrandan önce Magic MCP ile en iyi desktop ERP arayüzleri araştırılır; ilham alınır, kopyalanmaz.
- **NOT:** 21st.dev / Magic MCP bu makinede henüz bağlı değil. Kod fazına geçmeden önce MCP server konfigürasyonu eklenmeli (`claude mcp add` ile @21st-dev/magic). Bağlanana kadar shadcn/ui birincil kaynaktır.

## 3. Design System Sabitleri (MASTER.md özeti)

- Stil: **Data-Dense Dashboard** — KPI kartları, yoğun tablolar, grid, minimal padding.
- Renk: Primary `#1E40AF`, Accent `#D97706`, Background `#F8FAFC`, Destructive `#DC2626`; durum renkleri yeşil/amber/kırmızı. Açık + koyu tema tam destek.
- Tipografi: Fira Code (başlık/veri) + Fira Sans (gövde) — **offline paketlenir**, Google Fonts CDN kullanılmaz (offline-first kuralı).
- İkon: emoji yasak; tek aile vektör ikon (Phosphor veya Lucide), tutarlı stroke.
- Anti-pattern: süslü dekorasyon, filtresiz liste.

## 4. Kod Öncesi Zorunlu Tamamlananlar

1. Information Architecture ✅ (docs/03)
2. User Flow ✅ (docs/03 §4, docs/05)
3. Navigation ✅ (docs/03)
4. Wireframe — ekran spesifikasyonları ✅ (docs/04); yüksek çözünürlüklü wireframe ekran geliştirilirken sayfa bazlı üretilecek
5. Component Tree — kod fazı başında, design system üzerinden
6. Design System ✅ (design-system/phonedealer-erp/)
7. Screen Hierarchy ✅ (docs/03 §1)
8. Database ✅ (docs/02)
9. State Management — kod fazı başında kararlaştırılacak (öneri: TanStack Query + Zustand; SQLite tek doğruluk kaynağı)
10. Folder Structure — kod fazı başında

Hiçbir ekran plansız geliştirilmez.

## 5. UX Sabitleri

Minimum tıklama · minimum form alanı · klavye ile tam kullanım · global arama (Ctrl+K) · command palette · sağ tık menüsü · çoklu seçim + bulk işlem · her mutasyonda 6 sn undo · barkod okuyucu her ekranda aktif.
