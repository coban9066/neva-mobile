import 'package:url_launcher/url_launcher.dart';

import '../utils/money.dart';

class ShareablePhone {
  final String? brandName;
  final String? modelName;
  final int? storageGb;
  final String? cosmeticGrade;
  final int? batteryHealth;
  final String? region; // 'domestic' | 'import'

  ShareablePhone({
    this.brandName,
    this.modelName,
    this.storageGb,
    this.cosmeticGrade,
    this.batteryHealth,
    this.region,
  });

  bool get showBattery => (brandName ?? '').toLowerCase().contains('apple');
}

/// Masaüstü whatsapp.ts ile birebir aynı mesaj biçimi — IMEI kasıtlı olarak yok.
String buildWhatsAppMessage(ShareablePhone phone, int priceKurus) {
  final title = [phone.brandName, phone.modelName]
      .where((s) => s != null && s.trim().isNotEmpty)
      .join(' ');
  final lines = <String>[title.isEmpty ? 'Telefon' : title];
  if (phone.storageGb != null) lines.add('${phone.storageGb} GB');
  if ((phone.cosmeticGrade ?? '').isNotEmpty) lines.add(phone.cosmeticGrade!);
  if (phone.showBattery && phone.batteryHealth != null) {
    lines.add('Pil Sağlığı: %${phone.batteryHealth}');
  }
  if (phone.region != null) {
    lines.add(phone.region == 'domestic' ? 'Yurt İçi' : 'Yurt Dışı');
  }
  lines.add('Fiyat: ${formatKurus(priceKurus)}');
  return lines.join('\n---\n');
}

Future<void> openWhatsAppShare(String message) async {
  final uri = Uri.parse('https://wa.me/?text=${Uri.encodeComponent(message)}');
  await launchUrl(uri, mode: LaunchMode.externalApplication);
}
