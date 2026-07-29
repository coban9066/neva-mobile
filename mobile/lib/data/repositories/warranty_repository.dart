import 'package:sqflite/sqflite.dart';

import '../../core/database/database_helper.dart';

class WarrantyRow {
  final int phoneId;
  final String label;
  final String? imei1;
  final String warrantyUntil;

  WarrantyRow({
    required this.phoneId,
    required this.label,
    this.imei1,
    required this.warrantyUntil,
  });

  /// Masaüstü warranty.ts remainingDays ile birebir aynı.
  int get remainingDays {
    final until = DateTime.parse('${warrantyUntil.substring(0, 10)}T23:59:59');
    return (until.difference(DateTime.now()).inMilliseconds / 86400000).ceil();
  }

  String get formattedSpan {
    final days = remainingDays;
    if (days <= 0) return 'Bitti';
    final months = days ~/ 30;
    final rem = days % 30;
    if (months == 0) return '$rem Gün';
    if (rem == 0) return '$months Ay';
    return '$months Ay $rem Gün';
  }
}

/// Masaüstü Warranty.tsx ile birebir aynı — `p.status != 'sold'` filtresi
/// (v0.2.5 bugfix'i) dahil.
class WarrantyRepository {
  Future<Database> get _db async => DatabaseHelper.instance.database;

  Future<List<WarrantyRow>> list({bool soonOnly = false}) async {
    final db = await _db;
    final where = StringBuffer('''
      p.deleted_at IS NULL
      AND p.status != 'sold'
      AND p.warranty_until IS NOT NULL
      AND date(p.warranty_until) >= date('now','localtime')
    ''');
    if (soonOnly) {
      where.write("AND date(p.warranty_until) <= date('now','localtime','+30 days')");
    }
    final rows = await db.rawQuery('''
      SELECT p.id AS phone_id,
             COALESCE(b.name || ' ' || p.model, 'Telefon #' || p.id) AS label,
             p.imei1, p.warranty_until
      FROM phones p
      LEFT JOIN brands b ON b.id = p.brand_id
      WHERE $where
      ORDER BY p.warranty_until ASC
    ''');
    return rows
        .map((r) => WarrantyRow(
              phoneId: r['phone_id'] as int,
              label: r['label'] as String,
              imei1: r['imei1'] as String?,
              warrantyUntil: r['warranty_until'] as String,
            ))
        .toList();
  }
}
