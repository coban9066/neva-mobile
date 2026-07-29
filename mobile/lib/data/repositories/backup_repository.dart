import 'dart:io';
import 'dart:typed_data';

import 'package:sqflite/sqflite.dart';

import '../../core/database/database_helper.dart';

class RestoreValidationError extends StateError {
  RestoreValidationError(super.message);
}

/// Masaüstü backup_database/restore_database/purge_records (lib.rs) ile aynı
/// iş kuralları — sqflite'ta VACUUM INTO olmadığından WAL checkpoint + dosya
/// kopyası ile eşdeğer atomik yedek alınır.
class BackupRepository {
  Future<Database> get _db async => DatabaseHelper.instance.database;

  /// Canlı DB'yi WAL'ı ana dosyaya işleyip byte olarak döndürür — çağıran
  /// taraf (file_picker saveFile) kullanıcının seçtiği konuma yazar.
  Future<Uint8List> exportBackupBytes() async {
    final db = await _db;
    await db.rawQuery('PRAGMA wal_checkpoint(TRUNCATE)');
    final path = await DatabaseHelper.instance.dbPath;
    final bytes = await File(path).readAsBytes();
    if (bytes.isEmpty) {
      throw StateError('Yedek dosyası doğrulanamadı.');
    }
    return bytes;
  }

  static final _sqliteMagic = [
    0x53, 0x51, 0x4c, 0x69, 0x74, 0x65, 0x20, 0x66, // "SQLite f"
    0x6f, 0x72, 0x6d, 0x61, 0x74, 0x20, 0x33, 0x00, // "ormat 3\0"
  ];

  /// [candidatePath] geçici olarak seçilen dosyanın konumu. Doğrulama başarısız
  /// olursa [RestoreValidationError] fırlatır; başarılıysa canlı DB'nin yerine
  /// geçirir (önceki hâli `.pre-restore` olarak saklanır) ve bağlantıyı yeniden açar.
  Future<void> restoreFromFile(String candidatePath) async {
    final candidate = File(candidatePath);
    final size = await candidate.length();
    if (size < 1024) {
      throw RestoreValidationError('Seçilen dosya geçerli bir yedek değil (çok küçük).');
    }
    final header = <int>[];
    await for (final chunk in candidate.openRead(0, 16)) {
      header.addAll(chunk);
    }
    if (header.length < 16 || !_bytesEqual(header, _sqliteMagic)) {
      throw RestoreValidationError('Seçilen dosya bir SQLite veritabanı değil.');
    }

    // Aday dosyayı salt-okunur ayrı bir bağlantıyla aç, bütünlük ve beklenen
    // tabloların varlığını doğrula — canlı DB'ye hiç dokunmadan.
    final checkDb = await openReadOnlyDatabase(candidatePath);
    try {
      final integrity = await checkDb.rawQuery('PRAGMA integrity_check');
      final result = integrity.isNotEmpty ? integrity.first.values.first : null;
      if (result != 'ok') {
        throw RestoreValidationError('Yedek dosyası bozuk (integrity_check başarısız).');
      }
      final tableCount = Sqflite.firstIntValue(await checkDb.rawQuery('''
        SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name IN ('settings','phones','sales')
      '''));
      if ((tableCount ?? 0) < 3) {
        throw RestoreValidationError('Bu bir NEVA MOBILE yedeği değil.');
      }
    } finally {
      await checkDb.close();
    }

    final livePath = await DatabaseHelper.instance.dbPath;
    await DatabaseHelper.instance.close();

    final liveFile = File(livePath);
    if (await liveFile.exists()) {
      await liveFile.copy('$livePath.pre-restore');
    }
    for (final suffix in ['-wal', '-shm']) {
      final f = File('$livePath$suffix');
      if (await f.exists()) await f.delete();
    }
    await candidate.copy(livePath);

    // sonraki DatabaseHelper.instance.database çağrısı yeni dosyayı açar.
  }

  bool _bytesEqual(List<int> a, List<int> b) {
    if (a.length < b.length) return false;
    for (var i = 0; i < b.length; i++) {
      if (a[i] != b[i]) return false;
    }
    return true;
  }

