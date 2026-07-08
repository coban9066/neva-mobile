//! Müşteri/Lisans/Cihaz veritabanı — geliştirici bilgisayarında `neva_licenses.db`.
//! Ana uygulamanın çalışma zamanı doğrulamasıyla hiçbir ilgisi yok; yalnızca
//! bu aracın kendi kayıt defteri. Mimari: bir müşterinin gelecekte birden
//! fazla lisansı ve birden fazla cihazı olabilir (customers 1:N devices,
//! customers 1:N licenses); bugünkü arayüz yalnızca tek aktif lisans/cihaz
//! akışını kullanır ama şema baştan buna hazır.

use chrono::Utc;
use rusqlite::{params, Connection};
use std::path::Path;

pub struct Db(pub Connection);

#[derive(Clone)]
pub struct CustomerLicense {
    pub license_id: i64,
    pub customer_id: i64,
    pub customer_code: String,
    pub full_name: String,
    pub phone: String,
    pub device_id: String,
    pub plan_label: String,
    pub plan_byte: i64,
    pub start_date: String,
    pub end_date: Option<String>,
    pub description: String,
    pub code: String,
    pub status: String,
}

pub struct HistoryEvent {
    pub event_type: String,
    pub detail: String,
    pub at: String,
}

const SELECT_FIELDS: &str = "l.id, c.id, c.customer_code, c.full_name, c.phone, d.device_id,
    l.plan_label, l.plan_byte, l.start_date, l.end_date, l.description, l.code, l.status";

fn row_to_customer_license(r: &rusqlite::Row) -> rusqlite::Result<CustomerLicense> {
    Ok(CustomerLicense {
        license_id: r.get(0)?,
        customer_id: r.get(1)?,
        customer_code: r.get(2)?,
        full_name: r.get(3)?,
        phone: r.get(4)?,
        device_id: r.get(5)?,
        plan_label: r.get(6)?,
        plan_byte: r.get(7)?,
        start_date: r.get(8)?,
        end_date: r.get(9)?,
        description: r.get(10)?,
        code: r.get(11)?,
        status: r.get(12)?,
    })
}

