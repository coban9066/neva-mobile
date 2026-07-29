import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';

import '../../../core/utils/money.dart';
import '../../../data/repositories/dashboard_repository.dart';
import '../../../data/repositories/insights_repository.dart';
import '../../../data/repositories/settings_repository.dart';
import '../pending_payments/pending_payments_screen.dart';
import '../phones/phone_detail_screen.dart';
import '../warranty/warranty_screen.dart';

/// Masaüstü Dashboard.tsx'in mobil karşılığı: aynı KPI'ler, grafikler ve
/// son işlemler; tek sütun dikey akış olarak (mobilde grid yerine daha hızlı taranır).
class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  final _repo = DashboardRepository();
  final _insights = InsightsRepository();
  final _settings = SettingsRepository();
  DashboardKpis? _kpis;
  List<MonthlyProfitPoint> _monthly = [];
  List<DailyProfitPoint> _daily = [];
  List<TimelineEvent> _activity = [];
  bool _privacyMode = false;
  bool _activityExpanded = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final privacy = await _settings.getBool('privacy_mode');
    final kpis = await _repo.loadKpis();
    final monthly = await _insights.monthlyProfit();
    final daily = await _insights.dailyProfitThisMonth();
    final activity = await _insights.recentActivity();
    if (!mounted) return;
    setState(() {
      _privacyMode = privacy;
      _kpis = kpis;
      _monthly = monthly;
      _daily = daily;
      _activity = activity;
    });
  }

  Future<void> _togglePrivacy() async {
    final next = !_privacyMode;
    setState(() => _privacyMode = next);
    await _settings.setBool('privacy_mode', next);
  }

  @override
  Widget build(BuildContext context) {
    final kpis = _kpis;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Dashboard'),
        actions: [
          IconButton(
            tooltip: _privacyMode ? 'Gizlilik Modunu kapat' : 'Gizlilik Modunu aç',
            icon: Icon(_privacyMode ? Icons.visibility_off_rounded : Icons.visibility_rounded),
            onPressed: _togglePrivacy,
          ),
        ],
      ),
      body: kpis == null
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  _KpiCard(
                    icon: Icons.paid_rounded,
                    label: 'Bugünkü Kâr',
                    value: formatKurusPrivate(kpis.todayProfit ?? 0, _privacyMode),
                    tone: _tone(kpis.todayProfit),
                  ),
                  _KpiCard(
                    icon: Icons.trending_up_rounded,
                    label: 'Bu Hafta Kâr',
                    value: formatKurusPrivate(kpis.weekProfit ?? 0, _privacyMode),
                    tone: _tone(kpis.weekProfit),
                  ),
                  _KpiCard(
                    icon: Icons.trending_up_rounded,
                    label: 'Bugünkü Satış',
                    value: formatKurusPrivate(kpis.todaySalesTotal ?? 0, _privacyMode),
                    sub: '${kpis.todaySalesCount} adet',
                  ),
                  _KpiCard(
                    icon: Icons.savings_rounded,
                    label: 'Bu Ay Net Kâr',
                    value: formatKurusPrivate(kpis.monthProfit ?? 0, _privacyMode),
                    tone: _tone(kpis.monthProfit),
                  ),
                  _KpiCard(
                    icon: Icons.account_balance_wallet_rounded,
                    label: 'Kasadaki Nakit',
                    value: formatKurusPrivate(kpis.cashBalance ?? 0, _privacyMode),
                  ),
                  _KpiCard(
                    icon: Icons.smartphone_rounded,
                    label: 'Stoktaki Telefon',
                    value: '${kpis.stockCount}',
                    sub: 'adet',
                  ),
                  _KpiCard(
                    icon: Icons.layers_rounded,
                    label: 'Toplam Stok Değeri',
                    value: formatKurusPrivate(kpis.stockValue ?? 0, _privacyMode),
                  ),
                  _KpiCard(
                    icon: Icons.shield_rounded,
                    label: 'Bekleyen Garanti',
                    value: '${kpis.pendingWarranty}',
                    sub: 'adet',
                    onTap: () => Navigator.of(context)
                        .push(MaterialPageRoute(builder: (_) => const WarrantyScreen())),
                  ),
                  _KpiCard(
                    icon: Icons.warning_amber_rounded,
                    label: 'Yakında Bitecek Garanti',
                    value: '${kpis.warrantySoon}',
                    sub: 'adet · 30 gün',
                    tone: kpis.warrantySoon > 0 ? _Tone.warning : _Tone.neutral,
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const WarrantyScreen(soonOnly: true)),
                    ),
                  ),
                  _KpiCard(
                    icon: Icons.hourglass_bottom_rounded,
                    label: 'Bekleyen Tahsilat',
                    value: formatKurusPrivate(kpis.pendingCollection ?? 0, _privacyMode),
                    tone: (kpis.pendingCollection ?? 0) > 0 ? _Tone.warning : _Tone.neutral,
                    onTap: () => Navigator.of(context)
                        .push(MaterialPageRoute(builder: (_) => const PendingPaymentsScreen())),
                  ),
                  const SizedBox(height: 8),
                  if (_monthly.isNotEmpty) _MonthlyProfitChart(points: _monthly, hideMoney: _privacyMode),
                  const SizedBox(height: 12),
                  _DailyProfitChart(points: _daily, hideMoney: _privacyMode),
                  const SizedBox(height: 12),
                  _RecentActivityCard(
                    events: _activity,
                    expanded: _activityExpanded,
                    hideMoney: _privacyMode,
                    onToggle: () => setState(() => _activityExpanded = !_activityExpanded),
                  ),
                ],
              ),
            ),
    );
  }

  _Tone _tone(int? v) {
    if (v == null || v == 0) return _Tone.neutral;
    return v > 0 ? _Tone.success : _Tone.danger;
  }
}

