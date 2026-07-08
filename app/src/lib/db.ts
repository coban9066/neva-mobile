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

/**
 * Atomik çok adımlı yazma. plugin-sql bağlantı havuzu kullandığı için
 * BEGIN/COMMIT'i tek execute çağrılarıyla koşturuyoruz; hata halinde ROLLBACK.
 */
export async function transaction<T>(fn: () => Promise<T>): Promise<T> {
  const db = await getDb();
  await db.execute("BEGIN IMMEDIATE");
  try {
    const result = await fn();
    await db.execute("COMMIT");
    return result;
  } catch (e) {
    await db.execute("ROLLBACK");
    throw e;
  }
}
