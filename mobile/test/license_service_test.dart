import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/license/base32.dart';
import 'package:mobile/core/license/license_service.dart';

void main() {
  group('Base32NoPad', () {
    test('decodes a known RFC 4648 vector (no padding)', () {
      // "f" -> "MY======" (padded) -> "MY" (no-pad); tek bayt: 0x66.
      final bytes = Base32NoPad.decode('MY');
      expect(bytes, [0x66]);
    });

    test('decodes multi-byte vector', () {
      // "foobar" -> Base32 (RFC 4648) = "MZXW6YTBOI======" -> no-pad "MZXW6YTBOI"
      final bytes = Base32NoPad.decode('MZXW6YTBOI');
      expect(String.fromCharCodes(bytes), 'foobar');
    });
  });

  group('LicenseService.decodeAndVerify', () {
    test('valid Windows-issued code passes Ed25519 signature verification', () {
      // license.rs test_valid_license ile aynı kod — Windows tarafında zaten
      // geçerli olduğu doğrulanmış. Cihaz eşleşmesi burada test edilmiyor
      // (bu kod farklı bir cihaz için üretilmişti); yalnızca Base32 çözme +
      // Ed25519 imza doğrulamasının Android tarafında da BİREBİR aynı sonucu
      // verdiği doğrulanıyor — kriptografik portun doğruluğu için asıl kanıt bu.
      const code =
          'NVM-AFT4U-RYR6J-ZQCA4-WAO2D-4JAT2-TDQM3-YAJJY-IFD2M-DKE2Z-SDNZY-4BZYQ-N5D2K-RMTNX-7OFBB-JAFZX-SZEYY-IMGJ6-T2JBK-TO5US-V5J55-TYFVM-DGJ2F-Q5WEA-55KMZ-BU';
      final payload = LicenseService.decodeAndVerify(code);
      expect(payload, isNotNull, reason: 'İmza doğrulaması başarısız oldu — Base32/Ed25519 portunda hata var.');
    });

    test('new-key-issued code (post 2026-07-28 rotation) also verifies', () {
      // license.rs test_valid_license_new_key ile aynı kod — anahtar rotasyonu
      // sonrası üretilen kodların da Android tarafında doğrulandığını kanıtlar.
      const code =
          'NVM-AEDOS-OFAFA-IAKA5-M777Y-N4E4Q-5RTU7-DVQYE-2XLPC-BWTFU-M4NSA-S7CLK-OU6CV-EW6E2-RHNE6-DLC54-4LCBU-YBQ67-33RHH-ES3MA-I4TWY-WQOTE-WNVXQ-JZJVC-436OP-AA';
      final payload = LicenseService.decodeAndVerify(code);
      expect(payload, isNotNull, reason: 'Yeni anahtarla imzalanmış kod doğrulanamadı.');
    });

    test('garbage code fails gracefully (returns null, does not throw)', () {
      final payload = LicenseService.decodeAndVerify('NVM-NOT-A-REAL-CODE');
      expect(payload, isNull);
    });

    test('empty code fails gracefully', () {
      expect(LicenseService.decodeAndVerify(''), isNull);
    });
  });
}
