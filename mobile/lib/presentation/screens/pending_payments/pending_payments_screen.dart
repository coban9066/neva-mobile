import 'package:flutter/material.dart';

import '../../../core/utils/money.dart';
import '../../../data/repositories/till_repository.dart';

class PendingPaymentsScreen extends StatefulWidget {
  const PendingPaymentsScreen({super.key});

  @override
  State<PendingPaymentsScreen> createState() => _PendingPaymentsScreenState();
}

class _PendingPaymentsScreenState extends State<PendingPaymentsScreen> {
  final _repo = TillRepository();
  List<PendingPayment> _rows = [];
  bool _descending = true;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final rows = await _repo.listPendingPayments(descending: _descending);
    if (!mounted) return;
    setState(() {
      _rows = rows;
      _loading = false;
    });
  }

  Future<void> _collectPayment(PendingPayment p) async {
    final ctrl = TextEditingController(text: (p.remaining / 100).toStringAsFixed(2));
    final result = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Ödeme Al'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('${p.label}\nKalan: ${formatKurus(p.remaining)}'),
            const SizedBox(height: 12),
            TextField(
              controller: ctrl,
              autofocus: true,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(labelText: 'Alınan Tutar (₺)'),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Vazgeç')),
          FilledButton(onPressed: () => Navigator.pop(context, ctrl.text), child: const Text('Tahsil Et')),
        ],
      ),
    );
    if (result == null) return;
    final amount = parseLiraInput(result);
    if (amount == null || amount <= 0 || amount > p.remaining) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('Tutar 0 ile kalan alacak arasında olmalıdır.')));
      }
      return;
    }
    try {
      await _repo.recordPayment(p.saleId, amount);
      _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.toString().replaceFirst('StateError: ', ''))));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final total = _rows.fold<int>(0, (a, b) => a + b.remaining);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Bekleyen Ödemeler'),
        actions: [
          IconButton(
            tooltip: 'Sırala',
            icon: Icon(_descending ? Icons.arrow_downward_rounded : Icons.arrow_upward_rounded),
            onPressed: () {
              setState(() => _descending = !_descending);
              _load();
            },
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  Card(
                    color: Theme.of(context).colorScheme.primaryContainer,
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text('Toplam Bekleyen Alacak', style: Theme.of(context).textTheme.bodyMedium),
                          Text(formatKurus(total),
                              style: Theme.of(context)
                                  .textTheme
                                  .titleLarge
                                  ?.copyWith(fontWeight: FontWeight.bold)),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  if (_rows.isEmpty)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 32),
                      child: Center(child: Text('Bekleyen ödeme yok.')),
                    )
                  else
                    ..._rows.map((p) => Card(
                          margin: const EdgeInsets.only(bottom: 8),
                          child: ListTile(
                            title: Text(p.label),
                            subtitle: Text(
                              '${p.customerName ?? 'Müşteri belirtilmemiş'}\n'
                              'Toplam: ${formatKurus(p.price)} · Alınan: ${formatKurus(p.amountPaid)}',
                            ),
                            isThreeLine: true,
                            trailing: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                Text(formatKurus(p.remaining),
                                    style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.orange)),
                                const SizedBox(height: 4),
                                FilledButton.tonal(
                                  onPressed: () => _collectPayment(p),
                                  style: FilledButton.styleFrom(
                                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4)),
                                  child: const Text('Ödeme Al', style: TextStyle(fontSize: 12)),
                                ),
                              ],
                            ),
                          ),
                        )),
                ],
              ),
            ),
    );
  }
}
