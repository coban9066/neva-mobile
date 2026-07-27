import 'package:flutter/material.dart';

import 'dashboard/dashboard_screen.dart';
import 'phones/phones_screen.dart';

/// Ana uygulama iskeleti — alt gezinme çubuğu. Faz 1 kapsamı: Dashboard ve
/// Telefonlar (Alış/Satış/Düzenle bunların içinden açılır). Kasa, Garanti,
/// Bekleyen Ödemeler, Veri Yönetimi ve Ayarlar sonraki fazlarda eklenecek
/// sekmelerdir (bkz. mimari raporu).
class AppShell extends StatefulWidget {
  const AppShell({super.key});

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  int _index = 0;

  static const _screens = [
    DashboardScreen(),
    PhonesScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(index: _index, children: _screens),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.dashboard_rounded), label: 'Dashboard'),
          NavigationDestination(icon: Icon(Icons.smartphone_rounded), label: 'Telefonlar'),
        ],
      ),
    );
  }
}
