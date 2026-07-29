import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/material.dart';

import '../../../core/pdf/daily_report_pdf.dart';
import '../../../core/pdf/pdf_saver.dart';
import '../../../core/utils/money.dart';
import '../../../data/repositories/till_repository.dart';

class KasaScreen extends StatefulWidget {
  const KasaScreen({super.key});

  @override
  State<KasaScreen> createState() => _KasaScreenState();
}

class _KasaScreenState extends State<KasaScreen> {
  final _repo = TillRepository();
  TillFilter _filter = TillFilter.today;
  String _search = '';
  TillKpis? _kpis;
  List<TillEntry> _entries = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final kpis = await _repo.loadKpis();
    final entries = await _repo.listEntries(_filter, search: _search);
    if (!mounted) return;
    setState(() {
      _kpis = kpis;
      _entries = entries;
      _loading = false;
    });
  }

  Future<void> _addManualEntry() async {
    final result = await showModalBottomSheet<_ManualEntryResult>(
      context: context,
      isScrollControlled: true,
      builder: (context) => const _ManualEntrySheet(),
    );
    if (result == null) return;
    try {
      await _repo.addManualEntry(
        direction: result.direction,
        method: result.method,
        amount: result.amount,
        category: result.category,
        description: result.description,
      );
      _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.toString().replaceFirst('StateError: ', ''))));
      }
    }
  }

  Future<void> _generateDailyReport() async {
    final data = await _repo.loadDailyReport();
    final bytes = await buildDailyReportPdf(data);
    await saveAndShareBytes(Uint8List.fromList(bytes), dailyReportFileName(data.date));
  }

  Future<void> _exportCsv() async {
    final buffer = StringBuffer('﻿');
    buffer.writeln('Tarih;İşlem;Ödeme Türü;Tutar;Açıklama;Telefon;IMEI;Bakiye');
    for (final e in _entries.reversed) {
      final sign = e.direction == 'out' ? '-' : '';
      final amountLira = (e.amount / 100).toStringAsFixed(2);
      buffer.writeln([
        e.date,
        e.direction == 'in' ? 'Giren' : 'Çıkan',
        e.method,
        '$sign$amountLira',
        e.note ?? '',
        e.phoneLabel ?? '',
        e.imei ?? '',
        (e.balance / 100).toStringAsFixed(2),
      ].join(';'));
    }
    final bytes = Uint8List.fromList(utf8.encode(buffer.toString()));
    final today = DateTime.now();
    final fname =
        'Kasa_Defteri_${today.year}-${today.month.toString().padLeft(2, '0')}-${today.day.toString().padLeft(2, '0')}.csv';
    await saveAndShareBytes(bytes, fname);
  }

  @override
  Widget build(BuildContext context) {
    final kpis = _kpis;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Kasa'),
        actions: [
          IconButton(
            tooltip: 'Gün Sonu PDF',
            icon: const Icon(Icons.picture_as_pdf_rounded),
            onPressed: _generateDailyReport,
          ),
          IconButton(
            tooltip: 'CSV Dışa Aktar',
            icon: const Icon(Icons.file_download_rounded),
            onPressed: _exportCsv,
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _addManualEntry,
        icon: const Icon(Icons.add_rounded),
        label: const Text('Gelir/Gider Ekle'),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (kpis != null) _KpiGrid(kpis: kpis),
                  const SizedBox(height: 12),
                  TextField(
                    decoration: const InputDecoration(
                      prefixIcon: Icon(Icons.search_rounded),
                      hintText: 'Telefon, IMEI veya not ara',
                      border: OutlineInputBorder(),
                      isDense: true,
                    ),
                    onChanged: (v) {
                      _search = v;
                      _load();
                    },
                  ),
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 8,
                    children: [
                      _FilterChip(label: 'Bugün', value: TillFilter.today, current: _filter, onTap: _setFilter),
                      _FilterChip(label: 'Bu Hafta', value: TillFilter.week, current: _filter, onTap: _setFilter),
                      _FilterChip(label: 'Bu Ay', value: TillFilter.month, current: _filter, onTap: _setFilter),
                      _FilterChip(label: 'Tümü', value: TillFilter.all, current: _filter, onTap: _setFilter),
                    ],
                  ),
                  const SizedBox(height: 12),
                  if (_entries.isEmpty)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 32),
                      child: Center(child: Text('Bu aralıkta kayıt yok.')),
                    )
                  else
                    ..._entries.map((e) => _TillEntryTile(entry: e)),
                  const SizedBox(height: 80),
                ],
              ),
            ),
    );
  }

  void _setFilter(TillFilter f) {
    setState(() => _filter = f);
    _load();
  }
}

class _KpiGrid extends StatelessWidget {
  final TillKpis kpis;
  const _KpiGrid({required this.kpis});

