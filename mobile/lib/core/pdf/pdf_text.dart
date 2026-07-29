import 'package:intl/intl.dart';

/// receipt-pdf.ts / daily-report-pdf.ts ile birebir aynı: pdf paketinin
/// standart (Helvetica) fontu Türkçe özel karakterleri (ş,ı,ğ,ü,ö,ç) ve ₺
/// işaretini bulamadığından, PDF'e özel ASCII'ye çeviriyoruz.
const Map<String, String> _trToAscii = {
  'ş': 's', 'Ş': 'S', 'ı': 'i', 'İ': 'I', 'ğ': 'g', 'Ğ': 'G',
  'ü': 'u', 'Ü': 'U', 'ö': 'o', 'Ö': 'O', 'ç': 'c', 'Ç': 'C',
};

String trAscii(String s) {
  final buffer = StringBuffer();
  for (final ch in s.characters) {
    buffer.write(_trToAscii[ch] ?? ch);
  }
  return buffer.toString();
}

extension _Characters on String {
  Iterable<String> get characters => split('');
}

final NumberFormat _liraFmt = NumberFormat.decimalPattern('tr_TR')..maximumFractionDigits = 2;

/// PDF'te ₺ sembolü yerine "TL" son eki.
String formatKurusPlain(int kurus) {
  final lira = kurus / 100;
  return '${trAscii(_liraFmt.format(lira))} TL';
}
