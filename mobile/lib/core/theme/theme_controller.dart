import 'package:flutter/material.dart';

import '../../data/repositories/settings_repository.dart';

/// Masaüstü tema tercihinin (useUi().theme) Android karşılığı — settings
/// tablosunda 'theme_mode' anahtarıyla kalıcı ('light' | 'dark' | 'system').
class ThemeController {
  ThemeController._();
  static final ThemeController instance = ThemeController._();

  final ValueNotifier<ThemeMode> mode = ValueNotifier(ThemeMode.system);
  final _repo = SettingsRepository();

  Future<void> load() async {
    final v = await _repo.get('theme_mode');
    mode.value = switch (v) {
      'light' => ThemeMode.light,
      'dark' => ThemeMode.dark,
      _ => ThemeMode.system,
    };
  }

  Future<void> setMode(ThemeMode m) async {
    mode.value = m;
    await _repo.set('theme_mode', switch (m) {
      ThemeMode.light => 'light',
      ThemeMode.dark => 'dark',
      ThemeMode.system => 'system',
    });
  }
}
