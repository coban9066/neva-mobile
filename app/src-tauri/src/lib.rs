mod license;

use serde::Deserialize;
use tauri::State;
use tauri_plugin_sql::{DbInstances, DbPool, Migration, MigrationKind};

const DB_URL: &str = "sqlite:neva.db";

async fn sqlite_pool(
    instances: &State<'_, DbInstances>,
) -> Result<sqlx::Pool<sqlx::Sqlite>, String> {
    let map = instances.0.read().await;
    match map.get(DB_URL) {
        Some(DbPool::Sqlite(pool)) => Ok(pool.clone()),
        _ => Err("Veritabanı yüklü değil".into()),
    }
}

#[tauri::command]
async fn get_license_status(
    instances: State<'_, DbInstances>,
) -> Result<license::LicenseStatus, String> {
    let pool = sqlite_pool(&instances).await?;
    Ok(license::evaluate(&pool).await)
}

#[tauri::command]
async fn activate_license(
    instances: State<'_, DbInstances>,
    code: String,
) -> Result<license::LicenseStatus, String> {
    let pool = sqlite_pool(&instances).await?;
    license::activate(&pool, &code).await
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PurchaseCheck {
    key: String,
    value: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PurchaseArgs {
    imei: String,
    brand_id: i64,
    model: String,
    color: Option<String>,
    storage_gb: Option<i64>,
    cosmetic_grade: String,
    battery_health: Option<i64>,
    region: String,
    notes: Option<String>,
    /// Üretici garantisi bitiş tarihi (YYYY-MM-DD); yoksa None
    warranty_until: Option<String>,
    #[serde(default)]
    checks: Vec<PurchaseCheck>,
    contact_id: Option<i64>,
    contact_name: Option<String>,
    price: i64,
    payment_method: String,
    payment_label: String,
}

/// Alış kaydı: telefon (yeni/yeniden) + alış + cari + kasa tek SQL
/// transaction'ında yazılır. JS tarafında BEGIN/COMMIT güvenilir değil
/// (plugin-sql bağlantı havuzu), bu yüzden atomik akış burada yaşar.
#[tauri::command]
async fn save_purchase(
    instances: State<'_, DbInstances>,
    args: PurchaseArgs,
) -> Result<i64, String> {
    let pool = sqlite_pool(&instances).await?;
    license::ensure_writable(&pool).await?;

    if !matches!(args.cosmetic_grade.as_str(), "A" | "B" | "C" | "D") {
        return Err("Kozmetik kademesi zorunludur (A/B/C/D).".into());
    }
    if let Some(bh) = args.battery_health {
        if !(1..=100).contains(&bh) {
            return Err("Pil sağlığı 1-100 arasında olmalıdır.".into());
        }
    }
    if !matches!(args.region.as_str(), "domestic" | "import") {
        return Err("Menşei seçimi zorunludur (yurt içi / yurt dışı).".into());
    }
    if args
        .checks
        .iter()
        .any(|c| c.key.is_empty() || c.key.len() > 40 || !c.key.bytes().all(|b| b.is_ascii_lowercase() || b == b'_'))
    {
        return Err("Geçersiz kontrol anahtarı.".into());
    }
    if let Some(w) = &args.warranty_until {
        if w.len() != 10 || !w.bytes().enumerate().all(|(i, b)| {
            if i == 4 || i == 7 { b == b'-' } else { b.is_ascii_digit() }
        }) {
            return Err("Geçersiz garanti bitiş tarihi.".into());
        }
    }

    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;

    let existing: Option<(i64, String)> = sqlx::query_as(
        "SELECT id, status FROM phones WHERE (imei1 = ?1 OR imei2 = ?1) AND deleted_at IS NULL",
    )
    .bind(&args.imei)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    let phone_id = match existing {
        Some((id, status)) => {
            if matches!(status.as_str(), "in_stock" | "reserved" | "consigned") {
                return Err("Bu telefon zaten dükkânda görünüyor; yeni alış açılamaz.".into());
            }
            sqlx::query(
                "UPDATE phones SET status='in_stock', ownership='stock',
                 model=?2, color=COALESCE(?3, color), storage_gb=COALESCE(?4, storage_gb),
                 cosmetic_grade=?5, battery_health=COALESCE(?6, battery_health),
                 region=?7, notes=COALESCE(?8, notes),
                 warranty_until=?9,
                 updated_at=datetime('now','localtime') WHERE id=?1",
            )
            .bind(id)
            .bind(&args.model)
            .bind(&args.color)
            .bind(args.storage_gb)
            .bind(&args.cosmetic_grade)
            .bind(args.battery_health)
            .bind(&args.region)
            .bind(&args.notes)
            .bind(&args.warranty_until)
            .execute(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;
            id
        }
        None => sqlx::query(
            "INSERT INTO phones (imei1, brand_id, model, color, storage_gb,
                                 cosmetic_grade, battery_health, region, notes,
                                 warranty_until, status, ownership)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,'in_stock','stock')",
        )
        .bind(&args.imei)
        .bind(args.brand_id)
        .bind(&args.model)
        .bind(&args.color)
        .bind(args.storage_gb)
        .bind(&args.cosmetic_grade)
        .bind(args.battery_health)
        .bind(&args.region)
        .bind(&args.notes)
        .bind(&args.warranty_until)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?
        .last_insert_rowid(),
    };

    let contact_id = match (args.contact_id, args.contact_name.as_deref()) {
        (Some(id), _) => Some(id),
        (None, Some(name)) if name.trim().len() >= 2 => Some(
            sqlx::query("INSERT INTO contacts (type, full_name) VALUES ('supplier', ?1)")
                .bind(name.trim())
                .execute(&mut *tx)
                .await
                .map_err(|e| e.to_string())?
                .last_insert_rowid(),
        ),
        _ => None,
    };

    let acq_id = sqlx::query(
        "INSERT INTO acquisitions (phone_id, contact_id, price, payment_method, source)
         VALUES (?1,?2,?3,?4,'walk_in')",
    )
    .bind(phone_id)
    .bind(contact_id)
    .bind(args.price)
    .bind(&args.payment_method)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?
    .last_insert_rowid();

    sqlx::query("UPDATE phones SET current_acquisition_id=?2 WHERE id=?1")
        .bind(phone_id)
        .bind(acq_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

    // Kalite kontrolleri: yeni tur eski kontrolleri geçersiz kılar; yalnız onaylananlar yazılır.
    sqlx::query("DELETE FROM phone_checks WHERE phone_id=?1")
        .bind(phone_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    for check in args.checks.iter().filter(|c| c.value) {
        sqlx::query("INSERT INTO phone_checks (phone_id, check_key, value) VALUES (?1,?2,1)")
            .bind(phone_id)
            .bind(&check.key)
            .execute(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;
    }

    if let Some(cid) = contact_id {
        sqlx::query(
            "INSERT INTO ledger_entries (contact_id, ref_type, ref_id, debit, credit, note)
             VALUES (?1,'acquisition',?2,0,?3,'Telefon alışı')",
        )
        .bind(cid)
        .bind(acq_id)
        .bind(args.price)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
        sqlx::query(
            "INSERT INTO ledger_entries (contact_id, ref_type, ref_id, debit, credit, note)
             VALUES (?1,'payment',?2,?3,0,'Alış ödemesi (' || ?4 || ')')",
        )
        .bind(cid)
        .bind(acq_id)
        .bind(args.price)
        .bind(&args.payment_label)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    }

    let till_method = if args.payment_method == "mixed" {
        "cash"
    } else {
        args.payment_method.as_str()
    };
    sqlx::query(
        "INSERT INTO till_entries (direction, method, amount, ref_type, ref_id, note)
         VALUES ('out',?1,?2,'acquisition',?3,'Telefon alışı')",
    )
    .bind(till_method)
    .bind(args.price)
    .bind(acq_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(phone_id)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaleArgs {
    phone_id: i64,
    price: i64,
    /// sales CHECK'ine uyan değer (cash/pos/transfer); UI "Kredi Kartı"nı pos'a eşler
    payment_method: String,
    payment_label: String,
    customer_name: Option<String>,
    customer_phone: Option<String>,
    notes: Option<String>,
}

/// Satış: sales + phones.status='sold' + cari + kasa geliri tek transaction.
#[tauri::command]
async fn save_sale(instances: State<'_, DbInstances>, args: SaleArgs) -> Result<i64, String> {
    let pool = sqlite_pool(&instances).await?;
    license::ensure_writable(&pool).await?;

    if args.price <= 0 {
        return Err("Satış fiyatı sıfırdan büyük olmalıdır.".into());
    }
    if !matches!(args.payment_method.as_str(), "cash" | "pos" | "transfer") {
        return Err("Geçersiz ödeme türü.".into());
    }

    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;

    let phone: Option<(String, Option<i64>)> = sqlx::query_as(
        "SELECT status, current_acquisition_id FROM phones WHERE id=?1 AND deleted_at IS NULL",
    )
    .bind(args.phone_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    let (status, acq_id) = phone.ok_or("Telefon bulunamadı.")?;
    if !matches!(status.as_str(), "in_stock" | "reserved") {
        return Err("Bu telefon stokta değil; satılamaz.".into());
    }
    let acq_id = acq_id.ok_or("Telefonun alış kaydı yok.")?;

    let contact_id = match args.customer_name.as_deref() {
        Some(name) if name.trim().len() >= 2 => Some(
            sqlx::query("INSERT INTO contacts (type, full_name, phone_number) VALUES ('customer', ?1, ?2)")
                .bind(name.trim())
                .bind(&args.customer_phone)
                .execute(&mut *tx)
                .await
                .map_err(|e| e.to_string())?
                .last_insert_rowid(),
        ),
        _ => None,
    };

    let sale_id = sqlx::query(
        "INSERT INTO sales (phone_id, acquisition_id, contact_id, price, payment_method, notes)
         VALUES (?1,?2,?3,?4,?5,?6)",
    )
    .bind(args.phone_id)
    .bind(acq_id)
    .bind(contact_id)
    .bind(args.price)
    .bind(&args.payment_method)
    .bind(&args.notes)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?
    .last_insert_rowid();

    sqlx::query("UPDATE phones SET status='sold', updated_at=datetime('now','localtime') WHERE id=?1")
        .bind(args.phone_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

    if let Some(cid) = contact_id {
        sqlx::query(
            "INSERT INTO ledger_entries (contact_id, ref_type, ref_id, debit, credit, note)
             VALUES (?1,'sale',?2,?3,0,'Telefon satışı')",
        )
        .bind(cid)
        .bind(sale_id)
        .bind(args.price)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
        sqlx::query(
            "INSERT INTO ledger_entries (contact_id, ref_type, ref_id, debit, credit, note)
             VALUES (?1,'payment',?2,0,?3,'Satış tahsilatı (' || ?4 || ')')",
        )
        .bind(cid)
        .bind(sale_id)
        .bind(args.price)
        .bind(&args.payment_label)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    }

    sqlx::query(
        "INSERT INTO till_entries (direction, method, amount, ref_type, ref_id, note)
         VALUES ('in',?1,?2,'sale',?3,'Telefon satışı (' || ?4 || ')')",
    )
    .bind(&args.payment_method)
    .bind(args.price)
    .bind(sale_id)
    .bind(&args.payment_label)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(sale_id)
}

/// Satışın tüm izlerini kalıcı siler (kasa, cari, garanti, taksit). Telefon 'sold' kalır.
async fn purge_sale_rows(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    sale_id: i64,
) -> Result<(), String> {
    for sql in [
        "DELETE FROM warranty_returns WHERE warranty_id IN (SELECT id FROM warranties WHERE sale_id=?1)",
        "DELETE FROM warranties WHERE sale_id=?1",
        "DELETE FROM installments WHERE plan_id IN (SELECT id FROM installment_plans WHERE sale_id=?1)",
        "DELETE FROM installment_plans WHERE sale_id=?1",
        "DELETE FROM till_entries WHERE ref_type='sale' AND ref_id=?1",
        "DELETE FROM ledger_entries WHERE ref_type IN ('sale','payment') AND ref_id=?1",
        "DELETE FROM sales WHERE id=?1",
    ] {
        sqlx::query(sql)
            .bind(sale_id)
            .execute(&mut **tx)
            .await
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn delete_sale(instances: State<'_, DbInstances>, sale_id: i64) -> Result<(), String> {
    let pool = sqlite_pool(&instances).await?;
    license::ensure_writable(&pool).await?;
    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;
    purge_sale_rows(&mut tx, sale_id).await?;
    tx.commit().await.map_err(|e| e.to_string())
}

/// Alışın tüm izlerini siler; telefonun başka turu yoksa telefonu da siler.
async fn purge_acquisition_rows(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    acq_id: i64,
) -> Result<(), String> {
    let has_sale: Option<(i64,)> =
        sqlx::query_as("SELECT id FROM sales WHERE acquisition_id=?1 LIMIT 1")
            .bind(acq_id)
            .fetch_optional(&mut **tx)
            .await
            .map_err(|e| e.to_string())?;
    if has_sale.is_some() {
        return Err("Bu alışa bağlı satış var; önce satışı silin.".into());
    }

    let phone_id: Option<(i64,)> =
        sqlx::query_as("SELECT phone_id FROM acquisitions WHERE id=?1")
            .bind(acq_id)
            .fetch_optional(&mut **tx)
            .await
            .map_err(|e| e.to_string())?;
    let phone_id = phone_id.ok_or("Alış kaydı bulunamadı.")?.0;

    for sql in [
        "DELETE FROM expenses WHERE acquisition_id=?1",
        "DELETE FROM part_replacements WHERE acquisition_id=?1",
        "DELETE FROM hardware_tests WHERE acquisition_id=?1",
        "DELETE FROM till_entries WHERE ref_type='acquisition' AND ref_id=?1",
        "DELETE FROM ledger_entries WHERE ref_type IN ('acquisition','payment') AND ref_id=?1",
        "DELETE FROM acquisitions WHERE id=?1",
    ] {
        sqlx::query(sql)
            .bind(acq_id)
            .execute(&mut **tx)
            .await
            .map_err(|e| e.to_string())?;
    }

    let remaining: Option<(i64,)> = sqlx::query_as(
        "SELECT id FROM acquisitions WHERE phone_id=?1 ORDER BY date DESC LIMIT 1",
    )
    .bind(phone_id)
    .fetch_optional(&mut **tx)
    .await
    .map_err(|e| e.to_string())?;

    match remaining {
        Some((prev_acq,)) => {
            sqlx::query(
                "UPDATE phones SET current_acquisition_id=?2, status='sold',
                 updated_at=datetime('now','localtime') WHERE id=?1",
            )
            .bind(phone_id)
            .bind(prev_acq)
            .execute(&mut **tx)
            .await
            .map_err(|e| e.to_string())?;
        }
        None => {
            for sql in [
                "DELETE FROM phone_checks WHERE phone_id=?1",
                "DELETE FROM reservations WHERE phone_id=?1",
                "DELETE FROM attachments WHERE entity='phone' AND entity_id=?1",
                "DELETE FROM phones WHERE id=?1",
            ] {
                sqlx::query(sql)
                    .bind(phone_id)
                    .execute(&mut **tx)
                    .await
                    .map_err(|e| e.to_string())?;
            }
        }
    }
    Ok(())
}

#[tauri::command]
async fn delete_purchase(
    instances: State<'_, DbInstances>,
    acquisition_id: i64,
) -> Result<(), String> {
    let pool = sqlite_pool(&instances).await?;
    license::ensure_writable(&pool).await?;
    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;
    purge_acquisition_rows(&mut tx, acquisition_id).await?;
    tx.commit().await.map_err(|e| e.to_string())
}

/// Toplu temizlik. kind: "sales" | "purchases"; older_than_days None = tümü.
#[tauri::command]
async fn purge_records(
    instances: State<'_, DbInstances>,
    kind: String,
    older_than_days: Option<i64>,
) -> Result<i64, String> {
    let pool = sqlite_pool(&instances).await?;
    license::ensure_writable(&pool).await?;
    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;

    let cutoff = older_than_days.map(|d| format!("-{d} days"));
    let mut deleted = 0i64;

    match kind.as_str() {
        "sales" => {
            let ids: Vec<(i64,)> = match &cutoff {
                Some(c) => sqlx::query_as(
                    "SELECT id FROM sales WHERE date < datetime('now','localtime',?1)",
                )
                .bind(c)
                .fetch_all(&mut *tx)
                .await
                .map_err(|e| e.to_string())?,
                None => sqlx::query_as("SELECT id FROM sales")
                    .fetch_all(&mut *tx)
                    .await
                    .map_err(|e| e.to_string())?,
            };
            for (id,) in ids {
                purge_sale_rows(&mut tx, id).await?;
                deleted += 1;
            }
        }
        "purchases" => {
            // Satışı olan alışlar atlanır (önce satış silinmeli) — yetim kayıt oluşmaz.
            let ids: Vec<(i64,)> = match &cutoff {
                Some(c) => sqlx::query_as(
                    "SELECT a.id FROM acquisitions a
                     WHERE a.date < datetime('now','localtime',?1)
                       AND NOT EXISTS (SELECT 1 FROM sales s WHERE s.acquisition_id = a.id)",
                )
                .bind(c)
                .fetch_all(&mut *tx)
                .await
                .map_err(|e| e.to_string())?,
                None => sqlx::query_as(
                    "SELECT a.id FROM acquisitions a
                     WHERE NOT EXISTS (SELECT 1 FROM sales s WHERE s.acquisition_id = a.id)",
                )
                .fetch_all(&mut *tx)
                .await
                .map_err(|e| e.to_string())?,
            };
            for (id,) in ids {
                purge_acquisition_rows(&mut tx, id).await?;
                deleted += 1;
            }
        }
        _ => return Err("Geçersiz kayıt türü.".into()),
    }

    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(deleted)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "initial_schema",
            sql: include_str!("../migrations/001_initial.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "seed_catalog",
            sql: include_str!("../migrations/002_seed.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "device_profile",
            sql: include_str!("../migrations/003_device_profile.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "manufacturer_warranty",
            sql: include_str!("../migrations/004_manufacturer_warranty.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "performance_indexes",
            sql: include_str!("../migrations/005_performance_indexes.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 6,
            description: "remove_stock_aging",
            sql: include_str!("../migrations/006_remove_stock_aging.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 7,
            description: "remove_ram",
            sql: include_str!("../migrations/007_remove_ram.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 8,
            description: "add_model_text",
            sql: include_str!("../migrations/008_add_model_text.sql"),
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(DB_URL, migrations)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            save_purchase,
            save_sale,
            delete_sale,
            delete_purchase,
            purge_records,
            get_license_status,
            activate_license
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
