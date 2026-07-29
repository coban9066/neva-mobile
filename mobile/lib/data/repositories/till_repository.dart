import 'package:sqflite/sqflite.dart';

import '../../core/database/database_helper.dart';

enum TillFilter { today, week, month, all }

class TillEntry {
  final int id;
  final String date;
  final String direction; // 'in' | 'out'
  final String method; // 'cash' | 'pos' | 'transfer' | 'other'
  final int amount;
  final String? note;
  final String? refType;
  final int? refId;
  final String? phoneLabel;
  final String? imei;
  final int balance; // running balance AFTER this row (chronological)

  TillEntry({
    required this.id,
    required this.date,
    required this.direction,
    required this.method,
    required this.amount,
    this.note,
    this.refType,
    this.refId,
    this.phoneLabel,
    this.imei,
    required this.balance,
  });
}

class TillKpis {
  final int cashBalance;
  final int todayIncome;
  final int todayExpense;
  final int monthIncome;
  final int monthExpense;
  TillKpis({
    required this.cashBalance,
    required this.todayIncome,
    required this.todayExpense,
    required this.monthIncome,
    required this.monthExpense,
  });
}

class PendingPayment {
  final int saleId;
  final int phoneId;
  final String? customerName;
  final String? customerPhone;
  final String label;
  final int price;
  final int amountPaid;
  final int remaining;

  PendingPayment({
    required this.saleId,
    required this.phoneId,
    this.customerName,
    this.customerPhone,
    required this.label,
    required this.price,
    required this.amountPaid,
    required this.remaining,
  });
}

class DailyReportData {
  final String date;
  final int dailyRevenue;
  final int dailyProfit;
  final int posCommission;
  final int totalExpenses;
  final int salesCount;
  final int totalStock;
  DailyReportData({
    required this.date,
    required this.dailyRevenue,
    required this.dailyProfit,
    required this.posCommission,
    required this.totalExpenses,
    required this.salesCount,
    required this.totalStock,
  });
}

/// Masaüstü Kasa.tsx + PendingPayments.tsx + record_payment (lib.rs) ile
/// birebir aynı sorgular/iş kuralları.
class TillRepository {
  Future<Database> get _db async => DatabaseHelper.instance.database;

  Future<List<TillEntry>> listEntries(TillFilter filter, {String search = ''}) async {
    final db = await _db;
    final rows = await db.rawQuery('''
      SELECT t.id, t.date, t.direction, t.method, t.amount, t.note, t.ref_type, t.ref_id,
             CASE
               WHEN t.ref_type = 'sale' THEN (
                 SELECT COALESCE(b.name || ' ' || p.model, 'Telefon #' || p.id)
                 FROM sales s JOIN phones p ON p.id = s.phone_id
                 LEFT JOIN brands b ON b.id = p.brand_id WHERE s.id = t.ref_id
               )
               WHEN t.ref_type = 'acquisition' THEN (
                 SELECT COALESCE(b.name || ' ' || p.model, 'Telefon #' || p.id)
                 FROM acquisitions a JOIN phones p ON p.id = a.phone_id
                 LEFT JOIN brands b ON b.id = p.brand_id WHERE a.id = t.ref_id
               )
               ELSE NULL
             END AS phone_label,
             CASE
               WHEN t.ref_type = 'sale' THEN (SELECT p.imei1 FROM sales s JOIN phones p ON p.id=s.phone_id WHERE s.id=t.ref_id)
               WHEN t.ref_type = 'acquisition' THEN (SELECT p.imei1 FROM acquisitions a JOIN phones p ON p.id=a.phone_id WHERE a.id=t.ref_id)
               ELSE NULL
             END AS imei
      FROM till_entries t
      ORDER BY t.date ASC, t.id ASC
    ''');

    int running = 0;
    final all = <TillEntry>[];
    for (final r in rows) {
      final direction = r['direction'] as String;
      final amount = r['amount'] as int;
      running += direction == 'in' ? amount : -amount;
      all.add(TillEntry(
        id: r['id'] as int,
        date: r['date'] as String,
        direction: direction,
        method: r['method'] as String,
        amount: amount,
        note: r['note'] as String?,
        refType: r['ref_type'] as String?,
        refId: r['ref_id'] as int?,
        phoneLabel: r['phone_label'] as String?,
        imei: r['imei'] as String?,
        balance: running,
      ));
    }

    final now = DateTime.now();
    final todayStr = _isoDate(now);
    final monthStr = todayStr.substring(0, 7);
    final monday = _mondayOfWeek(now);
    final mondayStr = _isoDate(monday);

    Iterable<TillEntry> filtered = all;
    switch (filter) {
      case TillFilter.today:
        filtered = all.where((e) => e.date.substring(0, 10) == todayStr);
        break;
      case TillFilter.week:
        filtered = all.where((e) => e.date.substring(0, 10).compareTo(mondayStr) >= 0);
        break;
      case TillFilter.month:
        filtered = all.where((e) => e.date.substring(0, 7) == monthStr);
        break;
      case TillFilter.all:
        break;
    }

    if (search.trim().isNotEmpty) {
      final q = search.trim().toLowerCase();
      filtered = filtered.where((e) =>
          (e.phoneLabel ?? '').toLowerCase().contains(q) ||
          (e.imei ?? '').toLowerCase().contains(q) ||
          (e.note ?? '').toLowerCase().contains(q));
    }

    return filtered.toList().reversed.toList();
  }

