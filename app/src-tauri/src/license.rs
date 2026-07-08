//! Offline lisans doğrulama — docs/06-lisans-mimarisi.md
//! Kod: NVM- + Base32(payload[12B] ‖ Ed25519 imza[64B])
//! Payload: version(1) device_hash(6) plan(1) start_days(2,BE) end_days(2,BE)

use chrono::{Duration, NaiveDate, NaiveDateTime, Utc};
use data_encoding::{BASE32_NOPAD, HEXLOWER};
use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use hmac::{Hmac, Mac};
use serde::Serialize;
use sha2::{Digest, Sha256};
use sqlx::{Pool, Sqlite};

/// License Manager keygen çıktısı — private key yalnız geliştiricide.
const PUBLIC_KEY_HEX: &str = "1ed139b3e243e880de672ddb1883933a4292489f70f1c647914f7919c19e30fe";
const EPOCH: &str = "2024-01-01";
const PLAN_LABELS: &[&str] = &["Deneme", "1 Ay", "3 Ay", "6 Ay", "12 Ay", "Sınırsız"];

/// AppData'daki "son çalıştırma" imza anahtarı — dosya kullanıcı tarafından düz
/// metin olarak değiştirilemesin diye HMAC ile bütünlüğü korunur (gizlilik değil,
/// kurcalamayı tespit etmek amaçlı; anahtar diğer offline imzalar gibi binary'ye gömülü).
const TS_GUARD_SECRET: &[u8] = b"NEVA-MOBILE-TS-GUARD-v1-do-not-share";
const DATE_FMT: &str = "%Y-%m-%dT%H:%M:%S";
const SQLITE_DATETIME_FMT: &str = "%Y-%m-%d %H:%M:%S";

fn ts_guard_dir() -> std::path::PathBuf {
    let base = std::env::var("APPDATA").unwrap_or_else(|_| ".".into());
    std::path::PathBuf::from(base).join("com.nevamobile.erp")
}

fn ts_guard_path() -> std::path::PathBuf {
    ts_guard_dir().join(".neva_ts")
}

fn hmac_hex(ts: &str) -> Option<String> {
    let mut mac = Hmac::<Sha256>::new_from_slice(TS_GUARD_SECRET).ok()?;
    mac.update(ts.as_bytes());
    Some(HEXLOWER.encode(&mac.finalize().into_bytes()))
}

/// "Son çalıştırma" anını AppData'ya HMAC imzalı olarak yazar (asla var olandan geriye gitmez).
fn write_ts_guard(dt: &NaiveDateTime) {
    let ts = dt.format(DATE_FMT).to_string();
    let Some(sig) = hmac_hex(&ts) else { return };
    let dir = ts_guard_dir();
    if std::fs::create_dir_all(&dir).is_err() {
        return;
    }
    let path = ts_guard_path();
    if std::fs::write(&path, format!("{ts}|{sig}")).is_ok() {
        // Windows Gezgini'nde göze çarpmasın diye gizli öznitelik denenir (best-effort).
        let _ = std::process::Command::new("attrib")
            .args(["+h", &path.to_string_lossy()])
            .output();
    }
}

/// Dosyayı okur; imza tutarsızsa (elle düzenlenmiş/değiştirilmiş) None döner — bu da şüpheli sayılır.
fn read_ts_guard() -> Option<NaiveDateTime> {
    let raw = std::fs::read_to_string(ts_guard_path()).ok()?;
    let (ts, sig) = raw.split_once('|')?;
    if hmac_hex(ts)?.eq_ignore_ascii_case(sig.trim()) {
        NaiveDateTime::parse_from_str(ts, DATE_FMT).ok()
    } else {
        None
    }
}

/// Gerçek iş kayıtlarındaki en ileri tarih — sistem saati bunun bile gerisine
/// düşerse (aktif kullanılan bir kurulumda) saat manipülasyonu şüphesi kuvvetlenir.
async fn business_activity_watermark(pool: &Pool<Sqlite>) -> Option<NaiveDateTime> {
    let raw: Option<String> = sqlx::query_scalar::<_, Option<String>>(
        "SELECT MAX(t) FROM (
            SELECT MAX(created_at) AS t FROM phones
            UNION ALL SELECT MAX(created_at) FROM acquisitions
            UNION ALL SELECT MAX(created_at) FROM sales
            UNION ALL SELECT MAX(date) FROM till_entries
         )",
    )
    .fetch_one(pool)
    .await
    .ok()
    .flatten();
    raw.and_then(|s| NaiveDateTime::parse_from_str(&s, SQLITE_DATETIME_FMT).ok())
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LicenseStatus {
    /// none | invalid | device_mismatch | clock_rollback | expired | valid
    pub state: String,
    pub device_id: String,
    pub plan_label: Option<String>,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub days_left: Option<i64>,
    pub masked_code: Option<String>,
}

