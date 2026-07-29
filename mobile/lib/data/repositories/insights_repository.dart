import 'package:sqflite/sqflite.dart';

import '../../core/database/database_helper.dart';

class MonthlyProfitPoint {
  final String label; // "Oca", "Şub", ...
  final int profitKurus;
  MonthlyProfitPoint(this.label, this.profitKurus);
}

class DailyProfitPoint {
  final int day; // 1..31
  final int profitKurus;
  DailyProfitPoint(this.day, this.profitKurus);
}

class TimelineEvent {
  final int phoneId;
  final String date;
  final String eventType;
  final int refId;
  final int amount;
  final String? note;
  final String label;

  TimelineEvent({
    required this.phoneId,
    required this.date,
    required this.eventType,
    required this.refId,
    required this.amount,
    this.note,
    required this.label,
  });
}

const Map<String, String> timelineLabels = {
  'acquisition': 'Alındı',
  'sale': 'Satıldı',
  'expense': 'Masraf',
  'part': 'Parça değişimi',
  'warranty_return': 'Garanti dönüşü',
  'return': 'İade',
  'reservation': 'Rezervasyon',
};

const List<String> _turkishMonths = [
  'Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'
];

const int _minChartMonths = 3;

/// Masaüstü DashboardCharts.tsx + RecentActivity.tsx ile birebir aynı sorgular.
class InsightsRepository {
  Future<Database> get _db async => DatabaseHelper.instance.database;

  /// Son 3-6 ay kâr (bar chart). Dükkan yeniyse (ilk satıştan bu yana < 6 ay)
  /// baştaki boş ayları kırpar, minimum 3 ay gösterir.
  Future<List<MonthlyProfitPoint>> monthlyProfit() async {
    final db = await _db;
    final rows = await db.rawQuery('''
      SELECT strftime('%Y-%m', sale_date) AS ym, SUM(net_profit) AS profit
      FROM v_phone_profit
      WHERE sale_date >= date('now','localtime','-5 months','start of month')
      GROUP BY ym ORDER BY ym
    ''');
    final byMonth = {for (final r in rows) r['ym'] as String: (r['profit'] as int?) ?? 0};

    final firstSaleRows = await db.rawQuery(
      "SELECT MIN(sale_date) AS d FROM v_phone_profit",
    );
    final firstSale = firstSaleRows.first['d'] as String?;

    final now = DateTime.now();
    var monthsToShow = 6;
    if (firstSale != null) {
      final first = DateTime.parse(firstSale.substring(0, 10));
      final since = (now.year - first.year) * 12 + (now.month - first.month) + 1;
      monthsToShow = since.clamp(_minChartMonths, 6);
    } else {
      monthsToShow = _minChartMonths;
    }

    final points = <MonthlyProfitPoint>[];
    for (var i = monthsToShow - 1; i >= 0; i--) {
      final d = DateTime(now.year, now.month - i, 1);
      final ym = '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}';
      points.add(MonthlyProfitPoint(_turkishMonths[d.month - 1], byMonth[ym] ?? 0));
    }
    return points;
  }

  /// Bu ay günlük kâr (line chart).
  Future<List<DailyProfitPoint>> dailyProfitThisMonth() async {
    final db = await _db;
    final rows = await db.rawQuery('''
      SELECT date(sale_date) AS d, SUM(net_profit) AS profit
      FROM v_phone_profit
      WHERE strftime('%Y-%m', sale_date) = strftime('%Y-%m','now','localtime')
      GROUP BY d ORDER BY d
    ''');
    return rows
        .map((r) => DailyProfitPoint(
              int.parse((r['d'] as String).substring(8, 10)),
              (r['profit'] as int?) ?? 0,
            ))
        .toList();
  }

  Future<List<TimelineEvent>> recentActivity({int limit = 40}) async {
    final db = await _db;
    final rows = await db.rawQuery('''
      SELECT t.phone_id, t.date, t.event_type, t.ref_id, t.amount, t.note,
             COALESCE(b.name || ' ' || p.model, 'Telefon #' || t.phone_id) AS label
      FROM v_phone_timeline t
      JOIN phones p ON p.id = t.phone_id
      LEFT JOIN brands b ON b.id = p.brand_id
      WHERE p.deleted_at IS NULL
      ORDER BY t.date DESC LIMIT ?
    ''', [limit]);
    return rows
        .map((r) => TimelineEvent(
              phoneId: r['phone_id'] as int,
              date: r['date'] as String,
              eventType: r['event_type'] as String,
              refId: r['ref_id'] as int,
              amount: (r['amount'] as int?) ?? 0,
              note: r['note'] as String?,
              label: r['label'] as String,
            ))
        .toList();
  }
}
