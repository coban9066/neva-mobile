import 'package:flutter/material.dart';

import '../../../core/utils/money.dart';
import '../../../data/repositories/phone_repository.dart';
import '../../../domain/models/phone.dart';

/// Masaüstü QuickPurchase.tsx'in mobil karşılığı: IMEI opsiyonel, Etiket
/// Numarası IMEI'nin hemen altında, Kozmetik Kondisyon zorunlu.
class PurchaseScreen extends StatefulWidget {
  const PurchaseScreen({super.key});

  @override
  State<PurchaseScreen> createState() => _PurchaseScreenState();
}

class _PurchaseScreenState extends State<PurchaseScreen> {
  final _repo = PhoneRepository();
  final _imeiCtrl = TextEditingController();
  final _tagCtrl = TextEditingController();
  final _modelCtrl = TextEditingController();
  final _colorCtrl = TextEditingController();
  final _priceCtrl = TextEditingController();
  final _contactNameCtrl = TextEditingController();
  final _contactPhoneCtrl = TextEditingController();

  List<Brand> _brands = [];
  int? _brandId;
  int? _storage;
  String? _grade;
  Region _region = Region.domestic;
  String _payment = 'cash';
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _repo.listBrands().then((b) => setState(() => _brands = b));
  }

  bool get _canSave =>
      _brandId != null &&
      _modelCtrl.text.trim().isNotEmpty &&
      _grade != null &&
      parseLiraInput(_priceCtrl.text) != null &&
      (parseLiraInput(_priceCtrl.text) ?? 0) > 0 &&
      !_saving;

  Future<void> _save() async {
    if (!_canSave) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final phoneId = await _repo.savePurchase(
        imei: _imeiCtrl.text,
        brandId: _brandId!,
        model: _modelCtrl.text.trim(),
        color: _colorCtrl.text.trim().isEmpty ? null : _colorCtrl.text.trim(),
        storageGb: _storage,
        cosmeticGrade: _grade!,
        region: _region,
        etiketNumarasi: _tagCtrl.text,
        contactName: _contactNameCtrl.text,
        contactPhone: _contactPhoneCtrl.text,
        price: parseLiraInput(_priceCtrl.text)!,
        paymentMethod: _payment,
      );
      if (mounted) Navigator.of(context).pop(phoneId);
    } catch (e) {
      setState(() => _error = e.toString().replaceFirst('StateError: ', ''));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Telefon Al')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          TextField(
            controller: _imeiCtrl,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(
              labelText: 'IMEI',
              helperText: 'Opsiyonel — boş bırakılabilir, sonradan eklenebilir',
            ),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _tagCtrl,
            decoration: const InputDecoration(
              labelText: 'Etiket Numarası',
              helperText: 'Opsiyonel — Örn: A-154, R12, 2026-001',
            ),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<int>(
            initialValue: _brandId,
            decoration: const InputDecoration(labelText: 'Marka'),
            items: _brands
                .map((b) => DropdownMenuItem(value: b.id, child: Text(b.name)))
                .toList(),
            onChanged: (v) => setState(() => _brandId = v),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _modelCtrl,
            decoration: const InputDecoration(labelText: 'Model'),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: DropdownButtonFormField<int>(
                  initialValue: _storage,
                  decoration: const InputDecoration(labelText: 'Depolama (GB)'),
                  items: [64, 128, 256, 512, 1024]
                      .map((g) => DropdownMenuItem(value: g, child: Text(g >= 1024 ? '${g ~/ 1024}TB' : '${g}GB')))
                      .toList(),
                  onChanged: (v) => setState(() => _storage = v),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: TextField(
                  controller: _colorCtrl,
                  decoration: const InputDecoration(labelText: 'Renk'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Text('Kozmetik Kondisyon *', style: Theme.of(context).textTheme.labelLarge),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            children: cosmeticGrades
                .map((g) => ChoiceChip(
                      label: Text(g),
                      selected: _grade == g,
                      onSelected: (_) => setState(() => _grade = g),
                    ))
                .toList(),
          ),
          const SizedBox(height: 16),
          Text('Menşei', style: Theme.of(context).textTheme.labelLarge),
          const SizedBox(height: 8),
          SegmentedButton<Region>(
            segments: const [
              ButtonSegment(value: Region.domestic, label: Text('🇹🇷 Yurt İçi')),
              ButtonSegment(value: Region.import, label: Text('🌍 Yurt Dışı')),
            ],
            selected: {_region},
            onSelectionChanged: (s) => setState(() => _region = s.first),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _contactNameCtrl,
            decoration: const InputDecoration(labelText: 'Kimden alındı (opsiyonel)'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _contactPhoneCtrl,
            keyboardType: TextInputType.phone,
            decoration: const InputDecoration(labelText: 'Telefon Numarası (opsiyonel)'),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _priceCtrl,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: const InputDecoration(labelText: 'Alış fiyatı (₺)'),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 12),
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
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
          ],
          const SizedBox(height: 24),
          FilledButton(
            onPressed: _canSave ? _save : null,
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 14),
              child: _saving ? const Text('Kaydediliyor…') : const Text('Alışı Kaydet'),
            ),
          ),
        ],
      ),
    );
  }
}
