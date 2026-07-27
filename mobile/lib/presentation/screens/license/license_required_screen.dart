import 'package:flutter/material.dart';

import '../../../data/repositories/license_repository.dart';
import 'activation_screen.dart';

/// Deneme/lisans süresi dolduğunda tam ekran uyarı. Veri SİLİNMEZ; geçerli bir
/// kod girilir girilmez uygulama valid duruma döner (masaüstü LicenseRequired.tsx ile aynı).
class LicenseRequiredScreen extends StatelessWidget {
  final LicenseStatus status;
  final VoidCallback onActivated;
  const LicenseRequiredScreen({super.key, required this.status, required this.onActivated});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Icon(Icons.lock_clock_rounded, size: 56, color: Theme.of(context).colorScheme.error),
                  const SizedBox(height: 12),
                  Text(
                    'Lisans Süresi Doldu',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Verileriniz güvende — hiçbir kayıt silinmedi. Devam etmek için '
                    'yeni bir lisans kodu girin.',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                  const SizedBox(height: 20),
                  FilledButton(
                    onPressed: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => ActivationScreen(status: status, onActivated: onActivated),
                        ),
                      );
                    },
                    child: const Padding(
                      padding: EdgeInsets.symmetric(vertical: 12),
                      child: Text('Lisans Kodu Gir'),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
