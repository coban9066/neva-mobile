import 'package:sqflite/sqflite.dart';

import '../../core/database/database_helper.dart';
import '../../core/license/device_id.dart';
import '../../core/license/license_service.dart';

enum LicenseState { none, invalid, deviceMismatch, expired, valid }

class LicenseStatus {
  final LicenseState state;
  final String deviceId;
  final String? planLabel;
  final String? startDate;
  final String? endDate;
  final int? daysLeft;
  final String? maskedCode;

  LicenseStatus({
    required this.state,
    required this.deviceId,
    this.planLabel,
    this.startDate,
    this.endDate,
    this.daysLeft,
    this.maskedCode,
  });
}

/// Windows license.rs `evaluate`/`activate`/`ensure_writable` ile aynı iş
/// mantığı. Saat-geri-alma korumasının AppData HMAC-guard dosyası eşdeğeri
/// bu ilk sürümde yok — yalnızca DB'deki `license_last_seen` ile temel
/// monotonluk kontrolü yapılır (bkz. mimari raporu, "sonraki adımlar").
class LicenseRepository {
  Future<String?> _setting(String key) async {
    final db = await DatabaseHelper.instance.database;
    final rows = await db.query('settings', where: 'key = ?', whereArgs: [key]);
    return rows.isEmpty ? null : rows.first['value'] as String;
  }

  Future<void> _setSetting(String key, String value) async {
    final db = await DatabaseHelper.instance.database;
    await db.insert(
      'settings',
      {'key': key, 'value': value},
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  String _maskCode(String code) {
    if (code.length <= 12) return '•••';
    return '${code.substring(0, 8)}…${code.substring(code.length - 4)}';
  }

  Future<LicenseStatus> evaluate() async {
    final deviceId = await DeviceId.display();
    final code = await _setting('license_code');
    if (code == null) {
      return LicenseStatus(state: LicenseState.none, deviceId: deviceId);
    }

    final payload = LicenseService.decodeAndVerify(code);
    if (payload == null) {
      return LicenseStatus(state: LicenseState.invalid, deviceId: deviceId);
    }
    if (!await LicenseService.deviceMatches(payload)) {
      return LicenseStatus(state: LicenseState.deviceMismatch, deviceId: deviceId);
    }

    final now = DateTime.now();
    final lastSeenRaw = await _setting('license_last_seen');
    final lastSeen = lastSeenRaw == null ? null : DateTime.tryParse(lastSeenRaw);
    final rollback = lastSeen != null && lastSeen.difference(now).inHours > 24;
    if (rollback) {
      return LicenseStatus(state: LicenseState.invalid, deviceId: deviceId);
    }
    final newSeen = lastSeen == null || now.isAfter(lastSeen) ? now : lastSeen;
    await _setSetting('license_last_seen', newSeen.toIso8601String());

    final end = LicenseService.endDate(payload);
    final unlimited = end == null;
    final daysLeft = unlimited ? null : end.difference(DateTime(now.year, now.month, now.day)).inDays;
    final expired = !unlimited && DateTime(now.year, now.month, now.day).isAfter(end);

    return LicenseStatus(
      state: expired ? LicenseState.expired : LicenseState.valid,
      deviceId: deviceId,
      planLabel: LicenseService.planLabel(payload),
      startDate: _fmt(LicenseService.startDate(payload)),
      endDate: unlimited ? 'Sınırsız' : _fmt(end),
      daysLeft: daysLeft,
      maskedCode: _maskCode(code),
    );
  }

  Future<LicenseStatus> activate(String code) async {
    final trimmed = code.trim().toUpperCase();
    final payload = LicenseService.decodeAndVerify(trimmed);
    if (payload == null) {
      throw StateError('Lisans kodu geçersiz.');
    }
    if (!await LicenseService.deviceMatches(payload)) {
      final deviceId = await DeviceId.display();
      throw StateError('Bu kod başka bir cihaza ait. Bu cihazın Device ID\'si: $deviceId');
    }
    await _setSetting('license_code', trimmed);
    final status = await evaluate();
    if (status.state == LicenseState.expired) {
      throw StateError('Kod doğru ancak lisans süresi geçmiş görünüyor.');
    }
    return status;
  }

  Future<void> ensureWritable() async {
    final status = await evaluate();
    switch (status.state) {
      case LicenseState.valid:
        return;
      case LicenseState.expired:
        throw StateError('Lisans süresi doldu — salt okunur mod. Yenilemek için Device ID\'nizi gönderin.');
      default:
        throw StateError('Geçerli lisans bulunamadı.');
    }
  }

  String _fmt(DateTime d) =>
      '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
}
