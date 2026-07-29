import 'package:flutter/material.dart';

import '../data_management/data_management_screen.dart';
import '../pending_payments/pending_payments_screen.dart';
import '../settings/settings_screen.dart';
import '../warranty/warranty_screen.dart';

/// Alt gezinme çubuğuna sığmayan ekranlar için merkez menü (masaüstündeki
/// sidebar'ın geri kalan öğeleri: Garanti, Bekleyen Ödemeler, Veri Yönetimi, Ayarlar).
class MoreScreen extends StatelessWidget {
  const MoreScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Diğer')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _MenuTile(
            icon: Icons.shield_rounded,
            title: 'Garanti Takibi',
            subtitle: 'Aktif garantili telefonlar',
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const WarrantyScreen()),
            ),
          ),
          _MenuTile(
            icon: Icons.hourglass_bottom_rounded,
            title: 'Bekleyen Ödemeler',
            subtitle: 'Tahsilat bekleyen satışlar',
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const PendingPaymentsScreen()),
            ),
          ),
          _MenuTile(
            icon: Icons.storage_rounded,
            title: 'Veri Yönetimi',
            subtitle: 'Yedekleme, geri yükleme, kayıt temizliği',
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const DataManagementScreen()),
            ),
          ),
          _MenuTile(
            icon: Icons.settings_rounded,
            title: 'Ayarlar',
            subtitle: 'Görünüm, lisans, hakkında',
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const SettingsScreen()),
            ),
          ),
        ],
      ),
    );
  }
}

class _MenuTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;
  const _MenuTile({required this.icon, required this.title, required this.subtitle, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: Theme.of(context).colorScheme.primaryContainer,
          child: Icon(icon, color: Theme.of(context).colorScheme.onPrimaryContainer),
        ),
        title: Text(title),
        subtitle: Text(subtitle),
        trailing: const Icon(Icons.chevron_right_rounded),
        onTap: onTap,
      ),
    );
  }
}
