import 'package:flutter/services.dart' show rootBundle;
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:sqflite/sqflite.dart';

/// NEVA MOBILE Android veritabanı: masaüstüyle aynı şema, aynı dosya adı
/// (`neva.db`). Migration'lar `assets/migrations/*.sql` dosyalarından sırayla
/// okunup çalıştırılır; uygulanan sürüm `_migrations` tablosunda tutulur
/// (masaüstündeki sqlx `_sqlx_migrations` ile aynı amaç, ayrı isim — iki
/// migrator birbirine karışmasın diye).
class DatabaseHelper {
  DatabaseHelper._();
  static final DatabaseHelper instance = DatabaseHelper._();

  Database? _db;

  /// Sırayla uygulanacak migration dosyaları. Yeni bir masaüstü migration'ı
  /// Android'e de yansıtılacaksa buraya "003_...": "assets/migrations/003_....sql"
  /// şeklinde eklenir — numaralandırma masaüstünden bağımsızdır (Android kendi
  /// migration serisini 001'den başlatır, bkz. 001_initial_schema.sql üstündeki not).
  static const List<_Migration> _migrations = [
    _Migration(1, 'initial_schema', 'assets/migrations/001_initial_schema.sql'),
    _Migration(2, 'seed_catalog', 'assets/migrations/002_seed_catalog.sql'),
  ];

  Future<Database> get database async {
    if (_db != null) return _db!;
    _db = await _open();
    return _db!;
  }

  Future<Database> _open() async {
    final dir = await getApplicationDocumentsDirectory();
    final dbPath = p.join(dir.path, 'neva.db');
    final db = await openDatabase(
      dbPath,
      version: 1,
      onConfigure: (db) async {
        await db.execute('PRAGMA foreign_keys = ON');
      },
    );
    await _runMigrations(db);
    return db;
  }

  Future<void> _runMigrations(Database db) async {
    await db.execute('''
      CREATE TABLE IF NOT EXISTS _migrations (
        version INTEGER PRIMARY KEY,
        description TEXT NOT NULL,
        applied_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
      )
    ''');

    final appliedRows = await db.query('_migrations', columns: ['version']);
    final applied = appliedRows.map((r) => r['version'] as int).toSet();

    for (final m in _migrations) {
      if (applied.contains(m.version)) continue;
      final sql = await rootBundle.loadString(m.assetPath);
      final statements = _splitStatements(sql);
      await db.transaction((txn) async {
        for (final stmt in statements) {
          await txn.execute(stmt);
        }
        await txn.insert('_migrations', {
          'version': m.version,
          'description': m.description,
        });
      });
    }
  }

  /// Tam satır yorumlarını (`-- ...`) temizler, `;` ile ayrılmış deyimlere böler.
  /// Şemamızda dize içi noktalı virgül yok; bu basit bölme her migration için yeterli.
  List<String> _splitStatements(String sql) {
    final withoutComments = sql
        .split('\n')
        .where((line) => !line.trim().startsWith('--'))
        .join('\n');
    return withoutComments
        .split(';')
        .map((s) => s.trim())
        .where((s) => s.isNotEmpty)
        .toList();
  }

  Future<void> close() async {
    await _db?.close();
    _db = null;
  }
}

class _Migration {
  final int version;
  final String description;
  final String assetPath;
  const _Migration(this.version, this.description, this.assetPath);
}