  /// kind: 'sales' | 'purchases'. olderThanDays null ise tümü.
  Future<int> purgeRecords({required String kind, int? olderThanDays}) async {
    final db = await _db;
    if (kind == 'sales') {
      return db.transaction<int>((txn) async {
        final ids = olderThanDays == null
            ? await txn.query('sales', columns: ['id'])
            : await txn.rawQuery(
                "SELECT id FROM sales WHERE date < datetime('now','localtime','-$olderThanDays days')");
        for (final row in ids) {
          final id = row['id'] as int;
          await txn.delete('warranty_returns',
              where: 'warranty_id IN (SELECT id FROM warranties WHERE sale_id=?)', whereArgs: [id]);
          await txn.delete('warranties', where: 'sale_id=?', whereArgs: [id]);
          await txn.delete('installments',
              where: 'plan_id IN (SELECT id FROM installment_plans WHERE sale_id=?)', whereArgs: [id]);
          await txn.delete('installment_plans', where: 'sale_id=?', whereArgs: [id]);
          await txn.delete('till_entries', where: "ref_type='sale' AND ref_id=?", whereArgs: [id]);
          await txn.delete('ledger_entries',
              where: "ref_type IN ('sale','payment') AND ref_id=?", whereArgs: [id]);
          await txn.delete('sales', where: 'id=?', whereArgs: [id]);
        }
        return ids.length;
      });
    } else if (kind == 'purchases') {
      return db.transaction<int>((txn) async {
        final ids = olderThanDays == null
            ? await txn.rawQuery('''
                SELECT a.id FROM acquisitions a
                WHERE NOT EXISTS (SELECT 1 FROM sales s WHERE s.acquisition_id = a.id)
              ''')
            : await txn.rawQuery('''
                SELECT a.id FROM acquisitions a
                WHERE a.date < datetime('now','localtime','-$olderThanDays days')
                  AND NOT EXISTS (SELECT 1 FROM sales s WHERE s.acquisition_id = a.id)
              ''');
        for (final row in ids) {
          await _purgeAcquisition(txn, row['id'] as int);
        }
        return ids.length;
      });
    }
    throw ArgumentError('Bilinmeyen kind: $kind');
  }

  Future<void> _purgeAcquisition(Transaction txn, int acqId) async {
    final blocked = await txn.query('sales', where: 'acquisition_id=?', whereArgs: [acqId], limit: 1);
    if (blocked.isNotEmpty) return; // guard, aynı desktop mantığı

    final phoneRows = await txn.query('acquisitions', columns: ['phone_id'], where: 'id=?', whereArgs: [acqId]);
    if (phoneRows.isEmpty) return;
    final phoneId = phoneRows.first['phone_id'] as int;

    await txn.delete('expenses', where: 'acquisition_id=?', whereArgs: [acqId]);
    await txn.delete('part_replacements', where: 'acquisition_id=?', whereArgs: [acqId]);
    await txn.delete('hardware_tests', where: 'acquisition_id=?', whereArgs: [acqId]);
    await txn.delete('till_entries', where: "ref_type='acquisition' AND ref_id=?", whereArgs: [acqId]);
    await txn.delete('ledger_entries',
        where: "ref_type IN ('acquisition','payment') AND ref_id=?", whereArgs: [acqId]);
    await txn.delete('acquisitions', where: 'id=?', whereArgs: [acqId]);

    final prevAcq = await txn.query(
      'acquisitions',
      columns: ['id'],
      where: 'phone_id=?',
      whereArgs: [phoneId],
      orderBy: 'date DESC',
      limit: 1,
    );
    if (prevAcq.isNotEmpty) {
      await txn.update(
        'phones',
        {
          'current_acquisition_id': prevAcq.first['id'] as int,
          'status': 'sold',
          'updated_at': DateTime.now().toIso8601String(),
        },
        where: 'id=?',
        whereArgs: [phoneId],
      );
    } else {
      await txn.delete('phone_checks', where: 'phone_id=?', whereArgs: [phoneId]);
      await txn.delete('reservations', where: 'phone_id=?', whereArgs: [phoneId]);
      await txn.delete('attachments', where: "entity='phone' AND entity_id=?", whereArgs: [phoneId]);
      await txn.delete('phones', where: 'id=?', whereArgs: [phoneId]);
    }
  }
}
