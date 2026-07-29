import 'package:flutter/material.dart';

import 'core/theme/app_theme.dart';
import 'core/theme/theme_controller.dart';
import 'data/repositories/license_repository.dart';
import 'presentation/screens/license/activation_screen.dart';
import 'presentation/screens/license/license_required_screen.dart';
import 'presentation/screens/app_shell.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await ThemeController.instance.load();
  runApp(const NevaMobileApp());
}

class NevaMobileApp extends StatelessWidget {
  const NevaMobileApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<ThemeMode>(
      valueListenable: ThemeController.instance.mode,
      builder: (context, mode, _) => MaterialApp(
        title: 'NEVA MOBILE',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.light(),
        darkTheme: AppTheme.dark(),
        themeMode: mode,
        home: const LicenseGate(),
      ),
    );
  }
}

/// Masaüstü LicenseGate (App.tsx) ile aynı akış:
/// none/invalid/deviceMismatch → Aktivasyon ekranı
/// expired → Lisans Gerekli tam ekranı (veri silinmez, kod girilince valid olur)
/// valid → ana uygulama (AppShell)
class LicenseGate extends StatefulWidget {
  const LicenseGate({super.key});

  @override
  State<LicenseGate> createState() => _LicenseGateState();
}

class _LicenseGateState extends State<LicenseGate> {
  final _repo = LicenseRepository();
  LicenseStatus? _status;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final status = await _repo.evaluate();
    if (mounted) setState(() => _status = status);
  }

  @override
  Widget build(BuildContext context) {
    final status = _status;
    if (status == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    switch (status.state) {
      case LicenseState.none:
      case LicenseState.invalid:
      case LicenseState.deviceMismatch:
        return ActivationScreen(status: status, onActivated: _load);
      case LicenseState.expired:
        return LicenseRequiredScreen(status: status, onActivated: _load);
      case LicenseState.valid:
        return const AppShell();
    }
  }
}
