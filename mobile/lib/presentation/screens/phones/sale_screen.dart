import 'package:flutter/material.dart';

import '../../../core/utils/money.dart';
import '../../../data/repositories/phone_repository.dart';
import '../../../domain/models/phone.dart';

/// Masaüstü Sales.tsx checkout akışının mobil karşılığı: Toplam Satış Tutarı,
/// Alınan Ödeme (varsayılan tama eşit — kısmi ödeme desteklenir), Kalan Alacak.
class SaleScreen extends StatefulWidget {
  final PhoneRow phone;
  const SaleScreen({super.key, required this.phone});

  @override
  State<SaleScreen> createState() => _SaleScreenState();
}

class _SaleScreenState extends State<SaleScreen> {
  final _repo = PhoneRepository();
  final _priceCtrl = TextEditingController();
  final _paidCtrl = TextEditingController();
  final _customerNameCtrl = TextEditingController();
  final _customerPhoneCtrl = TextEditingController();
  String _payment = 'cash';
  bool _paidTouched = false;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    if (widget.phone.totalCost != null) {
      _priceCtrl.text = (widget.phone.totalCost! / 100).toStringAsFixed(0);
    }
    _priceCtrl.addListener(() {
      if (!_paidTouched) _paidCtrl.text = _priceCtrl.text;
      setState(() {});
    });
  }

  bool get _isCard => _payment == 'pos';

  int? get _price => parseLiraInput(_priceCtrl.text);
  int? get _paid => parseLiraInput(_paidCtrl.text);
  int? get _remaining => (_price != null && _paid != null) ? (_price! - _paid!).clamp(0, 1 << 62) : null;

  bool get _canSave =>
      _price != null &&
      _price! > 0 &&
      _paid != null &&
      _paid! > 0 &&
      _paid! <= _price! &&
      !_saving;

  Future<void> _save() async {
    if (!_canSave) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await _repo.saveSale(
        phoneId: widget.phone.id,
        price: _price!,
        amountPaid: _paid!,
        paymentMethod: _payment,
        customerName: _customerNameCtrl.text,
        customerPhone: _customerPhoneCtrl.text,
      );
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      setState(() => _error = e.toString().replaceFirst('StateError: ', ''));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isCard && _paidCtrl.text != _priceCtrl.text) {
      _paidCtrl.text = _priceCtrl.text;
    }
    return Scaffold(
      appBar: AppBar(title: const Text('Telefon Sat')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: ListTile(
              title: Text(widget.phone.title),
              subtitle: Text(widget.phone.imei1 ?? 'IMEI yok'),
            ),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _priceCtrl,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: const InputDecoration(labelText: 'Toplam Satış Tutarı (₺)'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _paidCtrl,
            enabled: !_isCard,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: InputDecoration(
              labelText: 'Alınan Ödeme (₺)',
              helperText: _isCard
                  ? 'POS/Kredi Kartı her zaman tam tutarı işler'
                  : 'Tutarın tamamı alınmadıysa düşürün — kalan Bekleyen Ödemeler\'e düşer',
            ),
            onChanged: (_) => setState(() => _paidTouched = true),
          ),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.surfaceContainerHighest,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Kalan Alacak'),
                Text(
                  _remaining != null ? formatKurus(_remaining) : '—',
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    color: (_remaining ?? 0) > 0 ? Colors.orange : Colors.green,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Text('Ödeme Türü', style: Theme.of(context).textTheme.labelLarge),
          const SizedBox(height: 8),
          SegmentedButton<String>(
            segments: const [
              ButtonSegment(value: 'cash', label: Text('Nakit')),
              ButtonSegment(value: 'pos', label: Text('POS')),
              ButtonSegment(value: 'transfer', label: Text('Havale')),
            ],
            selected: {_payment},
            onSelectionChanged: (s) => setState(() => _payment = s.first),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _customerNameCtrl,
            decoration: const InputDecoration(labelText: 'Müşteri Adı (opsiyonel)'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _customerPhoneCtrl,
            keyboardType: TextInputType.phone,
            decoration: const InputDecoration(labelText: 'Müşteri Telefonu (opsiyonel)'),
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
          ],
          const SizedBox(height: 24),
          FilledButton(
            onPressed: _canSave ? _save : null,
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 14),
              child: _saving ? const Text('Kaydediliyor…') : const Text('Satışı Kaydet'),
            ),
          ),
        ],
      ),
    );
  }
}
