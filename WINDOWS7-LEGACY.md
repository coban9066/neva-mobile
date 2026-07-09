# NEVA MOBILE — Windows 7 Legacy Edition

> Bu dosya ve bu branch'teki (`windows7-legacy`) tüm değişiklikler ana sürümden (master)
> tamamen bağımsızdır. Master'a merge EDİLMEZ.

## Neden ayrı bir sürüm?

- Güncel WebView2 bootstrapper'ı (`MicrosoftEdgeWebView2Setup.exe`) Windows 7'de çalışmaz:
  Windows 8 API'si olan `GetPackagesByPackageFamily`'yi çağırdığı için `KERNEL32.dll`
  "entry point not found" hatası verir.
- Windows 7'yi destekleyen son WebView2 Runtime: **109.0.1518.140** (Chromium 109).
- Rust 1.78+'ın ürettiği binary'ler Windows 7'de çalışmaz (minimum Windows 10).
  Windows 7'yi tam destekleyen son stable Rust: **1.77.2**.

## Bu branch'te değişenler

| Bileşen | Değişiklik |
|---|---|
| `app/src-tauri/rust-toolchain.toml` | YENİ — toolchain 1.77.2'ye sabitlendi |
| `app/src-tauri/Cargo.lock` | v3 formatına çevrildi; 14 paket 1.77.2 uyumlu sürüme sabitlendi |
| `app/src-tauri/tauri.conf.json` | `webviewInstallMode: skip`, NSIS hook, updater endpoint `legacy-win7/latest-win7.json` |
| `app/src-tauri/windows7/hooks.nsh` | YENİ — kurulumda WebView2 kontrolü; yoksa yanındaki 109 yükleyicisini çalıştırır |
| `app/vite.config.ts` | `build.target: "chrome109"` |
| `app/release.cjs` | Çıktı `release/Windows7-Legacy/`, rolling tag `legacy-win7`, `latest-win7.json`, asset son eki `-win7` |
| `tools/win7/WebView2Runtime109-x64.exe` | Git dışı (134 MB) — resmi Microsoft CDN'den indirilen Edge 109 kurumsal yükleyicisi |

`Cargo.toml`, Rust kaynak kodu, frontend kodu, SQLite şeması ve lisans sistemi **değişmedi** —
veritabanı ve lisans ana sürümle birebir aynıdır; kullanıcı Win10'a geçerken sadece
veritabanı dosyasını taşır (identifier `com.nevamobile.erp` aynı kaldığı için yol da aynıdır).

## Sabitlenen paketler (Cargo.lock)

toml 1.0.7, serde_spanned 1.0.4, home 0.5.9, idna_adapter 1.2.0, plist 1.7.4,
serde_with 3.16.1, time 0.3.41, base64ct 1.6.0, zeroize 1.8.2, toml_edit 0.25.5,
toml_datetime 1.0.1, toml_parser 1.0.10, toml_writer 1.0.7, uuid 1.20.0,
indexmap 2.11.4, crc 3.3.0, derive_more 2.0.1, zip 4.2.0, litemap 0.7.4,
rustls-platform-verifier 0.6.2, unicode-segmentation 1.12.0, cargo_metadata 0.19.0,
cargo-platform 0.1.8, reqwest 0.13.3, ed25519-dalek 2.1.1, hyper-rustls 0.27.7, open 5.1.4

## WebView2 Runtime 109 yükleyicisi

Microsoft, 109 için bağımsız bir WebView2 yükleyicisi sunmuyor. Resmi yöntem, Edge 109
kurumsal yükleyicisini WebView2 modunda çalıştırmaktır:

```
WebView2Runtime109-x64.exe --msedgewebview --do-not-launch-msedge --system-level
```

Dosya: `MicrosoftEdge_X64_109.0.1518.140.exe` (resmi Microsoft CDN)
SHA-256: `70d496873a0a1ca14ae0a038d25856b2121b1b4b7bad9801ce639b144bac41f8` (doğrulandı)

NSIS hook'u (`windows7/hooks.nsh`) kurulumda registry'den WebView2 varlığını kontrol eder;
yoksa setup'ın yanındaki `WebView2Runtime109-x64.exe`'yi otomatik çalıştırır.

## Auto Update — iki kanal birbirini görmez

| | Ana sürüm (master) | Legacy (bu branch) |
|---|---|---|
| Endpoint | `releases/latest/download/latest.json` | `releases/download/legacy-win7/latest-win7.json` |
| Tag | `v<version>` (latest) | `legacy-win7` (sabit rolling tag, `--latest=false`) |
| Asset | `NEVA_MOBILE_<v>_x64-setup.exe` | `NEVA_MOBILE_<v>_x64-setup-win7.exe` |

İmza anahtarı (pubkey) her iki kanalda aynıdır; `secrets/updater` değişmedi.

## Legacy build alma

```
git checkout windows7-legacy
cd app
set SKIP_PUBLISH=1
npm run release        # cikti: release/Windows7-Legacy/
```

`rust-toolchain.toml` sayesinde cargo otomatik 1.77.2 kullanır (rustup gerektirir).

## Bilinen riskler / test edilmesi gerekenler

1. **Tailwind CSS 4, resmi olarak Chrome 111+ hedefler.** WebView2 109 = Chromium 109;
   `color-mix()` gibi bazı modern CSS özellikleri 109'da yoktur. UI'ın gerçek Windows 7
   SP1 x64 makinede/VM'de gözle test edilmesi ŞARTTIR. Bozulma görülürse legacy branch'te
   Tailwind 3'e inmek gerekebilir.
2. Bu makine Windows 11; kurulum ve açılış testi gerçek Win7 ortamında yapılmadı.
3. Windows 7'de TLS 1.2'nin etkin olması gerekir (auto-update HTTPS için; KB3140245).
4. Windows 7 SP1 + KB4474419 (SHA-2 imza desteği) kurulu olmalıdır; yoksa hiçbir modern
   imzalı yükleyici çalışmaz.
