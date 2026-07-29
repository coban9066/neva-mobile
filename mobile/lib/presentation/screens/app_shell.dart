import 'package:flutter/material.dart';

import 'dashboard/dashboard_screen.dart';
import 'kasa/kasa_screen.dart';
import 'more/more_screen.dart';
import 'phones/phones_screen.dart';

/// Ana uygulama iskeleti — alt gezinme çubuğu. Masaüstündeki sidebar'ın tüm
/// öğeleri Android'de karşılığını buluyor: Dashboard, Telefonlar ve Kasa
/// doğrudan sekme; Garanti/Bekleyen Ödemeler/Veri Yönetimi/Ayarlar dokunmatik
/// kullanımda daha doğal olan "Diğer" menüsünün altında (bkz. more_screen.dart).
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
    KasaScreen(),
    MoreScreen(),
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
          NavigationDestination(icon: Icon(Icons.point_of_sale_rounded), label: 'Kasa'),
          NavigationDestination(icon: Icon(Icons.more_horiz_rounded), label: 'Diğer'),
        ],
      ),
    );
  }
}