enum _Tone { neutral, success, danger, warning }

class _KpiCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final String? sub;
  final _Tone tone;
  final VoidCallback? onTap;

  const _KpiCard({
    required this.icon,
    required this.label,
    required this.value,
    this.sub,
    this.tone = _Tone.neutral,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final color = switch (tone) {
      _Tone.success => Colors.green,
      _Tone.danger => scheme.error,
      _Tone.warning => Colors.orange,
      _Tone.neutral => scheme.onSurface,
    };
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              CircleAvatar(
                backgroundColor: scheme.primaryContainer,
                child: Icon(icon, color: scheme.onPrimaryContainer, size: 20),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(label, style: Theme.of(context).textTheme.bodySmall),
                    const SizedBox(height: 2),
                    Text(
                      value,
                      style: Theme.of(context)
                          .textTheme
                          .titleLarge
                          ?.copyWith(fontWeight: FontWeight.bold, color: color),
                    ),
                    if (sub != null)
                      Text(sub!, style: Theme.of(context).textTheme.bodySmall),
                  ],
                ),
              ),
              if (onTap != null) const Icon(Icons.chevron_right_rounded, size: 18),
            ],
          ),
        ),
      ),
    );
  }
}

class _MonthlyProfitChart extends StatelessWidget {
  final List<MonthlyProfitPoint> points;
  final bool hideMoney;
  const _MonthlyProfitChart({required this.points, required this.hideMoney});