impl Db {
    pub fn open(path: &Path) -> rusqlite::Result<Self> {
        let conn = Connection::open(path)?;
        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS customers (
              id INTEGER PRIMARY KEY,
              customer_code TEXT NOT NULL UNIQUE,
              full_name TEXT NOT NULL,
              phone TEXT NOT NULL,
              created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS devices (
              id INTEGER PRIMARY KEY,
              customer_id INTEGER NOT NULL REFERENCES customers(id),
              device_id TEXT NOT NULL,
              active INTEGER NOT NULL DEFAULT 1,
              created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS licenses (
              id INTEGER PRIMARY KEY,
              customer_id INTEGER NOT NULL REFERENCES customers(id),
              device_row_id INTEGER NOT NULL REFERENCES devices(id),
              plan_label TEXT NOT NULL,
              plan_byte INTEGER NOT NULL,
              start_date TEXT NOT NULL,
              end_date TEXT,
              description TEXT NOT NULL DEFAULT '',
              code TEXT NOT NULL,
              status TEXT NOT NULL DEFAULT 'active',
              created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS license_events (
              id INTEGER PRIMARY KEY,
              license_id INTEGER NOT NULL REFERENCES licenses(id),
              event_type TEXT NOT NULL,
              detail TEXT NOT NULL DEFAULT '',
              at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_devices_customer ON devices(customer_id);
            CREATE INDEX IF NOT EXISTS idx_licenses_customer ON licenses(customer_id);
            CREATE INDEX IF NOT EXISTS idx_events_license ON license_events(license_id);
            ",
        )?;
        Ok(Db(conn))
    }

    fn next_customer_code(&self) -> rusqlite::Result<String> {
        let n: i64 = self
            .0
            .query_row("SELECT COALESCE(MAX(id),0)+1 FROM customers", [], |r| r.get(0))?;
        Ok(format!("CUS-{n:06}"))
    }

    #[allow(clippy::too_many_arguments)]
    pub fn create_customer_license(
        &self,
        full_name: &str,
        phone: &str,
        device_id: &str,
        plan_label: &str,
        plan_byte: u8,
        start_date: &str,
        end_date: Option<&str>,
        description: &str,
        code: &str,
    ) -> rusqlite::Result<i64> {
        let now = Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
        let customer_code = self.next_customer_code()?;
        self.0.execute(
            "INSERT INTO customers (customer_code, full_name, phone, created_at) VALUES (?1,?2,?3,?4)",
            params![customer_code, full_name, phone, now],
        )?;
        let customer_id = self.0.last_insert_rowid();

        self.0.execute(
            "INSERT INTO devices (customer_id, device_id, active, created_at) VALUES (?1,?2,1,?3)",
            params![customer_id, device_id, now],
        )?;
        let device_row_id = self.0.last_insert_rowid();

        self.0.execute(
            "INSERT INTO licenses (customer_id, device_row_id, plan_label, plan_byte, start_date, end_date, description, code, status, created_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,'active',?9)",
            params![customer_id, device_row_id, plan_label, plan_byte as i64, start_date, end_date, description, code, now],
        )?;
        let license_id = self.0.last_insert_rowid();
        self.log_event(license_id, "created", "İlk Aktivasyon")?;
        Ok(license_id)
    }

    pub fn log_event(&self, license_id: i64, event_type: &str, detail: &str) -> rusqlite::Result<()> {
        let now = Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
        self.0.execute(
            "INSERT INTO license_events (license_id, event_type, detail, at) VALUES (?1,?2,?3,?4)",
            params![license_id, event_type, detail, now],
        )?;
        Ok(())
    }

    pub fn list(&self, search: &str) -> rusqlite::Result<Vec<CustomerLicense>> {
        let like = format!("%{search}%");
        let mut stmt = self.0.prepare(&format!(
            "SELECT {SELECT_FIELDS}
             FROM licenses l
             JOIN customers c ON c.id = l.customer_id
             JOIN devices d ON d.id = l.device_row_id
             WHERE (?1 = '' OR c.customer_code LIKE ?2 OR c.full_name LIKE ?2 OR c.phone LIKE ?2 OR d.device_id LIKE ?2)
             ORDER BY l.id DESC"
        ))?;
        let rows = stmt.query_map(params![search, like], row_to_customer_license)?;
        rows.collect()
    }

    pub fn get(&self, license_id: i64) -> rusqlite::Result<CustomerLicense> {
        self.0.query_row(
            &format!(
                "SELECT {SELECT_FIELDS} FROM licenses l
                 JOIN customers c ON c.id = l.customer_id
                 JOIN devices d ON d.id = l.device_row_id
                 WHERE l.id = ?1"
            ),
            params![license_id],
            row_to_customer_license,
        )
    }

    pub fn history(&self, license_id: i64) -> rusqlite::Result<Vec<HistoryEvent>> {
        let mut stmt = self.0.prepare(
            "SELECT event_type, detail, at FROM license_events WHERE license_id = ?1 ORDER BY at ASC",
        )?;
        let rows = stmt.query_map(params![license_id], |r| {
            Ok(HistoryEvent {
                event_type: r.get(0)?,
                detail: r.get(1)?,
                at: r.get(2)?,
            })
        })?;
        rows.collect()
    }

    /// Cihaz transferi: eski cihaz pasifleşir, yeni cihaz satırı açılır, lisans ona bağlanır.
    /// Kalan gün/başlangıç/bitiş DEĞİŞMEZ — yalnızca cihaz bağı ve kod değişir.
    pub fn transfer_device(&self, license_id: i64, customer_id: i64, new_device_id: &str, new_code: &str) -> rusqlite::Result<()> {
        let now = Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
        self.0.execute(
            "UPDATE devices SET active = 0 WHERE customer_id = ?1 AND active = 1",
            params![customer_id],
        )?;
        self.0.execute(
            "INSERT INTO devices (customer_id, device_id, active, created_at) VALUES (?1,?2,1,?3)",
            params![customer_id, new_device_id, now],
        )?;
        let device_row_id = self.0.last_insert_rowid();
        self.0.execute(
            "UPDATE licenses SET device_row_id = ?1, code = ?2 WHERE id = ?3",
            params![device_row_id, new_code, license_id],
        )?;
        Ok(())
    }

    pub fn extend(&self, license_id: i64, new_end_date: &str, new_code: &str) -> rusqlite::Result<()> {
        self.0.execute(
            "UPDATE licenses SET end_date = ?1, code = ?2 WHERE id = ?3",
            params![new_end_date, new_code, license_id],
        )?;
        Ok(())
    }

    pub fn reissue(&self, license_id: i64, code: &str) -> rusqlite::Result<()> {
        self.0
            .execute("UPDATE licenses SET code = ?1 WHERE id = ?2", params![code, license_id])?;
        Ok(())
    }
}
