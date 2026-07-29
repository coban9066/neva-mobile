import 'package:sqflite/sqflite.dart';

import '../../core/database/database_helper.dart';

/// Basit key/value ayar deposu (settings tablosu) — masaüstünün Gizlilik Modu
/// gibi localStorage'da kalıcı olan tercihlerini Android'de restart sonrası da
/// korumak için kullanılır.
class SettingsRepository {
  Future<Database> get _db async => DatabaseHelper.instance.database;

  Future<String?> get(String key) async {
    final db = await _db;
    final rows = await db.query('settings', where: 'key = ?', whereArgs: [key], limit: 1);
    if (rows.isEmpty) return null;
    return rows.first['value'] as String?;
  }

  Future<void> set(String key, String value) async {
    final db = await _db;
    await db.insert(
      'settings',
      {'key': key, 'value': value},
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<bool> getBool(String key, {bool fallback = false}) async {
    final v = await get(key);
    if (v == null) return fallback;
    return v == '1' || v == 'true';
  }

  Future<void> setBool(String key, bool value) => set(key, value ? '1' : '0');
}