  @override
  Widget build(BuildContext context) {
    final maxAbs = points.map((p) => p.profitKurus.abs()).fold<int>(1, (a, b) => a > b ? a : b);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Son ${points.length} Ay Kâr', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 16),
            SizedBox(
              height: 160,
              child: BarChart(
                BarChartData(
                  maxY: maxAbs.toDouble() * 1.2 / 100,
                  minY: 0,
                  gridData: const FlGridData(show: false),
                  borderData: FlBorderData(show: false),
                  titlesData: FlTitlesData(
                    leftTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                    rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                    topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                    bottomTitles: AxisTitles(
                      sideTitles: SideTitles(
                        showTitles: true,
                        getTitlesWidget: (value, meta) {
                          final i = value.toInt();
                          if (i < 0 || i >= points.length) return const SizedBox.shrink();
                          return Padding(
                            padding: const EdgeInsets.only(top: 4),
                            child: Text(points[i].label, style: Theme.of(context).textTheme.bodySmall),
                          );
                        },
                      ),
                    ),
                  ),
                  barTouchData: BarTouchData(
                    touchTooltipData: BarTouchTooltipData(
                      getTooltipItem: (group, groupIndex, rod, rodIndex) => BarTooltipItem(
                        hideMoney ? '********' : formatKurus(points[group.x.toInt()].profitKurus),
                        const TextStyle(color: Colors.white, fontSize: 11),
                      ),
                    ),
                  ),
                  barGroups: [
                    for (var i = 0; i < points.length; i++)
                      BarChartGroupData(x: i, barRods: [
                        BarChartRodData(
                          toY: (points[i].profitKurus / 100).abs(),
                          color: points[i].profitKurus >= 0
                              ? Theme.of(context).colorScheme.primary
                              : Theme.of(context).colorScheme.error,
                          width: 18,
                          borderRadius: BorderRadius.circular(4),
                        ),
                      ]),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DailyProfitChart extends StatelessWidget {
  final List<DailyProfitPoint> points;
  final bool hideMoney;
  const _DailyProfitChart({required this.points, required this.hideMoney});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Bu Ay Günlük Kâr', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 16),
            if (points.isEmpty)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 24),
                child: Center(child: Text('Bu ay henüz satış yok.')),
              )
            else
              SizedBox(
                height: 160,
                child: LineChart(
                  LineChartData(
                    gridData: const FlGridData(show: false),
                    borderData: FlBorderData(show: false),
                    titlesData: FlTitlesData(
                      leftTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                      rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                      topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                      bottomTitles: AxisTitles(
                        sideTitles: SideTitles(
                          showTitles: true,
                          interval: (points.length / 5).clamp(1, 31).roundToDouble(),
                          getTitlesWidget: (value, meta) =>
                              Text('${value.toInt()}', style: Theme.of(context).textTheme.bodySmall),
                        ),
                      ),
                    ),
                    lineTouchData: LineTouchData(
                      touchTooltipData: LineTouchTooltipData(
                        getTooltipItems: (spots) => spots
                            .map((s) => LineTooltipItem(
                                  hideMoney ? '********' : formatKurus((s.y * 100).round()),
                                  const TextStyle(color: Colors.white, fontSize: 11),
                                ))
                            .toList(),
                      ),
                    ),
                    lineBarsData: [
                      LineChartBarData(
                        spots: [for (final p in points) FlSpot(p.day.toDouble(), p.profitKurus / 100)],
                        isCurved: true,
                        color: Theme.of(context).colorScheme.primary,
                        barWidth: 2.5,
                        dotData: const FlDotData(show: false),
                        belowBarData: BarAreaData(
                          show: true,
                          color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.12),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _RecentActivityCard extends StatelessWidget {
  final List<TimelineEvent> events;
  final bool expanded;
  final bool hideMoney;
  final VoidCallback onToggle;

  const _RecentActivityCard({
    required this.events,
    required this.expanded,
    required this.hideMoney,
    required this.onToggle,
  });

  @override
  Widget build(BuildContext context) {
    final shown = expanded ? events : events.take(6).toList();
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Son İşlemler', style: Theme.of(context).textTheme.titleMedium),
                if (events.length > 6)
                  TextButton(
                    onPressed: onToggle,
                    child: Text(expanded ? 'Daralt' : 'Tümünü Gör'),
                  ),
              ],
            ),
            if (shown.isEmpty)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 16),
                child: Text('Henüz işlem yok'),
              )
            else
              ...shown.map((e) => ListTile(
                    contentPadding: EdgeInsets.zero,
                    dense: true,
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => PhoneDetailScreen(phoneId: e.phoneId)),
                    ),
                    title: Text(e.label),
                    subtitle: Text('${timelineLabels[e.eventType] ?? e.eventType} · ${e.date}'),
                    trailing: e.amount > 0
                        ? Text(hideMoney ? '********' : formatKurus(e.amount))
                        : null,
                  )),
          ],
        ),
      ),
    );
  }
}