  @override
  Widget build(BuildContext context) {
    final net = kpis.todayIncome - kpis.todayExpense;
    return GridView.count(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisCount: 2,
      childAspectRatio: 2.2,
      mainAxisSpacing: 8,
      crossAxisSpacing: 8,
      children: [
        _KpiTile('Kasadaki Nakit', formatKurus(kpis.cashBalance)),
        _KpiTile('Bugün Net', formatKurus(net), tone: net >= 0 ? Colors.green : Colors.red),
        _KpiTile('Bugün Giren', formatKurus(kpis.todayIncome)),
        _KpiTile('Bugün Çıkan', formatKurus(kpis.todayExpense)),
        _KpiTile('Bu Ay Giren', formatKurus(kpis.monthIncome)),
        _KpiTile('Bu Ay Çıkan', formatKurus(kpis.monthExpense)),
      ],
    );
  }
}

class _KpiTile extends StatelessWidget {
  final String label;
  final String value;
  final Color? tone;
  const _KpiTile(this.label, this.value, {this.tone});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(10),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(label, style: Theme.of(context).textTheme.bodySmall),
            Text(value,
                style: Theme.of(context)
                    .textTheme
                    .titleMedium
                    ?.copyWith(fontWeight: FontWeight.bold, color: tone)),
          ],
        ),
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  final String label;
  final TillFilter value;
  final TillFilter current;
  final ValueChanged<TillFilter> onTap;
  const _FilterChip({required this.label, required this.value, required this.current, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return ChoiceChip(
      label: Text(label),
      selected: current == value,
      onSelected: (_) => onTap(value),
    );
  }
}

class _TillEntryTile extends StatelessWidget {
  final TillEntry entry;
  const _TillEntryTile({required this.entry});

  @override
  Widget build(BuildContext context) {
    final isIn = entry.direction == 'in';
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: isIn ? Colors.green.withValues(alpha: 0.15) : Colors.red.withValues(alpha: 0.15),
          child: Icon(isIn ? Icons.arrow_downward_rounded : Icons.arrow_upward_rounded,
              color: isIn ? Colors.green : Colors.red),
        ),
        title: Text(entry.phoneLabel ?? entry.note ?? entry.method),
        subtitle: Text('${entry.date}  ·  ${entry.method}'),
        trailing: Text(
          '${isIn ? '+' : '-'}${formatKurus(entry.amount)}',
          style: TextStyle(
            fontWeight: FontWeight.bold,
            color: isIn ? Colors.green : Colors.red,
          ),
        ),
      ),
    );
  }
}

class _ManualEntryResult {
  final String direction;
  final String method;
  final int amount;
  final String category;
  final String? description;
  _ManualEntryResult({
    required this.direction,
    required this.method,
    required this.amount,
    required this.category,
    this.description,
  });
}

class _ManualEntrySheet extends StatefulWidget {
  const _ManualEntrySheet();

  @override
  State<_ManualEntrySheet> createState() => _ManualEntrySheetState();
}

class _ManualEntrySheetState extends State<_ManualEntrySheet> {
  String _direction = 'out';
  String _method = 'cash';
  String _category = TillRepository.manualCategories.first;
  final _amountCtrl = TextEditingController();
  final _descCtrl = TextEditingController();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 16,
        right: 16,
        top: 16,
        bottom: MediaQuery.of(context).viewInsets.bottom + 16,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Gelir/Gider Ekle', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 12),
          SegmentedButton<String>(
            segments: const [
              ButtonSegment(value: 'in', label: Text('Gelir')),
              ButtonSegment(value: 'out', label: Text('Gider')),
            ],
            selected: {_direction},
            onSelectionChanged: (s) => setState(() => _direction = s.first),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: _category,
            decoration: const InputDecoration(labelText: 'Kategori', border: OutlineInputBorder()),
            items: TillRepository.manualCategories
                .map((c) => DropdownMenuItem(value: c, child: Text(c)))
                .toList(),
            onChanged: (v) => setState(() => _category = v ?? _category),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _amountCtrl,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: const InputDecoration(labelText: 'Tutar (₺)', border: OutlineInputBorder()),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _descCtrl,
            decoration: const InputDecoration(labelText: 'Açıklama (opsiyonel)', border: OutlineInputBorder()),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: _method,
            decoration: const InputDecoration(labelText: 'Ödeme Türü', border: OutlineInputBorder()),
            items: const [
              DropdownMenuItem(value: 'cash', child: Text('Nakit')),
              DropdownMenuItem(value: 'pos', child: Text('POS')),
              DropdownMenuItem(value: 'transfer', child: Text('Havale')),
            ],
            onChanged: (v) => setState(() => _method = v ?? _method),
          ),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: () {
              final amount = parseLiraInput(_amountCtrl.text);
              if (amount == null || amount <= 0) {
                ScaffoldMessenger.of(context)
                    .showSnackBar(const SnackBar(content: Text('Geçerli bir tutar girin.')));
                return;
              }
              Navigator.pop(
                context,
                _ManualEntryResult(
                  direction: _direction,
                  method: _method,
                  amount: amount,
                  category: _category,
                  description: _descCtrl.text,
                ),
              );
            },
            child: const Text('Kaydet'),
          ),
        ],
      ),
    );
  }
}
