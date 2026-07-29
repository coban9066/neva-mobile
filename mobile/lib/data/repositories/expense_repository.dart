import 'package:sqflite/sqflite.dart';

import '../../core/database/database_helper.dart';

class ExpenseRow {
  final int id;
  final int acquisitionId;
  final String category;
  final int amount;
  final String date;
  ExpenseRow({
    required this.id,
    required this.acquisitionId,
    required this.category,
    required this.amount,
    required this.date,
  });
}

/// Masaüstü ExpenseSection.tsx ile birebir aynı — alışa (acquisition) bağlı,
/// serbest metin kategori (v0.1.x sonrası CHECK kısıtı kaldırılmıştı).
class ExpenseRepository {
  Future<Database> get _db async => DatabaseHelper.instance.database;

  Future<List<ExpenseRow>> listForAcquisition(int acquisitionId) async {
    final db = await _db;
    final rows = await db.query(
      'expenses',
      where: 'acquisition_id = ? AND deleted_at IS NULL',
      whereArgs: [acquisitionId],
      orderBy: 'date DESC',
    );
    return rows
        .map((r) => ExpenseRow(
              id: r['id'] as int,
              acquisitionId: r['acquisition_id'] as int,
              category: r['category'] as String,
              amount: r['amount'] as int,
              date: r['date'] as String,
            ))
        .toList();
  }

  Future<void> add({
    required int phoneId,
    required int acquisitionId,
    required String category,
    required int amount,
  }) async {
    if (category.trim().isEmpty) throw StateError('Masraf adı zorunludur.');
    if (amount <= 0) throw StateError('Tutar sıfırdan büyük olmalıdır.');
    final db = await _db;
    await db.insert('expenses', {
      'phone_id': phoneId,
      'acquisition_id': acquisitionId,
      'category': category.trim(),
      'amount': amount,
    });
  }

  Future<void> update(int id, {required String category, required int amount}) async {
    if (category.trim().isEmpty) throw StateError('Masraf adı zorunludur.');
    if (amount <= 0) throw StateError('Tutar sıfırdan büyük olmalıdır.');
    final db = await _db;
    await db.update(
      'expenses',
      {'category': category.trim(), 'amount': amount},
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  Future<void> softDelete(int id) async {
    final db = await _db;
    await db.update(
      'expenses',
      {'deleted_at': DateTime.now().toIso8601String()},
      where: 'id = ?',
      whereArgs: [id],
    );
  }
}
