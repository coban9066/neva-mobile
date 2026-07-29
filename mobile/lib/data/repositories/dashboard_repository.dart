import '../../core/database/database_helper.dart';

class DashboardKpis {
  final int todaySalesCount;
  final int? todaySalesTotal;
  final int stockCount;
  final int? monthProfit;
  final int? weekProfit;
  final int? cashBalance;
  final int totalPhones;
  final int pendingWarranty;
  final int? todayProfit;
  final int? stockValue;
  final int warrantySoon;
  final int? pendingCollection;

  DashboardKpis({
    required this.todaySalesCount,
    this.todaySalesTotal,
    required this.stockCount,
    this.monthProfit,
    this.weekProfit,
    this.cashBalance,
    required this.totalPhones,
    required this.pendingWarranty,
    this.todayProfit,
    this.stockValue,
    required this.warrantySoon,
    this.pendingCollection,
  });
}

/// Masaüstü Dashboard.tsx sorgularıyla birebir aynı (sold telefonların garanti
/// sayaçlarını kirletmemesi dahil — v0.2.5 bugfix'i baştan uygulanmış durumda).
class DashboardRepository {
  Future<DashboardKpis> loadKpis() async {
    final db = await DatabaseHelper.instance.database;
    final rows = await db.rawQuery('''
      SELECT
        (SELECT COUNT(*) FROM sales WHERE date(date)=date('now','localtime') AND deleted_at IS NULL) AS today_sales_count,
        (SELECT SUM(price) FROM sales WHERE date(date)=date('now','localtime') AND deleted_at IS NULL) AS today_sales_total,
        (SELECT phone_count FROM v_stock_value) AS stock_count,
        (SELECT SUM(net_profit) FROM v_phone_profit
           WHERE strftime('%Y-%m', sale_date) = strftime('%Y-%m', 'now', 'localtime')) AS month_profit,
        (SELECT SUM(net_profit) FROM v_phone_profit
           WHERE date(sale_date) >= date('now','localtime','weekday 0','-6 days')) AS week_profit,
        (SELECT SUM(CASE WHEN direction = 'in' THEN amount ELSE -amount END)
           FROM till_entries WHERE method = 'cash') AS cash_balance,
        (SELECT COUNT(*) FROM phones WHERE deleted_at IS NULL) AS total_phones,
        (SELECT COUNT(*) FROM phones
           WHERE deleted_at IS NULL AND status != 'sold' AND warranty_until IS NOT NULL
             AND date(warranty_until) >= date('now','localtime')) AS pending_warranty,
        (SELECT SUM(net_profit) FROM v_phone_profit
           WHERE date(sale_date) = date('now','localtime')) AS today_profit,
        (SELECT total_value FROM v_stock_value) AS stock_value,
        (SELECT COUNT(*) FROM phones
           WHERE deleted_at IS NULL AND status != 'sold' AND warranty_until IS NOT NULL
             AND date(warranty_until) >= date('now','localtime')
             AND date(warranty_until) <= date('now','localtime','+30 days')) AS warranty_soon,
        (SELECT SUM(price - amount_paid) FROM sales
           WHERE deleted_at IS NULL AND amount_paid < price) AS pending_collection
    ''');
    final r = rows.first;
    return DashboardKpis(
      todaySalesCount: (r['today_sales_count'] as int?) ?? 0,
      todaySalesTotal: r['today_sales_total'] as int?,
      stockCount: (r['stock_count'] as int?) ?? 0,
      monthProfit: r['month_profit'] as int?,
      weekProfit: r['week_profit'] as int?,
      cashBalance: r['cash_balance'] as int?,
      totalPhones: (r['total_phones'] as int?) ?? 0,
      pendingWarranty: (r['pending_warranty'] as int?) ?? 0,
      todayProfit: r['today_profit'] as int?,
      stockValue: r['stock_value'] as int?,
      warrantySoon: (r['warranty_soon'] as int?) ?? 0,
      pendingCollection: r['pending_collection'] as int?,
    );
  }
}