  DateTime _mondayOfWeek(DateTime d) {
    final day = d.weekday; // 1=Mon .. 7=Sun
    return DateTime(d.year, d.month, d.day).subtract(Duration(days: day - 1));
  }

  String _isoDate(DateTime d) =>
      '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  Future<TillKpis> loadKpis() async {
    final db = await _db;
    final rows = await db.rawQuery('''
      SELECT
        (SELECT SUM(CASE WHEN direction='in' THEN amount ELSE -amount END) FROM till_entries WHERE method='cash') AS cash_balance,
        (SELECT SUM(CASE WHEN direction='in' THEN amount ELSE 0 END) FROM till_entries WHERE date(date)=date('now','localtime')) AS today_income,
        (SELECT SUM(CASE WHEN direction='out' THEN amount ELSE 0 END) FROM till_entries WHERE date(date)=date('now','localtime')) AS today_expense,
        (SELECT SUM(CASE WHEN direction='in' THEN amount ELSE 0 END) FROM till_entries WHERE strftime('%Y-%m',date)=strftime('%Y-%m','now','localtime')) AS month_income,
        (SELECT SUM(CASE WHEN direction='out' THEN amount ELSE 0 END) FROM till_entries WHERE strftime('%Y-%m',date)=strftime('%Y-%m','now','localtime')) AS month_expense
    ''');
    final r = rows.first;
    return TillKpis(
      cashBalance: (r['cash_balance'] as int?) ?? 0,
      todayIncome: (r['today_income'] as int?) ?? 0,
      todayExpense: (r['today_expense'] as int?) ?? 0,
      monthIncome: (r['month_income'] as int?) ?? 0,
      monthExpense: (r['month_expense'] as int?) ?? 0,
    );
  }

  static const manualCategories = ['Kargo', 'Elektrik', 'Kira', 'Aksesuar Satışı', 'Diğer'];

  Future<void> addManualEntry({
    required String direction,
    required String method,
    required int amount,
    required String category,
    String? description,
  }) async {
    final db = await _db;
    if (amount <= 0) throw StateError('Tutar sıfırdan büyük olmalıdır.');
    final desc = (description ?? '').trim();
    final note = desc.isEmpty ? '[$category]' : '[$category] $desc';
    await db.insert('till_entries', {
      'direction': direction,
      'method': method,
      'amount': amount,
      'ref_type': 'manual',
      'note': note,
    });
  }

  Future<List<PendingPayment>> listPendingPayments({bool descending = true}) async {
    final db = await _db;
    final rows = await db.rawQuery('''
      SELECT s.id, s.phone_id,
             COALESCE(s.contact_name, c.full_name) AS customer_name,
             COALESCE(s.contact_phone, c.phone_number) AS customer_phone,
             COALESCE(b.name || ' ' || p.model, 'Telefon #' || p.id) AS label,
             s.price, s.amount_paid, (s.price - s.amount_paid) AS remaining
      FROM sales s
      JOIN phones p ON p.id = s.phone_id
      LEFT JOIN brands b ON b.id = p.brand_id
      LEFT JOIN contacts c ON c.id = s.contact_id
      WHERE s.deleted_at IS NULL AND s.amount_paid < s.price
      ORDER BY remaining ${descending ? 'DESC' : 'ASC'}
    ''');
    return rows
        .map((r) => PendingPayment(
              saleId: r['id'] as int,
              phoneId: r['phone_id'] as int,
              customerName: r['customer_name'] as String?,
              customerPhone: r['customer_phone'] as String?,
              label: r['label'] as String,
              price: r['price'] as int,
              amountPaid: r['amount_paid'] as int,
              remaining: r['remaining'] as int,
            ))
        .toList();
  }

  /// Rust `record_payment` ile birebir aynı iş kuralları, tek transaction.
  Future<void> recordPayment(int saleId, int amount) async {
    final db = await _db;
    if (amount <= 0) throw StateError('Ödeme tutarı sıfırdan büyük olmalıdır.');
    await db.transaction((txn) async {
      final rows = await txn.query(
        'sales',
        columns: ['price', 'amount_paid', 'contact_id'],
        where: 'id = ? AND deleted_at IS NULL',
        whereArgs: [saleId],
      );
      if (rows.isEmpty) throw StateError('Satış bulunamadı.');
      final price = rows.first['price'] as int;
      final amountPaid = rows.first['amount_paid'] as int;
      final contactId = rows.first['contact_id'] as int?;
      final remaining = price - amountPaid;
      if (remaining <= 0) throw StateError('Bu satışın bekleyen bir alacağı yok.');
      if (amount > remaining) throw StateError('Ödeme tutarı kalan alacaktan fazla olamaz.');

      await txn.update(
        'sales',
        {'amount_paid': amountPaid + amount},
        where: 'id = ?',
        whereArgs: [saleId],
      );

      await txn.insert('till_entries', {
        'direction': 'in',
        'method': 'cash',
        'amount': amount,
        'ref_type': 'sale',
        'ref_id': saleId,
        'note': 'Bekleyen tahsilat',
      });

      if (contactId != null) {
        await txn.insert('ledger_entries', {
          'contact_id': contactId,
          'ref_type': 'payment',
          'ref_id': saleId,
          'debit': 0,
          'credit': amount,
          'note': 'Bekleyen tahsilat',
        });
      }
    });
  }

  Future<DailyReportData> loadDailyReport() async {
    final db = await _db;
    final rows = await db.rawQuery('''
      SELECT
        (SELECT SUM(price) FROM sales WHERE date(date)=date('now','localtime') AND deleted_at IS NULL) AS daily_revenue,
        (SELECT SUM(net_profit) FROM v_phone_profit WHERE date(sale_date)=date('now','localtime')) AS daily_profit,
        (SELECT SUM(commission_amount) FROM sales WHERE date(date)=date('now','localtime') AND deleted_at IS NULL AND payment_method='pos') AS pos_commission,
        (SELECT SUM(amount) FROM expenses WHERE date(date)=date('now','localtime') AND deleted_at IS NULL) AS total_expenses,
        (SELECT COUNT(*) FROM sales WHERE date(date)=date('now','localtime') AND deleted_at IS NULL) AS sales_count,
        (SELECT phone_count FROM v_stock_value) AS total_stock
    ''');
    final r = rows.first;
    return DailyReportData(
      date: _isoDate(DateTime.now()),
      dailyRevenue: (r['daily_revenue'] as int?) ?? 0,
      dailyProfit: (r['daily_profit'] as int?) ?? 0,
      posCommission: (r['pos_commission'] as int?) ?? 0,
      totalExpenses: (r['total_expenses'] as int?) ?? 0,
      salesCount: (r['sales_count'] as int?) ?? 0,
      totalStock: (r['total_stock'] as int?) ?? 0,
    );
  }
}
