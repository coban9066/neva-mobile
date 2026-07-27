import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../data/repositories/license_repository.dart';

/// Cihaz kimliğini gösterir, satıcıdan alınan lisans kodunun girilmesini sağlar.
/// Masaüstü Activation.tsx ile aynı akış, dokunmatik arayüze uyarlanmış.
class ActivationScreen extends StatefulWidget {
  final LicenseStatus status;
  final VoidCallback onActivated;
  const ActivationScreen({super.key, required this.status, required this.onActivated});

  @override
  State<ActivationScreen> createState() => _ActivationScreenState();
}

class _ActivationScreenState extends State<ActivationScreen> {
  final _repo = LicenseRepository();
  final _codeCtrl = TextEditingController();
  bool _submitting = false;
  String? _error;

  Future<void> _activate() async {
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      await _repo.activate(_codeCtrl.text);
      widget.onActivated();
    } catch (e) {
      setState(() => _error = e.toString().replaceFirst('StateError: ', ''));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

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
                  Icon(Icons.smartphone_rounded, size: 56, color: Theme.of(context).colorScheme.primary),
                  const SizedBox(height: 12),
                  Text(
                    'NEVA MOBILE',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Lisans Aktivasyonu',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                  const SizedBox(height: 24),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Cihaz Kimliği', style: Theme.of(context).textTheme.labelMedium),
                          const SizedBox(height: 6),
                          Row(
                            children: [
                              Expanded(
                                child: SelectableText(
                                  widget.status.deviceId,
                                  style: const TextStyle(fontFamily: 'monospace', fontSize: 15),
                                ),
                              ),
                              IconButton(
                                icon: const Icon(Icons.copy_rounded, size: 18),
                                onPressed: () {
                                  Clipboard.setData(ClipboardData(text: widget.status.deviceId));
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(content: Text('Cihaz kimliği kopyalandı')),
                                  );
                                },
                              ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'Bu kimliği satıcınıza iletin; size bir lisans kodu üretilecek.',
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: _codeCtrl,
                    minLines: 3,
                    maxLines: 5,
                    style: const TextStyle(fontFamily: 'monospace', fontSize: 13),
                    decoration: const InputDecoration(
                      labelText: 'Lisans Kodu',
                      hintText: 'NVM-...',
                    ),
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 8),
                    Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
                  ],
                  const SizedBox(height: 16),
                  FilledButton(
                    onPressed: _submitting ? null : _activate,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      child: _submitting
                          ? const SizedBox(
                              height: 18,
                              width: 18,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Text('Etkinleştir'),
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
