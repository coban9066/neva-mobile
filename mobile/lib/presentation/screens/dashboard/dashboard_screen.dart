import 'package:flutter/material.dart';

import '../../../core/utils/money.dart';
import '../../../data/repositories/dashboard_repository.dart';

/// Masaüstü Dashboard.tsx'in mobil karşılığı: aynı KPI'ler, tek sütun kart
/// listesi olarak (mobilde grid yerine dikey akış daha hızlı taranır).
class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  final _repo = DashboardRepository();
  DashboardKpis? _kpis;
  bool _privacyMode = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final kpis = await _repo.loadKpis();
    if (mounted) setState(() => _kpis = kpis);
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
            onPressed: () => setState(() => _privacyMode = !_privacyMode),
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
                  ),
                  _KpiCard(
                    icon: Icons.warning_amber_rounded,
                    label: 'Yakında Bitecek Garanti',
                    value: '${kpis.warrantySoon}',
                    sub: 'adet · 30 gün',
                    tone: kpis.warrantySoon > 0 ? _Tone.warning : _Tone.neutral,
                  ),
                  _KpiCard(
                    icon: Icons.hourglass_bottom_rounded,
                    label: 'Bekleyen Tahsilat',
                    value: formatKurusPrivate(kpis.pendingCollection ?? 0, _privacyMode),
                    tone: (kpis.pendingCollection ?? 0) > 0 ? _Tone.warning : _Tone.neutral,
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

  const _KpiCard({
    required this.icon,
    required this.label,
    required this.value,
    this.sub,
    this.tone = _Tone.neutral,
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
          ],
        ),
      ),
    );
  }
}
