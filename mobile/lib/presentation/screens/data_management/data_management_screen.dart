import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../data/repositories/backup_repository.dart';

class DataManagementScreen extends StatefulWidget {
  const DataManagementScreen({super.key});

  @override
  State<DataManagementScreen> createState() => _DataManagementScreenState();
}

class _DataManagementScreenState extends State<DataManagementScreen> {
  final _repo = BackupRepository();
  bool _busy = false;

  Future<void> _backup() async {
    setState(() => _busy = true);
    try {
      final bytes = await _repo.exportBackupBytes();
      final name = 'NEVA-YEDEK-${DateFormat('dd-MM-yyyy').format(DateTime.now())}.nevabackup';
      final path = await FilePicker.platform.saveFile(fileName: name, bytes: bytes);
      if (mounted && path != null) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Yedek kaydedildi.')));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Yedekleme başarısız: $e')));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _restore() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Yedeği Geri Yükle'),
        content: const Text(
          'Bu işlem mevcut tüm verilerin üzerine seçtiğiniz yedeği yazacak. '
          'Devam etmeden önce güncel bir yedek aldığınızdan emin olun. Devam edilsin mi?',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Vazgeç')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Devam Et')),
        ],
      ),
    );
    if (confirmed != true) return;

    final result = await FilePicker.platform.pickFiles(
      type: FileType.any,
      dialogTitle: 'Yedek Dosyası Seç (.nevabackup)',
    );
    final path = result?.files.single.path;
    if (path == null) return;

    setState(() => _busy = true);
    try {
      await _repo.restoreFromFile(path);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Yedek geri yüklendi. Uygulama yeniden başlatılıyor…')),
        );
        await Future.delayed(const Duration(milliseconds: 900));
        // sqflite bağlantısı DatabaseHelper.close() ile zaten kapatıldı;
        // sonraki ekran açılışında yeni dosya otomatik yeniden açılır.
        if (mounted) Navigator.of(context).popUntil((r) => r.isFirst);
      }
    } on RestoreValidationError catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Geri yükleme başarısız: $e')));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _purge(String kind, String kindLabel) async {
    // -1: "Tümü" seçildi (sınırsız); null: kullanıcı henüz seçim yapmadan kapattı.
    const allSentinel = -1;
    final selection = await showDialog<int>(
      context: context,
      builder: (context) {
        int? selected = allSentinel;
        return StatefulBuilder(
          builder: (context, setDlgState) => AlertDialog(
            title: Text('$kindLabel Kayıtlarını Temizle'),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                RadioListTile<int>(
                  title: const Text('90 günden eski'),
                  value: 90,
                  groupValue: selected,
                  onChanged: (v) => setDlgState(() => selected = v),
                ),
                RadioListTile<int>(
                  title: const Text('365 günden eski'),
                  value: 365,
                  groupValue: selected,
                  onChanged: (v) => setDlgState(() => selected = v),
                ),
                RadioListTile<int>(
                  title: const Text('Tümü'),
                  value: allSentinel,
                  groupValue: selected,
                  onChanged: (v) => setDlgState(() => selected = v),
                ),
              ],
            ),
            actions: [
              TextButton(onPressed: () => Navigator.pop(context), child: const Text('Vazgeç')),
              FilledButton(
                onPressed: () => Navigator.pop(context, selected),
                child: const Text('Temizle'),
              ),
            ],
          ),
        );
      },
    );
    if (selection == null) return; // kullanıcı vazgeçti
    final days = selection == allSentinel ? null : selection;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Emin misiniz?'),
        content: Text(
          '$kindLabel kayıtları kalıcı olarak silinecek. '
          '${kind == 'sales' ? 'Telefonların kendisi stokta kalır, yalnızca satış geçmişi silinir.' : 'Başka bir alışa/satışa bağlı olmayan telefonlar tamamen silinir.'}',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Vazgeç')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Sil'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    setState(() => _busy = true);
    try {
      final count = await _repo.purgeRecords(kind: kind, olderThanDays: days);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$count kayıt silindi.')));
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Hata: $e')));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Veri Yönetimi')),
      body: AbsorbPointer(
        absorbing: _busy,
        child: Stack(
          children: [
            ListView(
              padding: const EdgeInsets.all(16),
              children: [
                _SectionCard(
                  title: 'Yedekleme',
                  children: [
                    ListTile(
                      leading: const Icon(Icons.backup_rounded),
                      title: const Text('Yedek Al'),
                      subtitle: const Text('Veritabanınızı .nevabackup dosyası olarak kaydedin'),
                      onTap: _backup,
                    ),
                    ListTile(
                      leading: const Icon(Icons.restore_rounded),
                      title: const Text('Yedekten Geri Yükle'),
                      subtitle: const Text('Mevcut verilerin üzerine bir yedeği geri yükler'),
                      onTap: _restore,
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                _SectionCard(
                  title: 'Kayıt Temizliği',
                  children: [
                    ListTile(
                      leading: const Icon(Icons.receipt_long_rounded),
                      title: const Text('Satış Kayıtlarını Temizle'),
                      onTap: () => _purge('sales', 'Satış'),
                    ),
                    ListTile(
                      leading: const Icon(Icons.shopping_bag_rounded),
                      title: const Text('Alış Kayıtlarını Temizle'),
                      subtitle: const Text('Yalnızca satılmamış alışlar silinebilir'),
                      onTap: () => _purge('purchases', 'Alış'),
                    ),
                  ],
                ),
              ],
            ),
            if (_busy) const Center(child: CircularProgressIndicator()),
          ],
        ),
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  final String title;
  final List<Widget> children;
  const _SectionCard({required this.title, required this.children});

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
        ],
      ),
    );
  }
}
