/// RFC 4648 Base32 (padding'siz) çözücü — Windows tarafındaki
/// `data_encoding::BASE32_NOPAD` ile bit-bit aynı sonucu üretir.
/// Yalnızca decode gerekir; lisans kodları her zaman NEVA LICENSE MANAGER
/// (Windows) tarafından üretilir, Android yalnızca doğrular.
class Base32NoPad {
  static const String _alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

  static List<int> decode(String input) {
    final output = <int>[];
    int bitBuffer = 0;
    int bitCount = 0;

    for (final rune in input.toUpperCase().codeUnits) {
      final ch = String.fromCharCode(rune);
      final value = _alphabet.indexOf(ch);
      if (value == -1) {
        throw FormatException('Geçersiz Base32 karakteri: $ch');
      }
      bitBuffer = (bitBuffer << 5) | value;
      bitCount += 5;
      if (bitCount >= 8) {
        bitCount -= 8;
        output.add((bitBuffer >> bitCount) & 0xFF);
      }
    }
    return output;
  }
}