fn machine_guid() -> String {
    winreg::RegKey::predef(winreg::enums::HKEY_LOCAL_MACHINE)
        .open_subkey("SOFTWARE\\Microsoft\\Cryptography")
        .and_then(|k| k.get_value::<String, _>("MachineGuid"))
        .unwrap_or_else(|_| "fallback-machine".into())
}

fn device_hash() -> [u8; 6] {
    let mut h = Sha256::new();
    h.update(machine_guid().as_bytes());
    h.update(b"NEVA-MOBILE");
    let d = h.finalize();
    let mut out = [0u8; 6];
    out.copy_from_slice(&d[..6]);
    out
}

pub fn device_id_display() -> String {
    let h = device_hash();
    format!(
        "NVM-{:02X}{:02X}-{:02X}{:02X}-{:02X}{:02X}",
        h[0], h[1], h[2], h[3], h[4], h[5]
    )
}

struct Payload {
    device: [u8; 6],
    plan: u8,
    start_days: u16,
    end_days: u16,
}

fn epoch_date() -> NaiveDate {
    NaiveDate::parse_from_str(EPOCH, "%Y-%m-%d").unwrap()
}

fn decode_and_verify(code: &str) -> Result<Payload, &'static str> {
    println!("=== LICENSE VERIFICATION START ===");
    println!("Input Code: {}", code);
    
    let cleaned: String = code
        .to_uppercase()
        .chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .collect();
    let cleaned = cleaned.strip_prefix("NVM").unwrap_or(&cleaned);
    
    let bytes = match BASE32_NOPAD.decode(cleaned.as_bytes()) {
        Ok(b) => b,
        Err(_) => {
            println!("Failure: Base32 decoding failed.");
            return Err("decode");
        }
    };
    
    if bytes.len() != 12 + 64 {
        println!("Failure: Invalid byte length (expected 76, got {}).", bytes.len());
        return Err("length");
    }
    
    let (payload, sig) = bytes.split_at(12);
    println!("Parsed Raw Payload: {:02X?}", payload);
    
    if payload[0] != 1 {
        println!("Failure: Unsupported payload version (expected 1, got {}).", payload[0]);
        return Err("version");
    }

    let key_bytes: [u8; 32] = match (0..64)
        .step_by(2)
        .filter_map(|i| u8::from_str_radix(&PUBLIC_KEY_HEX[i..i + 2], 16).ok())
        .collect::<Vec<u8>>()
        .try_into() {
            Ok(kb) => kb,
            Err(_) => {
                println!("Failure: Invalid public key hex parsing.");
                return Err("pubkey");
            }
        };
        
    let key = match VerifyingKey::from_bytes(&key_bytes) {
        Ok(k) => k,
        Err(_) => {
            println!("Failure: VerifyingKey initialization failed.");
            return Err("pubkey");
        }
    };
    
    let sig = match Signature::from_slice(sig) {
        Ok(s) => s,
        Err(_) => {
            println!("Failure: Signature parsing failed.");
            return Err("sig");
        }
    };
    
    // Compute public key fingerprint (SHA256 of public key)
    let mut hasher = Sha256::new();
    hasher.update(&key_bytes);
    let pub_fingerprint: String = hasher.finalize().iter().map(|b| format!("{:02x}", b)).collect();
    println!("Verification Public Key: {}", PUBLIC_KEY_HEX);
    println!("Public Key Fingerprint: {}", pub_fingerprint);
    
    let sig_result = key.verify(payload, &sig);
    println!("Signature Verification Result: {:?}", sig_result);
    if sig_result.is_err() {
        println!("Failure: Ed25519 signature verification failed.");
        return Err("sig");
    }

    let mut device = [0u8; 6];
    device.copy_from_slice(&payload[1..7]);
    
    let plan = payload[7];
    let start_days = u16::from_be_bytes([payload[8], payload[9]]);
    let end_days = u16::from_be_bytes([payload[10], payload[11]]);
    
    let parsed_device_id = format!(
        "NVM-{:02X}{:02X}-{:02X}{:02X}-{:02X}{:02X}",
        device[0], device[1], device[2], device[3], device[4], device[5]
    );
    let expected_device_id = device_id_display();
    println!("License Device ID: {}", parsed_device_id);
    println!("Current Device ID: {}", expected_device_id);
    
    let epoch = NaiveDate::parse_from_str(EPOCH, "%Y-%m-%d").unwrap();
    let start_date = epoch + Duration::days(start_days as i64);
    let end_date = if end_days == 0xFFFF {
        "Sınırsız".to_string()
    } else {
        (epoch + Duration::days(end_days as i64)).format("%Y-%m-%d").to_string()
    };
    println!("License Start Date: {}", start_date.format("%Y-%m-%d"));
    println!("Expiration Date: {}", end_date);
    
    if device != device_hash() {
        println!("Failure: Device ID mismatch (License: {}, Current: {}).", parsed_device_id, expected_device_id);
    } else {
        println!("Success: License successfully validated for this machine.");
    }
    
    println!("=== LICENSE VERIFICATION END ===");
    
    Ok(Payload {
        device,
        plan,
        start_days,
        end_days,
    })
}

