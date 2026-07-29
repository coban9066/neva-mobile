import 'dart:typed_data';
import 'package:ed25519_edwards/ed25519_edwards.dart' as ed;

import 'base32.dart';
import 'device_id.dart';
import 'license_payload.dart';

/// Windows license.rs (`decode_and_verify` + `evaluate`) ile aynı algoritmanın
/// Android portu. Public key, imzalama şeması ve payload biçimi TÜM platformlarda
/// birebir aynıdır — NEVA LICENSE MANAGER (Windows) tek doğrulama otoritesidir,
/// Android burada yalnızca doğrular, kod üretmez.
class LicenseService {
  /// license.rs'deki TRUSTED_PUBLIC_KEYS_HEX ile birebir aynı liste (2026-07-28
  /// anahtar rotasyonu — bkz. Rust tarafındaki yorum). Önceden satılmış
  /// lisansların çalışmaya devam etmesi için eski anahtar da geçiş dönemi
  /// boyunca listede tutulur.
  static const List<String> _trustedPublicKeysHex = [
    '9830592b7b02e79c16efb19938343c9a826cb1bc0915098478e9c1e20d6bf925', // YENİ (2026-07-28+)
    '1ed139b3e243e880de672ddb1883933a4292489f70f1c647914f7919c19e30fe', // ESKİ (sızmıştı — yalnızca geçiş dönemi için)
  ];
  static const String _epoch = '2024-01-01';

  static Uint8List _publicKeyBytes(String hexRaw) {
    final hex = hexRaw.substring(0, 64);
    final out = Uint8List(32);
    for (var i = 0; i < 32; i++) {
      out[i] = int.parse(hex.substring(i * 2, i * 2 + 2), radix: 16);
    }
    return out;
  }

  static DateTime get epochDate => DateTime.parse(_epoch);

  /// Kod formatı hatalıysa veya imza doğrulanamıyorsa null döner (Windows'taki
  /// `Result<Payload, &'static str>` yerine burada null kullanılır — Dart'ta
  /// hata kodu ayrımı gerekmiyor, çağıran taraf yalnızca geçerli/geçersiz bilir).
  static LicensePayload? decodeAndVerify(String code) {
    final cleanedAll = code.toUpperCase().split('').where((c) {
      return RegExp(r'[A-Z0-9]').hasMatch(c);
    }).join();
    final cleaned = cleanedAll.startsWith('NVM') ? cleanedAll.substring(3) : cleanedAll;

    List<int> bytes;
    try {
      bytes = Base32NoPad.decode(cleaned);
    } catch (_) {
      return null;
    }
    if (bytes.length != 12 + 64) return null;

    final payload = Uint8List.fromList(bytes.sublist(0, 12));
    final sig = Uint8List.fromList(bytes.sublist(12));

    if (payload[0] != 1) return null;

    final valid = _trustedPublicKeysHex.any((hexRaw) {
      final publicKey = ed.PublicKey(_publicKeyBytes(hexRaw));
      return ed.verify(publicKey, payload, sig);
    });
    if (!valid) return null;

    final device = payload.sublist(1, 7);
    final plan = payload[7];
    final startDays = (payload[8] << 8) | payload[9];
    final endDays = (payload[10] << 8) | payload[11];

    return LicensePayload(device: device, plan: plan, startDays: startDays, endDays: endDays);
  }

  static Future<bool> deviceMatches(LicensePayload payload) async {
    final current = await DeviceId.hash();
    if (payload.device.length != current.length) return false;
    for (var i = 0; i < current.length; i++) {
      if (payload.device[i] != current[i]) return false;
    }
    return true;
  }

  static DateTime startDate(LicensePayload p) => epochDate.add(Duration(days: p.startDays));

  static bool get isUnlimited => false; // bkz. LicensePayload.endDays == 0xFFFF kontrolü çağıranda yapılır.

  static DateTime? endDate(LicensePayload p) {
    if (p.endDays == 0xFFFF) return null; // sınırsız
    return epochDate.add(Duration(days: p.endDays));
  }

  static String planLabel(LicensePayload p) =>
      p.plan >= 0 && p.plan < planLabels.length ? planLabels[p.plan] : 'Özel';
}
