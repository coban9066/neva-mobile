import Database from "@tauri-apps/plugin-sql";

/** Tek DB bağlantısı; migration'lar Rust tarafında (src-tauri/migrations) koşar. */
let dbPromise: Promise<Database> | null = null;

export function getDb(): Promise<Database> {
  dbPromise ??= Database.load("sqlite:neva.db");
  return dbPromise;
}

export async function select<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const db = await getDb();
  return db.select<T[]>(sql, params);
}

export async function selectOne<T>(sql: string, params: unknown[] = []): Promise<T | null> {
  const rows = await select<T>(sql, params);
  return rows[0] ?? null;
}

export async function execute(
  sql: string,
  params: unknown[] = []
): Promise<{ lastInsertId?: number; rowsAffected: number }> {
  const db = await getDb();
  return db.execute(sql, params);
}

// NOT: Buradan kaldırılan `transaction()` yardımcısı GÜVENLİ DEĞİLDİ.
// tauri-plugin-sql bir bağlantı HAVUZU kullanıyor; ayrı `db.execute()` çağrıları
// (BEGIN / iş / COMMIT / ROLLBACK) farklı bağlantılara düşebiliyordu. Bu yüzden
// hata anında ROLLBACK aktif transaction bulamayıp "cannot rollback - no
// transaction is active" veriyor ve gerçek SQL hatasını maskeliyordu.
// Atomik çok adımlı yazmalar artık Rust komutlarında (tek bağlantılı gerçek
// sqlx transaction) yapılıyor: save_purchase, save_sale, update_phone_quality,
// update_contact_info. Frontend'den çok adımlı ham transaction AÇMAYIN.