async fn setting(pool: &Pool<Sqlite>, key: &str) -> Option<String> {
    sqlx::query_scalar::<_, String>("SELECT value FROM settings WHERE key = ?1")
        .bind(key)
        .fetch_optional(pool)
        .await
        .ok()
        .flatten()
}

async fn set_setting(pool: &Pool<Sqlite>, key: &str, value: &str) {
    sqlx::query("INSERT INTO settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = ?2")
        .bind(key)
        .bind(value)
        .execute(pool)
        .await
        .ok();
}

fn mask_code(code: &str) -> String {
    if code.len() <= 12 {
        return "•••".into();
    }
    format!("{}…{}", &code[..8], &code[code.len() - 4..])
}

/// Tam durum değerlendirmesi + saat geri alma koruması (last_seen güncellenir).
pub async fn evaluate(pool: &Pool<Sqlite>) -> LicenseStatus {
    let device_id = device_id_display();
    let none = |state: &str| LicenseStatus {
        state: state.into(),
        device_id: device_id.clone(),
        plan_label: None,
        start_date: None,
        end_date: None,
        days_left: None,
        masked_code: None,
    };

    let Some(code) = setting(pool, "license_code").await else {
        if cfg!(debug_assertions) {
            return LicenseStatus {
                state: "valid".into(),
                device_id: device_id.clone(),
                plan_label: Some("Geliştirici Modu (Debug)".into()),
                start_date: Some("2024-01-01".into()),
                end_date: Some("Sınırsız".into()),
                days_left: None,
                masked_code: Some("DEV-MODE-ACTIVE".into()),
            };
        }
        return none("none");
    };
    let payload = match decode_and_verify(&code) {
        Ok(p) => p,
        Err(_) => {
            if cfg!(debug_assertions) {
                return LicenseStatus {
                    state: "valid".into(),
                    device_id: device_id.clone(),
                    plan_label: Some("Geliştirici Modu (Bypass)".into()),
                    start_date: Some("2024-01-01".into()),
                    end_date: Some("Sınırsız".into()),
                    days_left: None,
                    masked_code: Some(mask_code(&code)),
                };
            }
            return none("invalid");
        }
    };
    if payload.device != device_hash() {
        if cfg!(debug_assertions) {
            return LicenseStatus {
                state: "valid".into(),
                device_id: device_id.clone(),
                plan_label: Some("Geliştirici Modu (Bypass)".into()),
                start_date: Some("2024-01-01".into()),
                end_date: Some("Sınırsız".into()),
                days_left: None,
                masked_code: Some(mask_code(&code)),
            };
        }
        return none("device_mismatch");
    }

    let now = Utc::now().naive_local();

    // Çoklu kaynak saat geri alma koruması: SQLite'taki son görülen an, AppData'daki
    // HMAC imzalı işaretçi ve gerçek iş kayıtlarının en ileri tarihi birlikte kontrol
    // edilir — tek bir kaynağı geri almak/silmek yetmez, tutarsızlık da şüpheli sayılır.
    let sqlite_seen = setting(pool, "license_last_seen")
        .await
        .and_then(|s| NaiveDateTime::parse_from_str(&s, DATE_FMT).ok());
    let appdata_marker_exists = ts_guard_path().exists();
    let appdata_seen = read_ts_guard();
    // Dosya var ama imzası doğrulanamıyorsa (elle düzenlenmiş/başka kurulumdan kopyalanmış).
    let appdata_tampered = appdata_marker_exists && appdata_seen.is_none();

    let most_advanced_seen = [sqlite_seen, appdata_seen].into_iter().flatten().max();
    let business_seen = business_activity_watermark(pool).await;

    let rollback_detected = appdata_tampered
        || most_advanced_seen.is_some_and(|seen| seen - now > Duration::hours(24))
        || business_seen.is_some_and(|seen| seen - now > Duration::hours(24));

    if rollback_detected {
        if cfg!(debug_assertions) {
            // Log rollback but do not block developer in debug mode
        } else {
            return none("clock_rollback");
        }
    }

    // En ileri görülen an asla geriye gitmez; her iki kayıt da bu ana güncellenir.
    let new_seen = most_advanced_seen.map_or(now, |s| s.max(now));
    set_setting(pool, "license_last_seen", &new_seen.format(DATE_FMT).to_string()).await;
    write_ts_guard(&new_seen);

    let start = epoch_date() + Duration::days(payload.start_days as i64);
    let unlimited = payload.end_days == 0xFFFF;
    let end = epoch_date() + Duration::days(payload.end_days as i64);
    let today = now.date();
    let days_left = if unlimited {
        None
    } else {
        Some((end - today).num_days())
    };
    let expired = !unlimited && today > end;

    LicenseStatus {
        state: if expired && !cfg!(debug_assertions) { "expired" } else { "valid" }.into(),
        device_id,
        plan_label: Some(
            PLAN_LABELS
                .get(payload.plan as usize)
                .copied()
                .unwrap_or("Özel")
                .to_string(),
        ),
        start_date: Some(start.format("%Y-%m-%d").to_string()),
        end_date: if unlimited {
            Some("Sınırsız".into())
        } else {
            Some(end.format("%Y-%m-%d").to_string())
        },
        days_left,
        masked_code: Some(mask_code(&code)),
    }
}

