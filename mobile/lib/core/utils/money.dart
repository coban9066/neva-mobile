import 'package:intl/intl.dart';

/// Tüm tutarlar DB'de INTEGER kuruş (masaüstüyle aynı sözleşme). UI'da ₺ olarak gösterilir.
final NumberFormat _fmt = NumberFormat.currency(locale: 'tr_TR', symbol: '₺', decimalDigits: 0);
final NumberFormat _fmtPrecise = NumberFormat.currency(locale: 'tr_TR', symbol: '₺', decimalDigits: 2);

String formatKurus(int? kurus) {
  if (kurus == null) return '—';
  final lira = kurus / 100;
  return lira == lira.roundToDouble() ? _fmt.format(lira) : _fmtPrecise.format(lira);
}

/// Gizlilik Modu açıkken parasal değeri maskeler (masaüstü formatKurusPrivate ile aynı).
String formatKurusPrivate(int? kurus, bool hidden) => hidden ? '********' : formatKurus(kurus);

/// "14.500" | "14500" | "14500,50" → kuruş. Geçersizse null.
int? parseLiraInput(String raw) {
  final cleaned = raw.trim().replaceAll(RegExp(r'[₺\s]'), '').replaceAll('.', '').replaceAll(',', '.');
  if (cleaned.isEmpty) return null;
  final n = double.tryParse(cleaned);
  if (n == null || n < 0) return null;
  return (n * 100).round();
}
