import 'dart:typed_data';

import 'package:flutter/material.dart';

import '../../../core/pdf/pdf_saver.dart';
import '../../../core/pdf/receipt_pdf.dart';
import '../../../core/utils/money.dart';
import '../../../core/whatsapp/whatsapp_share.dart';
import '../../../data/repositories/expense_repository.dart';
import '../../../data/repositories/phone_repository.dart';
import '../../../domain/models/phone.dart';
import 'sale_screen.dart';

const Map<String, String> _paymentLabels = {
  'cash': 'Nakit',
  'pos': 'POS',
  'transfer': 'Havale',
  'credit_card': 'Kredi Kartı',
  'mixed': 'Karma',
};

/// Masaüstü PhoneDrawer.tsx'in mobil karşılığı: IMEI ve Etiket Numarası yerinde
/// (inline) düzenlenebilir, "Sat" butonu SaleScreen'i açar; ayrıca Masraflar,
/// WhatsApp paylaşımı ve (satılmışsa) satış fişi PDF'i buradan yönetilir.
class PhoneDetailScreen extends StatefulWidget {
  final int phoneId;
  const PhoneDetailScreen({super.key, required this.phoneId});

  @override
  State<PhoneDetailScreen> createState() => _PhoneDetailScreenState();
}

class _PhoneDetailScreenState extends State<PhoneDetailScreen> {
  final _repo = PhoneRepository();
  final _expenseRepo = ExpenseRepository();
  PhoneRow? _phone;
  List<ExpenseRow> _expenses = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final p = await _repo.getPhone(widget.phoneId);
    final expenses = p?.currentAcquisitionId == null
        ? <ExpenseRow>[]
        : await _expenseRepo.listForAcquisition(p!.currentAcquisitionId!);
    if (mounted) {
      setState(() {
        _phone = p;
        _expenses = expenses;
      });
    }
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

