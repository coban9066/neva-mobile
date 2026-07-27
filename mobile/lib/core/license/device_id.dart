import 'dart:convert';
import 'package:crypto/crypto.dart';
import 'package:flutter/services.dart';

/// Windows tarafındaki `device_hash()` ile birebir aynı türetme:
/// SHA256(cihaz_kimliği_utf8 + "NEVA-MOBILE")[0..6].
/// Windows: cihaz kimliği = HKLM\SOFTWARE\Microsoft\Cryptography\MachineGuid.
/// Android: cihaz kimliği = Settings.Secure.ANDROID_ID (uygulama+imza+kullanıcı
/// başına sabit; fabrika ayarlarına dönüşte değişir — Windows'taki MachineGuid'in
/// pratikteki en yakın Android karşılığı budur). Okuma, MainActivity.kt'deki
/// küçük bir MethodChannel üzerinden yapılır (üçüncü parti paket bağımlılığı
/// yerine — bkz. pubspec.yaml notu).
class DeviceId {
  static const _channel = MethodChannel('com.nevamobile.mobile/device');
  static String? _cachedAndroidId;

  static Future<String> _rawId() async {
    if (_cachedAndroidId != null) return _cachedAndroidId!;
    String id;
    try {
      id = (await _channel.invokeMethod<String>('getAndroidId')) ?? 'fallback-android-device';
    } on PlatformException {
      id = 'fallback-android-device';
    } on MissingPluginException {
      id = 'fallback-android-device';
    }
    _cachedAndroidId = id;
    return id;
  }

  /// 6 baytlık cihaz özeti (lisans kodu payload'ındaki `device` alanıyla karşılaştırılır).
  static Future<List<int>> hash() async {
    final raw = await _rawId();
    final bytes = utf8.encode(raw) + utf8.encode('NEVA-MOBILE');
    final digest = sha256.convert(bytes);
    return digest.bytes.sublist(0, 6);
  }

  /// Kullanıcıya gösterilen / satıcıya iletilen Device ID.
  /// Örnek: "ANDROID-1A2B3C4D5E6F" (Windows'taki "NVM-XXXX-XXXX-XXXX" formatının
  /// Android karşılığı — tire yok, tek blok halinde, kullanıcı isteğiyle sabitlendi).
  static Future<String> display() async {
    final h = await hash();
    final hex = h.map((b) => b.toRadixString(16).padLeft(2, '0').toUpperCase()).join();
    return 'ANDROID-$hex';
  }
}
