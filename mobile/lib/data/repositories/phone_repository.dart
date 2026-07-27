import 'package:sqflite/sqflite.dart';

import '../../core/database/database_helper.dart';
import '../../domain/models/phone.dart';

/// Telefon alış/satış/liste işlemleri — masaüstündeki save_purchase/save_sale
/// (lib.rs) ile aynı iş kuralları. sqflite tek bağlantı kullandığından
/// (masaüstündeki plugin-sql havuzunun aksine) `db.transaction()` doğrudan
/// güvenlidir; ayrı bir Rust-tarafı atomiklik katmanına gerek yoktur.
class PhoneRepository {
  Future<Database> get _db async => DatabaseHelper.instance.database;

  Future<List<Brand>> listBrands() async {
    final db = await _db;
    final rows = await db.query('brands', orderBy: 'sort_order');
    return rows.map(Brand.fromMap).toList();
  }

  /// [tab] "all" veya PhoneStatus.dbValue. [search] IMEI/model/renk; [tagSearch] yalnızca etiket no.
  Future<List<PhoneRow>> listPhones({
    required String tab,
    String search = '',
    String tagSearch = '',
  }) async {
    final db = await _db;
    final where = StringBuffer(
      "p.deleted_at IS NULL AND p.status != 'sold'",
    );
    final args = <Object?>[];

    if (tab != 'all') {
      where.write(' AND p.status = ?');
      args.add(tab);
    }
    if (search.trim().isNotEmpty) {
      where.write(
        ' AND (p.imei1 LIKE ? OR (COALESCE(b.name,\'\') || \' \' || COALESCE(p.model,\'\')) LIKE ? OR p.color LIKE ?)',
      );
      final like = '%${search.trim()}%';
      args.addAll([like, like, like]);
    }
    if (tagSearch.trim().isNotEmpty) {
      where.write(' AND p.etiket_numarasi LIKE ?');
      args.add('%${tagSearch.trim()}%');
    }

    final rows = await db.rawQuery('''
      SELECT p.id, p.imei1, p.imei2, b.name AS brand_name, p.model AS model_name,
             p.color, p.storage_gb, p.cosmetic_grade, p.battery_health,
             p.status, p.region, p.notes, p.etiket_numarasi, p.warranty_until,
             (SELECT c.total_cost FROM v_phone_cost c WHERE c.acquisition_id = p.current_acquisition_id) AS total_cost
      FROM phones p
      LEFT JOIN brands b ON b.id = p.brand_id
      WHERE $where
      ORDER BY p.id DESC LIMIT 500
    ''', args);
    return rows.map(PhoneRow.fromMap).toList();
  }

  Future<Map<String, int>> statusCounts() async {
    final db = await _db;
    final rows = await db.rawQuery('''
      SELECT status, COUNT(*) AS n FROM phones
      WHERE deleted_at IS NULL AND status != 'sold' GROUP BY status
    ''');
    return {for (final r in rows) r['status'] as String: r['n'] as int};
  }

  Future<PhoneRow?> getPhone(int id) async {
    final db = await _db;
    final rows = await db.rawQuery('''
      SELECT p.id, p.imei1, p.imei2, b.name AS brand_name, p.model AS model_name,
             p.color, p.storage_gb, p.cosmetic_grade, p.battery_health,
             p.status, p.region, p.notes, p.etiket_numarasi, p.warranty_until,
             (SELECT c.total_cost FROM v_phone_cost c WHERE c.acquisition_id = p.current_acquisition_id) AS total_cost
      FROM phones p LEFT JOIN brands b ON b.id = p.brand_id
      WHERE p.id = ?
    ''', [id]);
    if (rows.isEmpty) return null;
    return PhoneRow.fromMap(rows.first);
  }

  Future<Map<String, Object?>?> _findExistingByImei(Transaction txn, String imei) async {
    final rows = await txn.rawQuery(
      "SELECT id, status FROM phones WHERE (imei1 = ? OR imei2 = ?) AND deleted_at IS NULL",
      [imei, imei],
    );
    return rows.isEmpty ? null : rows.first;
  }

  Future<bool> _tagClash(Transaction txn, String tag, int? excludeId) async {
    final rows = await txn.rawQuery(
      'SELECT id FROM phones WHERE etiket_numarasi = ? AND id IS NOT ?',
      [tag, excludeId],
    );
    return rows.isNotEmpty;
  }

