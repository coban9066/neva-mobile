mod license;

use serde::Deserialize;
use tauri::State;
use tauri_plugin_sql::{DbInstances, DbPool, Migration, MigrationKind};

const DB_URL: &str = "sqlite:neva.db";

/// Tek doğruluk kaynağı: (version, description, sql). Hem migrator'a verilen
/// migration listesi hem de checksum uzlaştırma (reconcile) mantığı buradan
/// beslenir; iki yerde ayrı ayrı tutulursa aralarında sürüklenme (drift) olur.
const MIGRATIONS_RAW: &[(i64, &str, &str)] = &[
    (1, "initial_schema", include_str!("../migrations/001_initial.sql")),
    (2, "seed_catalog", include_str!("../migrations/002_seed.sql")),
    (3, "device_profile", include_str!("../migrations/003_device_profile.sql")),
    (4, "manufacturer_warranty", include_str!("../migrations/004_manufacturer_warranty.sql")),
    (5, "performance_indexes", include_str!("../migrations/005_performance_indexes.sql")),
    (6, "remove_stock_aging", include_str!("../migrations/006_remove_stock_aging.sql")),
    (7, "remove_ram", include_str!("../migrations/007_remove_ram.sql")),
    (8, "add_model_text", include_str!("../migrations/008_add_model_text.sql")),
    (9, "expense_freeform_category", include_str!("../migrations/009_expense_freeform_category.sql")),
    (10, "cosmetic_grade_relabel", include_str!("../migrations/010_cosmetic_grade_relabel.sql")),
    (11, "contact_phone", include_str!("../migrations/011_contact_phone.sql")),
    (12, "hotfix", include_str!("../migrations/012_hotfix.sql")),
    (13, "pos_commission", include_str!("../migrations/013_pos_commission.sql")),
    (14, "etiket_numarasi", include_str!("../migrations/014_etiket_numarasi.sql")),
    (15, "partial_payment", include_str!("../migrations/015_partial_payment.sql")),
    (16, "imei_optional", include_str!("../migrations/016_imei_optional.sql")),
];

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
    /// Opsiyonel — bazı telefoncular cihazı aldıktan sonra IMEI girmeyi tercih eder.
    imei: Option<String>,
    brand_id: i64,
    model: String,
    color: Option<String>,
    storage_gb: Option<i64>,
    cosmetic_grade: String,
    battery_health: Option<i64>,
    region: String,
    notes: Option<String>,
    /// Fiziksel etiket/raf numarası (ör. "A-154") — opsiyonel, benzersiz olmalı
    etiket_numarasi: Option<String>,
    /// Üretici garantisi bitiş tarihi (YYYY-MM-DD); yoksa None
    warranty_until: Option<String>,
    #[serde(default)]
    checks: Vec<PurchaseCheck>,
    contact_id: Option<i64>,
    contact_name: Option<String>,
    /// Kimden alındı — telefon numarası (opsiyonel, normalize: 05321234567)
    contact_phone: Option<String>,
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

    if !matches!(
        args.cosmetic_grade.as_str(),
        "Sıfır" | "Sıfır Gibi" | "İyi" | "Normal" | "Temiz Kullanılmış"
    ) {
        return Err("Kozmetik kademesi zorunludur.".into());
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
    let etiket_numarasi = args
        .etiket_numarasi
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty());
    let imei = args.imei.as_deref().map(str::trim).filter(|s| !s.is_empty());

    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;

    // IMEI verilmediyse eşleşecek bir "mevcut telefon" yoktur — her zaman yeni kayıt açılır.
    let existing: Option<(i64, String)> = match imei {
        Some(imei) => sqlx::query_as(
            "SELECT id, status FROM phones WHERE (imei1 = ?1 OR imei2 = ?1) AND deleted_at IS NULL",
        )
        .bind(imei)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| e.to_string())?,
        None => None,
    };

    if let Some(tag) = etiket_numarasi {
        let clash: Option<(i64,)> = sqlx::query_as(
            "SELECT id FROM phones WHERE etiket_numarasi = ?1 COLLATE NOCASE
             AND id IS NOT ?2",
        )
        .bind(tag)
        .bind(existing.as_ref().map(|(id, _)| *id))
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
        if clash.is_some() {
            return Err(format!("Etiket numarası \"{tag}\" başka bir telefonda kullanılıyor."));
        }
    }

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
                 warranty_until=?9, etiket_numarasi=?10,
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
            .bind(etiket_numarasi)
            .execute(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;
            id
        }
        None => sqlx::query(
            "INSERT INTO phones (imei1, brand_id, model, color, storage_gb,
                                 cosmetic_grade, battery_health, region, notes,
                                 warranty_until, etiket_numarasi, status, ownership)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,'in_stock','stock')",
        )
        .bind(imei)
        .bind(args.brand_id)
        .bind(&args.model)
        .bind(&args.color)
        .bind(args.storage_gb)
        .bind(&args.cosmetic_grade)
        .bind(args.battery_health)
        .bind(&args.region)
        .bind(&args.notes)
        .bind(&args.warranty_until)
        .bind(etiket_numarasi)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?
        .last_insert_rowid(),
    };

    let contact_name = args
        .contact_name
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty());
    let contact_phone = args
        .contact_phone
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty());

    // contacts kaydı yalnızca cari/ledger bağı için (yeni kişi girildiyse). Kişiler
    // sekmesinin gösterdiği ad/telefonun asıl kaynağı alış satırının kendi sütunlarıdır.
    let contact_id = match (args.contact_id, contact_name) {
        (Some(id), _) => Some(id),
        (None, Some(name)) if name.len() >= 2 => Some(
            sqlx::query("INSERT INTO contacts (type, full_name, phone_number) VALUES ('supplier', ?1, ?2)")
                .bind(name)
                .bind(contact_phone)
                .execute(&mut *tx)
                .await
                .map_err(|e| e.to_string())?
                .last_insert_rowid(),
        ),
        _ => None,
    };

    let acq_id = sqlx::query(
        "INSERT INTO acquisitions (phone_id, contact_id, contact_name, contact_phone, price, payment_method, source)
         VALUES (?1,?2,?3,?4,?5,?6,'walk_in')",
    )
    .bind(phone_id)
    .bind(contact_id)
    .bind(contact_name)
    .bind(contact_phone)
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
    /// Şu an alınan tutar (kuruş). price'tan az olabilir — kalan alacak
    /// "Bekleyen Ödemeler"e düşer. price'a eşitse satış tam ödenmiş sayılır.
    amount_paid: i64,
    /// sales CHECK'ine uyan değer (cash/pos/transfer); UI "Kredi Kartı"nı pos'a eşler
    payment_method: String,
    payment_label: String,
    customer_name: Option<String>,
    customer_phone: Option<String>,
    notes: Option<String>,
    /// Yalnızca payment_method='pos' iken anlamlı: "percent" | "fixed"
    commission_type: Option<String>,
    /// percent: yüzde*100 (%2.39 -> 239); fixed: kuruş
    commission_value: Option<i64>,
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
    if args.amount_paid <= 0 || args.amount_paid > args.price {
        return Err("Alınan ödeme sıfırdan büyük ve satış tutarını aşmamalıdır.".into());
    }
    // POS terminali her zaman tam tutarı işler; kısmi ödeme yalnızca nakit/havalede mümkündür.
    if args.payment_method == "pos" && args.amount_paid != args.price {
        return Err("POS ödemesinde tutar satış fiyatına eşit olmalıdır.".into());
    }

    // Komisyon yalnızca POS'ta ve sunucu tarafında yeniden hesaplanır; istemci
    // tutarı doğrudan güvenilmez (fiyat/komisyon tutarlılığı burada garanti edilir).
    let (commission_type, commission_value, commission_amount): (Option<String>, Option<i64>, i64) =
        if args.payment_method == "pos" {
            match (args.commission_type.as_deref(), args.commission_value) {
                (Some("percent"), Some(v)) if (0..=10000).contains(&v) => (
                    Some("percent".into()),
                    Some(v),
                    (args.price as i128 * v as i128 / 10000) as i64,
                ),
                (Some("fixed"), Some(v)) if v >= 0 && v <= args.price => {
                    (Some("fixed".into()), Some(v), v)
                }
                (None, None) => (None, None, 0),
                _ => return Err("Geçersiz banka komisyonu.".into()),
            }
        } else {
            (None, None, 0)
        };

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

    let customer_name = args
        .customer_name
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty());
    let customer_phone = args
        .customer_phone
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty());

    let contact_id = match customer_name {
        Some(name) if name.len() >= 2 => Some(
            sqlx::query("INSERT INTO contacts (type, full_name, phone_number) VALUES ('customer', ?1, ?2)")
                .bind(name)
                .bind(customer_phone)
                .execute(&mut *tx)
                .await
                .map_err(|e| e.to_string())?
                .last_insert_rowid(),
        ),
        _ => None,
    };

    let sale_id = sqlx::query(
        "INSERT INTO sales (phone_id, acquisition_id, contact_id, contact_name, contact_phone, price, amount_paid, payment_method, notes, commission_type, commission_value, commission_amount)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)",
    )
    .bind(args.phone_id)
    .bind(acq_id)
    .bind(contact_id)
    .bind(customer_name)
    .bind(customer_phone)
    .bind(args.price)
    .bind(args.amount_paid)
    .bind(&args.payment_method)
    .bind(&args.notes)
    .bind(&commission_type)
    .bind(commission_value)
    .bind(commission_amount)
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
        .bind(args.amount_paid)
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
    .bind(args.amount_paid - commission_amount)
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