/// Yazma komutları için kilit: lisans valid değilse hata döner.
pub async fn ensure_writable(pool: &Pool<Sqlite>) -> Result<(), String> {
    if cfg!(debug_assertions) {
        return Ok(());
    }
    let st = evaluate(pool).await;
    match st.state.as_str() {
        "valid" => Ok(()),
        "expired" => Err("Lisans süresi doldu — salt okunur mod. Yenilemek için Device ID'nizi gönderin.".into()),
        _ => Err("Geçerli lisans bulunamadı.".into()),
    }
}

pub async fn activate(pool: &Pool<Sqlite>, code: &str) -> Result<LicenseStatus, String> {
    let payload = decode_and_verify(code).map_err(|_| "Lisans kodu geçersiz.")?;
    if payload.device != device_hash() {
        return Err(format!(
            "Bu kod başka bir cihaza ait. Bu cihazın Device ID'si: {}",
            device_id_display()
        ));
    }
    let cleaned: String = code.trim().to_uppercase();
    set_setting(pool, "license_code", &cleaned).await;
    let st = evaluate(pool).await;
    if st.state == "expired" {
        return Err("Kod doğru ancak lisans süresi geçmiş görünüyor.".into());
    }
    Ok(st)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_license() {
        let code = "NVM-AFT4U-RYR6J-ZQCA4-WAO2D-4JAT2-TDQM3-YAJJY-IFD2M-DKE2Z-SDNZY-4BZYQ-N5D2K-RMTNX-7OFBB-JAFZX-SZEYY-IMGJ6-T2JBK-TO5US-V5J55-TYFVM-DGJ2F-Q5WEA-55KMZ-BU";
        let res = decode_and_verify(code);
        assert!(res.is_ok(), "License validation failed: {:?}", res.err());
        let payload = res.unwrap();
        assert_eq!(payload.device, device_hash(), "Device ID mismatch");
    }
}