  /// Telefon alışı: telefon (yeni/yeniden) + alış + kasa çıkışı tek transaction'da.
  /// Dönüş: phone_id.
  Future<int> savePurchase({
    String? imei,
    required int brandId,
    required String model,
    String? color,
    int? storageGb,
    required String cosmeticGrade,
    int? batteryHealth,
    required Region region,
    String? notes,
    String? etiketNumarasi,
    String? warrantyUntil,
    String? contactName,
    String? contactPhone,
    required int price,
    required String paymentMethod,
  }) async {
    final db = await _db;
    final imeiClean = (imei ?? '').trim().isEmpty ? null : imei!.trim();
    final tagClean = (etiketNumarasi ?? '').trim().isEmpty ? null : etiketNumarasi!.trim();

    return db.transaction<int>((txn) async {
      final existing = imeiClean == null ? null : await _findExistingByImei(txn, imeiClean);

      if (tagClean != null) {
        final excludeId = existing == null ? null : existing['id'] as int;
        if (await _tagClash(txn, tagClean, excludeId)) {
          throw StateError('Etiket numarası "$tagClean" başka bir telefonda kullanılıyor.');
        }
      }

      int phoneId;
      if (existing != null) {
        final status = existing['status'] as String;
        if (['in_stock', 'reserved', 'consigned'].contains(status)) {
          throw StateError('Bu telefon zaten dükkânda görünüyor; yeni alış açılamaz.');
        }
        phoneId = existing['id'] as int;
        await txn.update(
          'phones',
          {
            'status': 'in_stock',
            'ownership': 'stock',
            'model': model,
            if (color != null) 'color': color,
            if (storageGb != null) 'storage_gb': storageGb,
            'cosmetic_grade': cosmeticGrade,
            if (batteryHealth != null) 'battery_health': batteryHealth,
            'region': region.dbValue,
            if (notes != null) 'notes': notes,
            'warranty_until': warrantyUntil,
            'etiket_numarasi': tagClean,
            'updated_at': DateTime.now().toIso8601String(),
          },
          where: 'id = ?',
          whereArgs: [phoneId],
        );
      } else {
        phoneId = await txn.insert('phones', {
          'imei1': imeiClean,
          'brand_id': brandId,
          'model': model,
          'color': color,
          'storage_gb': storageGb,
          'cosmetic_grade': cosmeticGrade,
          'battery_health': batteryHealth,
          'region': region.dbValue,
          'notes': notes,
          'warranty_until': warrantyUntil,
          'etiket_numarasi': tagClean,
          'status': 'in_stock',
          'ownership': 'stock',
        });
      }

      final acqId = await txn.insert('acquisitions', {
        'phone_id': phoneId,
        'contact_name': (contactName ?? '').trim().isEmpty ? null : contactName!.trim(),
        'contact_phone': (contactPhone ?? '').trim().isEmpty ? null : contactPhone!.trim(),
        'price': price,
        'payment_method': paymentMethod,
        'source': 'walk_in',
      });

      await txn.update('phones', {'current_acquisition_id': acqId}, where: 'id = ?', whereArgs: [phoneId]);

      await txn.insert('till_entries', {
        'direction': 'out',
        'method': paymentMethod == 'mixed' ? 'cash' : paymentMethod,
        'amount': price,
        'ref_type': 'acquisition',
        'ref_id': acqId,
        'note': 'Telefon alışı',
      });

      return phoneId;
    });
  }

  /// Satış: sales + phones.status='sold' + kasa girişi (amount_paid'e göre) tek transaction'da.
  Future<int> saveSale({
    required int phoneId,
    required int price,
    required int amountPaid,
    required String paymentMethod,
    String? customerName,
    String? customerPhone,
    String? notes,
  }) async {
    final db = await _db;
    if (paymentMethod == 'pos' && amountPaid != price) {
      throw StateError('POS ödemesinde tutar satış tutarına eşit olmalıdır.');
    }
    return db.transaction<int>((txn) async {
      final phoneRows = await txn.query(
        'phones',
        columns: ['status', 'current_acquisition_id'],
        where: 'id = ? AND deleted_at IS NULL',
        whereArgs: [phoneId],
      );
      if (phoneRows.isEmpty) throw StateError('Telefon bulunamadı.');
      final status = phoneRows.first['status'] as String;
      if (!['in_stock', 'reserved'].contains(status)) {
        throw StateError('Bu telefon stokta değil; satılamaz.');
      }
      final acqId = phoneRows.first['current_acquisition_id'] as int?;
      if (acqId == null) throw StateError('Telefonun alış kaydı yok.');

      final saleId = await txn.insert('sales', {
        'phone_id': phoneId,
        'acquisition_id': acqId,
        'contact_name': (customerName ?? '').trim().isEmpty ? null : customerName!.trim(),
        'contact_phone': (customerPhone ?? '').trim().isEmpty ? null : customerPhone!.trim(),
        'price': price,
        'amount_paid': amountPaid,
        'payment_method': paymentMethod,
        'notes': notes,
      });

      await txn.update(
        'phones',
        {'status': 'sold', 'updated_at': DateTime.now().toIso8601String()},
        where: 'id = ?',
        whereArgs: [phoneId],
      );

      await txn.insert('till_entries', {
        'direction': 'in',
        'method': paymentMethod,
        'amount': amountPaid,
        'ref_type': 'sale',
        'ref_id': saleId,
        'note': 'Telefon satışı',
      });

      return saleId;
    });
  }

  Future<void> updatePhoneTag(int phoneId, String? tag) async {
    final db = await _db;
    final clean = (tag ?? '').trim().isEmpty ? null : tag!.trim();
    await db.transaction((txn) async {
      if (clean != null && await _tagClash(txn, clean, phoneId)) {
        throw StateError('Etiket numarası "$clean" başka bir telefonda kullanılıyor.');
      }
      await txn.update(
        'phones',
        {'etiket_numarasi': clean, 'updated_at': DateTime.now().toIso8601String()},
        where: 'id = ?',
        whereArgs: [phoneId],
      );
    });
  }

  Future<void> updatePhoneImei(int phoneId, String? imei1) async {
    final db = await _db;
    final clean = (imei1 ?? '').trim().isEmpty ? null : imei1!.trim();
    await db.transaction((txn) async {
      if (clean != null) {
        final rows = await txn.rawQuery(
          'SELECT id FROM phones WHERE (imei1 = ? OR imei2 = ?) AND id IS NOT ? AND deleted_at IS NULL',
          [clean, clean, phoneId],
        );
        if (rows.isNotEmpty) {
          throw StateError('IMEI "$clean" başka bir telefonda kayıtlı.');
        }
      }
      await txn.update(
        'phones',
        {'imei1': clean, 'updated_at': DateTime.now().toIso8601String()},
        where: 'id = ?',
        whereArgs: [phoneId],
      );
    });
  }
}