  Future<void> _shareWhatsApp() async {
    final phone = _phone;
    if (phone == null) return;
    final priceCtrl = TextEditingController(
      text: phone.totalCost != null ? (phone.totalCost! / 100).toStringAsFixed(0) : '',
    );
    final price = await showDialog<int>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('WhatsApp\'ta Paylaş'),
        content: TextField(
          controller: priceCtrl,
          autofocus: true,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          decoration: const InputDecoration(labelText: 'Satış Fiyatı (₺)'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Vazgeç')),
          FilledButton(
            onPressed: () => Navigator.pop(context, parseLiraInput(priceCtrl.text)),
            child: const Text('Paylaş'),
          ),
        ],
      ),
    );
    if (price == null || price <= 0) return;
    final shareable = ShareablePhone(
      brandName: phone.brandName,
      modelName: phone.modelName,
      storageGb: phone.storageGb,
      cosmeticGrade: phone.cosmeticGrade,
      batteryHealth: phone.batteryHealth,
      region: phone.region?.dbValue,
    );
    await openWhatsAppShare(buildWhatsAppMessage(shareable, price));
  }

  Future<void> _generateReceipt() async {
    final row = await _repo.getSaleReceiptData(widget.phoneId);
    if (row == null) return;
    final months = row['warranty_months'] as int?;
    final type = row['warranty_type'] as String?;
    final data = ReceiptData(
      saleId: row['id'] as int,
      model: row['label'] as String,
      imei: row['imei1'] as String?,
      date: row['date'] as String,
      price: row['price'] as int,
      paymentLabel: _paymentLabels[row['payment_method'] as String?] ?? (row['payment_method'] as String? ?? '-'),
      commissionAmount: (row['commission_amount'] as int?) ?? 0,
      warrantyText: (months != null && months > 0) ? '$months ay (${type ?? 'store'})' : null,
      buyerName: row['customer_name'] as String?,
    );
    final bytes = await buildReceiptPdf(data);
    await saveAndShareBytes(Uint8List.fromList(bytes), receiptFileName(data.saleId));
  }

  Future<void> _addExpense() async {
    final phone = _phone;
    if (phone?.currentAcquisitionId == null) return;
    final result = await showDialog<_ExpenseInput>(
      context: context,
      builder: (context) => const _ExpenseDialog(),
    );
    if (result == null) return;
    try {
      await _expenseRepo.add(
        phoneId: widget.phoneId,
        acquisitionId: phone!.currentAcquisitionId!,
        category: result.category,
        amount: result.amount,
      );
      _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.toString().replaceFirst('StateError: ', ''))));
      }
    }
  }

  Future<void> _editExpense(ExpenseRow expense) async {
    final result = await showDialog<_ExpenseInput>(
      context: context,
      builder: (context) => _ExpenseDialog(initialCategory: expense.category, initialAmount: expense.amount),
    );
    if (result == null) return;
    try {
      await _expenseRepo.update(expense.id, category: result.category, amount: result.amount);
      _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.toString().replaceFirst('StateError: ', ''))));
      }
    }
  }

  Future<void> _deleteExpense(ExpenseRow expense) async {
    await _expenseRepo.softDelete(expense.id);
    _load();
  }

  @override
  Widget build(BuildContext context) {
    final phone = _phone;
    final expenseTotal = _expenses.fold<int>(0, (a, b) => a + b.amount);
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
                const SizedBox(height: 12),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
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
                    OutlinedButton.icon(
                      icon: const Icon(Icons.chat_rounded),
                      label: const Text('WhatsApp\'ta Paylaş'),
                      onPressed: _shareWhatsApp,
                    ),
                    if (phone.status == PhoneStatus.sold)
                      OutlinedButton.icon(
                        icon: const Icon(Icons.receipt_long_rounded),
                        label: const Text('Satış Fişi (PDF)'),
                        onPressed: _generateReceipt,
                      ),
                  ],
                ),
                const SizedBox(height: 16),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text('Masraflar', style: Theme.of(context).textTheme.titleMedium),
                            IconButton(
                              icon: const Icon(Icons.add_circle_outline_rounded),
                              onPressed: phone.currentAcquisitionId == null ? null : _addExpense,
                            ),
                          ],
                        ),
                        if (_expenses.isEmpty)
                          const Padding(
                            padding: EdgeInsets.symmetric(vertical: 8),
                            child: Text('Masraf kaydı yok.'),
                          )
                        else ...[
                          for (final e in _expenses)
                            ListTile(
                              contentPadding: EdgeInsets.zero,
                              dense: true,
                              title: Text(e.category),
                              subtitle: Text(e.date),
                              trailing: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Text(formatKurus(e.amount)),
                                  IconButton(
                                    icon: const Icon(Icons.edit_rounded, size: 16),
                                    onPressed: () => _editExpense(e),
                                  ),
                                  IconButton(
                                    icon: const Icon(Icons.delete_outline_rounded, size: 16),
                                    onPressed: () => _deleteExpense(e),
                                  ),
                                ],
                              ),
                            ),
                          const Divider(),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const Text('Toplam Masraf', style: TextStyle(fontWeight: FontWeight.bold)),
                              Text(formatKurus(expenseTotal),
                                  style: const TextStyle(fontWeight: FontWeight.bold)),
                            ],
                          ),
                        ],
                      ],
                    ),
                  ),
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

class _ExpenseInput {
  final String category;
  final int amount;
  _ExpenseInput(this.category, this.amount);
}

class _ExpenseDialog extends StatefulWidget {
  final String? initialCategory;
  final int? initialAmount;
  const _ExpenseDialog({this.initialCategory, this.initialAmount});

  @override
  State<_ExpenseDialog> createState() => _ExpenseDialogState();
}

class _ExpenseDialogState extends State<_ExpenseDialog> {
  late final _categoryCtrl = TextEditingController(text: widget.initialCategory ?? '');
  late final _amountCtrl = TextEditingController(
    text: widget.initialAmount != null ? (widget.initialAmount! / 100).toStringAsFixed(2) : '',
  );

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(widget.initialCategory == null ? 'Masraf Ekle' : 'Masrafı Düzenle'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          TextField(
            controller: _categoryCtrl,
            autofocus: true,
            decoration: const InputDecoration(labelText: 'Masraf (ör. Kargo, Ekran)'),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _amountCtrl,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: const InputDecoration(labelText: 'Tutar (₺)'),
          ),
        ],
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Vazgeç')),
        FilledButton(
          onPressed: () {
            final amount = parseLiraInput(_amountCtrl.text);
            if (_categoryCtrl.text.trim().isEmpty || amount == null || amount <= 0) {
              ScaffoldMessenger.of(context)
                  .showSnackBar(const SnackBar(content: Text('Geçerli bir masraf adı ve tutar girin.')));
              return;
            }
            Navigator.pop(context, _ExpenseInput(_categoryCtrl.text.trim(), amount));
          },
          child: const Text('Kaydet'),
        ),
      ],
    );
  }
}
