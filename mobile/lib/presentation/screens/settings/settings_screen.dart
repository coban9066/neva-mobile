import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:package_info_plus/package_info_plus.dart';

import '../../../core/theme/theme_controller.dart';
import '../../../data/repositories/license_repository.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final _licenseRepo = LicenseRepository();
  LicenseStatus? _license;
  PackageInfo? _packageInfo;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final license = await _licenseRepo.evaluate();
    final info = await PackageInfo.fromPlatform();
    if (mounted) {
      setState(() {
        _license = license;
        _packageInfo = info;
      });
    }
  }

  Future<void> _updateLicense() async {
    final ctrl = TextEditingController();
    final code = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Lisansı Güncelle'),
        content: TextField(
          controller: ctrl,
          autofocus: true,
          maxLines: 3,
          decoration: const InputDecoration(hintText: 'NVM-XXXX-XXXX-XXXX...'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Vazgeç')),
          FilledButton(onPressed: () => Navigator.pop(context, ctrl.text), child: const Text('Aktifleştir')),
        ],
      ),
    );
    if (code == null || code.trim().isEmpty) return;
    try {
      await _licenseRepo.activate(code);
      _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Lisans güncellendi.')));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.toString().replaceFirst('StateError: ', ''))));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final license = _license;
    return Scaffold(
      appBar: AppBar(title: const Text('Ayarlar')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _Section(
            title: 'Görünüm',
            children: [
              ValueListenableBuilder<ThemeMode>(
                valueListenable: ThemeController.instance.mode,
                builder: (context, mode, _) => Column(
                  children: [
                    RadioListTile<ThemeMode>(
                      title: const Text('Sistem'),
                      value: ThemeMode.system,
                      groupValue: mode,
                      onChanged: (v) => ThemeController.instance.setMode(v!),
                    ),
                    RadioListTile<ThemeMode>(
                      title: const Text('Açık'),
                      value: ThemeMode.light,
                      groupValue: mode,
                      onChanged: (v) => ThemeController.instance.setMode(v!),
                    ),
                    RadioListTile<ThemeMode>(
                      title: const Text('Koyu'),
                      value: ThemeMode.dark,
                      groupValue: mode,
                      onChanged: (v) => ThemeController.instance.setMode(v!),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          _Section(
            title: 'Lisans',
            children: license == null
                ? [const ListTile(title: Text('Yükleniyor…'))]
                : [
                    _InfoRow('Durum', license.state == LicenseState.valid ? 'Geçerli' : license.state.name),
                    if (license.planLabel != null) _InfoRow('Lisans Türü', license.planLabel!),
                    if (license.startDate != null) _InfoRow('Başlangıç', license.startDate!),
                    if (license.endDate != null) _InfoRow('Bitiş', license.endDate!),
                    if (license.daysLeft != null) _InfoRow('Kalan Gün', '${license.daysLeft}'),
                    if (license.maskedCode != null) _InfoRow('Lisans Kodu', license.maskedCode!),
                    ListTile(
                      title: const Text('Device ID'),
                      subtitle: Text(license.deviceId, style: const TextStyle(fontFamily: 'monospace')),
                      trailing: IconButton(
                        icon: const Icon(Icons.copy_rounded, size: 18),
                        onPressed: () {
                          Clipboard.setData(ClipboardData(text: license.deviceId));
                          ScaffoldMessenger.of(context)
                              .showSnackBar(const SnackBar(content: Text('Kopyalandı.')));
                        },
                      ),
                    ),
                    ListTile(
                      leading: const Icon(Icons.vpn_key_rounded),
                      title: const Text('Lisansı Güncelle'),
                      onTap: _updateLicense,
                    ),
                  ],
          ),
          const SizedBox(height: 12),
          _Section(
            title: 'Hakkında',
            children: [
              const ListTile(title: Text('NEVA MOBILE'), subtitle: Text('Telefon Alım Satım Yönetim Sistemi')),
              if (_packageInfo != null)
                _InfoRow('Sürüm', '${_packageInfo!.version} (${_packageInfo!.buildNumber})'),
              _InfoRow('Telif Hakkı', '© ${DateTime.now().year} NEVA MOBILE'),
            ],
          ),
        ],
      ),
    );
  }
}

class _Section extends StatelessWidget {
  final String title;
  final List<Widget> children;
  const _Section({required this.title, required this.children});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
            child: Text(title, style: Theme.of(context).textTheme.titleMedium),
          ),
          ...children,
          const SizedBox(height: 4),
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final String label;
  final String value;
  const _InfoRow(this.label, this.value);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant)),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}