/// Bekleyen Ödemeler ekranından kısmi tahsilat alır: sales.amount_paid'i artırır,
/// kasaya nakit girişi ve (varsa) cari tahsilat kaydı işler. Kalan alacak
/// price - amount_paid ile türetildiğinden ayrı bir "tamamlandı" bayrağı gerekmez —
/// amount_paid price'a ulaştığı an kayıt Bekleyen Ödemeler sorgusundan kendiliğinden düşer.
#[tauri::command]
async fn record_payment(
    instances: State<'_, DbInstances>,
    sale_id: i64,
    amount: i64,
) -> Result<(), String> {
    let pool = sqlite_pool(&instances).await?;
    license::ensure_writable(&pool).await?;

    if amount <= 0 {
        return Err("Ödeme tutarı sıfırdan büyük olmalıdır.".into());
    }

    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;

    let row: Option<(i64, i64, Option<i64>)> = sqlx::query_as(
        "SELECT price, amount_paid, contact_id FROM sales WHERE id=?1 AND deleted_at IS NULL",
    )
    .bind(sale_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    let (price, amount_paid, contact_id) = row.ok_or("Satış bulunamadı.")?;
    let remaining = price - amount_paid;
    if remaining <= 0 {
        return Err("Bu satışın bekleyen bir alacağı yok.".into());
    }
    if amount > remaining {
        return Err("Ödeme tutarı kalan alacaktan fazla olamaz.".into());
    }

    sqlx::query(
        "UPDATE sales SET amount_paid = amount_paid + ?2 WHERE id=?1",
    )
    .bind(sale_id)
    .bind(amount)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query(
        "INSERT INTO till_entries (direction, method, amount, ref_type, ref_id, note)
         VALUES ('in','cash',?1,'sale',?2,'Bekleyen tahsilat')",
    )
    .bind(amount)
    .bind(sale_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    if let Some(cid) = contact_id {
        sqlx::query(
            "INSERT INTO ledger_entries (contact_id, ref_type, ref_id, debit, credit, note)
             VALUES (?1,'payment',?2,0,?3,'Bekleyen tahsilat')",
        )
        .bind(cid)
        .bind(sale_id)
        .bind(amount)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    }

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

/// Uygulama veri klasörü (%APPDATA%\com.nevamobile.erp) — plugin-sql ve lisans
/// koruması da aynı konumu kullanır.
fn app_data_dir() -> std::path::PathBuf {
    let base = std::env::var("APPDATA").unwrap_or_else(|_| ".".into());
    std::path::PathBuf::from(base).join("com.nevamobile.erp")
}

/// Açılışta bekleyen geri yükleme varsa uygular. DB bağlantısı henüz açılmadığı
/// için dosya değişimi güvenlidir. Eski WAL/SHM dosyaları da temizlenir; aksi
/// halde eski günlük yeni veritabanını bozar.
fn apply_pending_restore() {
    let dir = app_data_dir();
    let pending = dir.join("neva.db.restore-pending");
    if !pending.exists() {
        return;
    }
    let db = dir.join("neva.db");
    let _ = std::fs::remove_file(dir.join("neva.db-wal"));
    let _ = std::fs::remove_file(dir.join("neva.db-shm"));
    // Mevcut veritabanının son bir kopyası tutulur (yanlış yedek yüklendiyse kurtarma şansı).
    if db.exists() {
        let _ = std::fs::copy(&db, dir.join("neva.db.pre-restore"));
    }
    if std::fs::rename(&pending, &db).is_err() {
        if std::fs::copy(&pending, &db).is_ok() {
            let _ = std::fs::remove_file(&pending);
        }
    }
}

/// Seçilen .nevabackup dosyasını doğrular ve bir sonraki açılışta devreye girmek
/// üzere sıraya koyar. Bozuk/alakasız dosyalar burada reddedilir — mevcut
/// veritabanına restart öncesi dokunulmaz.
#[tauri::command]
async fn restore_database(source_path: String) -> Result<(), String> {
    let src = std::path::PathBuf::from(&source_path);
    let meta = std::fs::metadata(&src).map_err(|_| "Yedek dosyası okunamadı.")?;
    if meta.len() < 1024 {
        return Err("Bu dosya geçerli bir NEVA yedeği değil (boş veya eksik).".into());
    }
    // SQLite dosya imzası kontrolü
    let mut header = [0u8; 16];
    {
        use std::io::Read;
        let mut f = std::fs::File::open(&src).map_err(|e| format!("Dosya açılamadı: {e}"))?;
        f.read_exact(&mut header).map_err(|_| "Dosya okunamadı.")?;
    }
    if &header != b"SQLite format 3\0" {
        return Err("Bu dosya geçerli bir NEVA yedeği değil (SQLite formatında değil).".into());
    }

    // İçerik doğrulaması: bütünlük + beklenen tablolar (salt okunur bağlantı).
    let opts = sqlx::sqlite::SqliteConnectOptions::new()
        .filename(&src)
        .read_only(true);
    let pool = sqlx::sqlite::SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(opts)
        .await
        .map_err(|_| "Yedek dosyası açılamadı — bozuk olabilir.")?;
    let integrity: String = sqlx::query_scalar("PRAGMA integrity_check")
        .fetch_one(&pool)
        .await
        .map_err(|_| "Yedek bütünlük kontrolünden geçemedi.")?;
    if integrity != "ok" {
        pool.close().await;
        return Err("Yedek dosyası hasarlı (bütünlük kontrolü başarısız).".into());
    }
    let expected: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name IN ('settings','phones','sales')",
    )
    .fetch_one(&pool)
    .await
    .map_err(|_| "Yedek içeriği okunamadı.")?;
    pool.close().await;
    if expected < 3 {
        return Err("Bu dosya bir NEVA MOBILE yedeği değil (beklenen tablolar yok).".into());
    }

    let dir = app_data_dir();
    std::fs::create_dir_all(&dir).map_err(|e| format!("Veri klasörü oluşturulamadı: {e}"))?;
    std::fs::copy(&src, dir.join("neva.db.restore-pending"))
        .map_err(|e| format!("Yedek kopyalanamadı: {e}"))?;
    Ok(())
}

/// Veritabanını kullanıcının seçtiği konuma tek dosya (.nevabackup) olarak dışarı
/// aktarır. Bilinçli olarak lisans kontrolü YOKTUR: deneme süresi dolan kullanıcı
/// da verisini her zaman yedekleyebilmelidir (veri rehin tutulmaz).
/// VACUUM INTO atomiktir; açık bağlantı havuzuyla güvenle çalışır ve WAL'daki
/// commit edilmiş veriyi de içerir.
#[tauri::command]
async fn backup_database(
    instances: State<'_, DbInstances>,
    target_path: String,
) -> Result<(), String> {
    let pool = sqlite_pool(&instances).await?;

    let path = std::path::PathBuf::from(&target_path);
    if path.file_name().is_none() || path.parent().is_none() {
        return Err("Geçersiz yedek dosyası konumu.".into());
    }
    // VACUUM INTO hedef dosya varsa hata verir; kullanıcı kayıt diyaloğunda
    // üzerine yazmayı zaten onayladığı için mevcut dosya kaldırılır.
    if path.exists() {
        std::fs::remove_file(&path)
            .map_err(|e| format!("Mevcut dosyanın üzerine yazılamadı: {e}"))?;
    }

    sqlx::query("VACUUM INTO ?1")
        .bind(path.to_string_lossy().to_string())
        .execute(&pool)
        .await
        .map_err(|e| format!("Yedek oluşturulamadı: {e}"))?;

    // Yedek gerçekten oluştu mu ve boş değil mi?
    match std::fs::metadata(&path) {
        Ok(m) if m.len() > 0 => Ok(()),
        _ => Err("Yedek dosyası doğrulanamadı.".into()),
    }
}

/// Rastgele ikili içeriği (PDF satış fişi gibi) kullanıcının seçtiği konuma yazar.
/// WebView2'de tarayıcı indirme API'si (Blob/`<a download>`) güvenilir çalışmadığından
/// PDF üretimi JS'de yapılıp bayt dizisi buraya taşınır, gerçek dosya yazımı Rust'ta olur.
#[tauri::command]
async fn write_binary_file(target_path: String, bytes: Vec<u8>) -> Result<(), String> {
    let path = std::path::PathBuf::from(&target_path);
    if path.file_name().is_none() || path.parent().is_none() {
        return Err("Geçersiz dosya konumu.".into());
    }
    std::fs::write(&path, &bytes).map_err(|e| format!("Dosya yazılamadı: {e}"))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PhoneQualityArgs {
    phone_id: i64,
    cosmetic_grade: String,
    battery_health: Option<i64>,
    region: String,
    #[serde(default)]
    checks: Vec<String>,
}

/// Telefon kalitesi güncelleme (kozmetik + pil + menşei + kontroller).
///
/// Bu, eskiden frontend'deki `transaction()` yardımcısıyla yapılıyordu; ancak
/// tauri-plugin-sql bir BAĞLANTI HAVUZU kullandığından `BEGIN`/`COMMIT`/`ROLLBACK`
/// her biri farklı bağlantıya düşebiliyor ve hata anında ROLLBACK aktif transaction
/// bulamayıp "cannot rollback - no transaction is active" veriyor, gerçek SQL
/// hatasını da maskeliyordu. Çözüm: atomik yazma tek bağlantılı gerçek bir sqlx
/// transaction'ında burada yapılır (save_purchase/save_sale ile aynı desen).
#[tauri::command]
async fn update_phone_quality(
    instances: State<'_, DbInstances>,
    args: PhoneQualityArgs,
) -> Result<(), String> {
    let pool = sqlite_pool(&instances).await?;
    license::ensure_writable(&pool).await?;

    if !matches!(
        args.cosmetic_grade.as_str(),
        "Sıfır" | "Sıfır Gibi" | "İyi" | "Normal" | "Temiz Kullanılmış"
    ) {
        return Err("Kozmetik kademesi zorunludur.".into());
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
        .any(|k| k.is_empty() || k.len() > 40 || !k.bytes().all(|b| b.is_ascii_lowercase() || b == b'_'))
    {
        return Err("Geçersiz kontrol anahtarı.".into());
    }

    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;

    sqlx::query(
        "UPDATE phones SET cosmetic_grade=?2, battery_health=?3, region=?4,
         updated_at=datetime('now','localtime') WHERE id=?1",
    )
    .bind(args.phone_id)
    .bind(&args.cosmetic_grade)
    .bind(args.battery_health)
    .bind(&args.region)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query("DELETE FROM phone_checks WHERE phone_id=?1")
        .bind(args.phone_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

    for key in &args.checks {
        sqlx::query("INSERT INTO phone_checks (phone_id, check_key, value) VALUES (?1,?2,1)")
            .bind(args.phone_id)
            .bind(key)
            .execute(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;
    }

    tx.commit().await.map_err(|e| e.to_string())
}

/// Telefon detayından etiket numarasını sonradan düzenler/siler (None → temizler).
/// Benzersizlik server tarafında yeniden doğrulanır (istemci tutarı güvenilmez).
#[tauri::command]
async fn update_phone_tag(
    instances: State<'_, DbInstances>,
    phone_id: i64,
    etiket_numarasi: Option<String>,
) -> Result<(), String> {
    let pool = sqlite_pool(&instances).await?;
    license::ensure_writable(&pool).await?;

    let tag = etiket_numarasi
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty());

    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;

    if let Some(tag) = tag {
        let clash: Option<(i64,)> = sqlx::query_as(
            "SELECT id FROM phones WHERE etiket_numarasi = ?1 COLLATE NOCASE AND id IS NOT ?2",
        )
        .bind(tag)
        .bind(phone_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
        if clash.is_some() {
            return Err(format!("Etiket numarası \"{tag}\" başka bir telefonda kullanılıyor."));
        }
    }

    sqlx::query(
        "UPDATE phones SET etiket_numarasi=?2, updated_at=datetime('now','localtime') WHERE id=?1",
    )
    .bind(phone_id)
    .bind(tag)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    tx.commit().await.map_err(|e| e.to_string())
}

/// Telefon detayından IMEI sonradan eklenir/değiştirilir/silinir (None → temizler).
/// Alışta IMEI zorunlu değildir; benzersizlik yalnızca doluysa kontrol edilir.
#[tauri::command]
async fn update_phone_imei(
    instances: State<'_, DbInstances>,
    phone_id: i64,
    imei1: Option<String>,
) -> Result<(), String> {
    let pool = sqlite_pool(&instances).await?;
    license::ensure_writable(&pool).await?;

    let imei = imei1.as_deref().map(str::trim).filter(|s| !s.is_empty());

    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;

    if let Some(imei) = imei {
        let clash: Option<(i64,)> = sqlx::query_as(
            "SELECT id FROM phones WHERE (imei1 = ?1 OR imei2 = ?1) AND id IS NOT ?2 AND deleted_at IS NULL",
        )
        .bind(imei)
        .bind(phone_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
        if clash.is_some() {
            return Err(format!("IMEI \"{imei}\" başka bir telefonda kayıtlı."));
        }
    }

    sqlx::query("UPDATE phones SET imei1=?2, updated_at=datetime('now','localtime') WHERE id=?1")
        .bind(phone_id)
        .bind(imei)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

    tx.commit().await.map_err(|e| e.to_string())
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContactInfoArgs {
    /// "acquisition" | "sale"
    kind: String,
    id: i64,
    name: Option<String>,
    phone: Option<String>,
}

/// Kişiler sekmesinden ad/telefon düzenleme. Bilgi doğrudan ilgili alış veya
/// satış satırında güncellenir (ayrı CRM tablosu yoktur). İlişkili contacts
/// kaydı varsa cari/arama tutarlılığı için o da güncellenir.
#[tauri::command]
async fn update_contact_info(
    instances: State<'_, DbInstances>,
    args: ContactInfoArgs,
) -> Result<(), String> {
    let pool = sqlite_pool(&instances).await?;
    license::ensure_writable(&pool).await?;

    let table = match args.kind.as_str() {
        "acquisition" => "acquisitions",
        "sale" => "sales",
        _ => return Err("Geçersiz kayıt türü.".into()),
    };
    let name = args.name.as_deref().map(str::trim).filter(|s| !s.is_empty());
    let phone = args.phone.as_deref().map(str::trim).filter(|s| !s.is_empty());

    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;

    sqlx::query(&format!(
        "UPDATE {table} SET contact_name=?2, contact_phone=?3 WHERE id=?1"
    ))
    .bind(args.id)
    .bind(name)
    .bind(phone)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    // Bağlı contacts kaydını da güncelle (varsa) — cari/arama ekranlarıyla tutarlılık.
    sqlx::query(&format!(
        "UPDATE contacts SET full_name=COALESCE(?2, full_name), phone_number=?3, updated_at=datetime('now','localtime')
         WHERE id=(SELECT contact_id FROM {table} WHERE id=?1)"
    ))
    .bind(args.id)
    .bind(name)
    .bind(phone)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    tx.commit().await.map_err(|e| e.to_string())
}

/// KÖK NEDEN (v0.1.5 hotfix): sqlx migrator, her migration'ın checksum'unu
/// `sql.as_bytes()` üzerinden SHA-384 ile hesaplar. Bu depodaki .sql dosyaları
/// Windows'ta `core.autocrlf=true` ile checkout edildiği için, hangi makinede /
/// hangi git ayarıyla derlendiğine bağlı olarak `include_str!` bazen LF bazen
/// CRLF baytları gömüyordu. Sonuç: v0.1.4 ile gerçek kullanıcıların veritabanına
/// yazılan migration 11 checksum'u, sonraki bir derlemenin (ör. bu hotfix) hesapladığı
/// checksum'la eşleşmeyip "was previously applied but has been modified" hatasıyla
/// açılışı tamamen engelliyordu.
///
/// Kalıcı çözüm: `.gitattributes` artık tüm `*.sql` dosyalarını LF'e sabitliyor,
/// böylece bundan sonraki her derleme (Windows 10/11 ve Windows 7 Legacy dahil)
/// aynı baytları gömecek. Bu fonksiyon yalnızca ZATEN KURULU kullanıcılar için
/// geçmişte oluşmuş olası LF/CRLF sürüklenmesini bir kereliğine uzlaştırır:
/// veritabanındaki checksum, migration metninin YALNIZCA satır sonu farklı iki
/// varyantından (LF veya CRLF) biriyle birebir eşleşiyorsa günceller. Eşleşmiyorsa
/// dokunmaz — gerçek bir içerik/bozulma sorunu olabilir, sqlx migrator kendi
/// hatasını versin; hata asla sessizce maskelenmez.
fn reconcile_migration_checksums() {
    let dir = app_data_dir();
    let db_path = dir.join("neva.db");
    if !db_path.exists() {
        return;
    }

    let rt = match tokio::runtime::Builder::new_current_thread().enable_all().build() {
        Ok(rt) => rt,
        Err(_) => return,
    };

    rt.block_on(async {
        use sha2::{Digest, Sha384};
        use sqlx::Connection;

        let opts = sqlx::sqlite::SqliteConnectOptions::new()
            .filename(&db_path)
            .read_only(false);
        let Ok(mut conn) = sqlx::SqliteConnection::connect_with(&opts).await else {
            return;
        };

        let table_exists: Option<(i64,)> = sqlx::query_as(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name='_sqlx_migrations'",
        )
        .fetch_optional(&mut conn)
        .await
        .unwrap_or(None);
        if table_exists.is_none() {
            return;
        }

        for (version, _description, sql) in MIGRATIONS_RAW {
            let stored: Option<(Vec<u8>,)> =
                sqlx::query_as("SELECT checksum FROM _sqlx_migrations WHERE version = ?")
                    .bind(version)
                    .fetch_optional(&mut conn)
                    .await
                    .unwrap_or(None);
            let Some((stored,)) = stored else {
                continue;
            };

            let current = Sha384::digest(sql.as_bytes()).to_vec();
            if stored == current {
                continue;
            }

            let lf = sql.replace("\r\n", "\n");
            let crlf = lf.replace('\n', "\r\n");
            let lf_checksum = Sha384::digest(lf.as_bytes()).to_vec();
            let crlf_checksum = Sha384::digest(crlf.as_bytes()).to_vec();

            if stored == lf_checksum || stored == crlf_checksum {
                let _ = sqlx::query("UPDATE _sqlx_migrations SET checksum = ? WHERE version = ?")
                    .bind(&current)
                    .bind(version)
                    .execute(&mut conn)
                    .await;
            }
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Bekleyen geri yükleme, DB'ye ilk bağlantıdan ÖNCE uygulanmalı.
    apply_pending_restore();

    // Checksum uyumsuzluklarını düzelt (bkz. reconcile_migration_checksums dokümantasyonu).
    reconcile_migration_checksums();

    let migrations: Vec<Migration> = MIGRATIONS_RAW
        .iter()
        .map(|&(version, description, sql)| Migration {
            version,
            description,
            sql,
            kind: MigrationKind::Up,
        })
        .collect();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(DB_URL, migrations)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            save_purchase,
            save_sale,
            record_payment,
            delete_sale,
            delete_purchase,
            purge_records,
            get_license_status,
            activate_license,
            backup_database,
            restore_database,
            update_phone_quality,
            update_phone_tag,
            update_phone_imei,
            update_contact_info,
            write_binary_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
