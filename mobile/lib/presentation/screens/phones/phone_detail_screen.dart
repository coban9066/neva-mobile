import 'package:flutter/material.dart';

import '../../../core/utils/money.dart';
import '../../../data/repositories/phone_repository.dart';
import '../../../domain/models/phone.dart';
import 'sale_screen.dart';

/// Masaüstü PhoneDrawer.tsx'in mobil karşılığı: IMEI ve Etiket Numarası yerinde
/// (inline) düzenlenebilir, "Sat" butonu SaleScreen'i açar.
class PhoneDetailScreen extends StatefulWidget {
  final int phoneId;
  const PhoneDetailScreen({super.key, required this.phoneId});

  @override
  State<PhoneDetailScreen> createState() => _PhoneDetailScreenState();
}

class _PhoneDetailScreenState extends State<PhoneDetailScreen> {
  final _repo = PhoneRepository();
  PhoneRow? _phone;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final p = await _repo.getPhone(widget.phoneId);
    if (mounted) setState(() => _phone = p);
  }

  Future<void> _editTag() async {
    final ctrl = TextEditingController(text: _phone?.etiketNumarasi ?? '');
    final result = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Etiket Numarası'),
        content: TextField(controller: ctrl, autofocus: true),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Vazgeç')),
          FilledButton(onPressed: () => Navigator.pop(context, ctrl.text), child: const Text('Kaydet')),
        ],
      ),
    );
    if (result == null) return;
    try {
      await _repo.updatePhoneTag(widget.phoneId, result);
      _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.toString().replaceFirst('StateError: ', ''))));
      }
    }
  }

  Future<void> _editImei() async {
    final ctrl = TextEditingController(text: _phone?.imei1 ?? '');
    final result = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('IMEI'),
        content: TextField(controller: ctrl, autofocus: true, keyboardType: TextInputType.number),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Vazgeç')),
          FilledButton(onPressed: () => Navigator.pop(context, ctrl.text), child: const Text('Kaydet')),
        ],
      ),
    );
    if (result == null) return;
    try {
      await _repo.updatePhoneImei(widget.phoneId, result);
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
    final phone = _phone;
    return Scaffold(
      appBar: AppBar(title: Text(phone?.title ?? 'Telefon')),
      body: phone == null
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(phone.title, style: Theme.of(context).textTheme.titleLarge),
                        Text(
                          [
                            if (phone.storageGb != null) '${phone.storageGb}GB',
                            if (phone.color != null) phone.color!,
                          ].join(' · '),
                          style: Theme.of(context).textTheme.bodyMedium,
                        ),
                        const SizedBox(height: 12),
                        _EditableRow(
                          label: 'IMEI',
                          value: phone.imei1 ?? 'Girilmemiş',
                          onEdit: _editImei,
                        ),
                        const SizedBox(height: 6),
                        _EditableRow(
                          label: 'Etiket Numarası',
                          value: phone.etiketNumarasi ?? 'Girilmemiş',
                          onEdit: _editTag,
                        ),
                        const SizedBox(height: 6),
                        Text('Durum: ${phone.status.label}'),
                        if (phone.cosmeticGrade != null) Text('Kozmetik: ${phone.cosmeticGrade}'),
                        if (phone.batteryHealth != null) Text('Pil: %${phone.batteryHealth}'),
                        if (phone.warrantyUntil != null) Text('Garanti: ${phone.warrantyUntil}'),
                        const SizedBox(height: 8),
                        Text(
                          'Toplam Maliyet: ${formatKurus(phone.totalCost)}',
                          style: const TextStyle(fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                if (phone.status != PhoneStatus.sold)
                  FilledButton.icon(
                    icon: const Icon(Icons.sell_rounded),
                    label: const Text('Sat'),
                    onPressed: () async {
                      final ok = await Navigator.of(context).push<bool>(
                        MaterialPageRoute(builder: (_) => SaleScreen(phone: phone)),
                      );
                      if (ok == true) _load();
                    },
                  ),
              ],
            ),
    );
  }
}

class _EditableRow extends StatelessWidget {
  final String label;
  final String value;
  final VoidCallback onEdit;
  const _EditableRow({required this.label, required this.value, required this.onEdit});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: RichText(
            text: TextSpan(
              style: DefaultTextStyle.of(context).style,
              children: [
                TextSpan(text: '$label: ', style: const TextStyle(color: Colors.grey)),
                TextSpan(text: value, style: const TextStyle(fontFamily: 'monospace')),
              ],
            ),
          ),
        ),
        IconButton(icon: const Icon(Icons.edit_rounded, size: 18), onPressed: onEdit),
      ],
    );
  }
}
