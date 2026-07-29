import 'package:flutter/material.dart';

import '../../../data/repositories/warranty_repository.dart';
import '../phones/phone_detail_screen.dart';

class WarrantyScreen extends StatefulWidget {
  final bool soonOnly;
  const WarrantyScreen({super.key, this.soonOnly = false});

  @override
  State<WarrantyScreen> createState() => _WarrantyScreenState();
}

class _WarrantyScreenState extends State<WarrantyScreen> {
  final _repo = WarrantyRepository();
  List<WarrantyRow> _rows = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final rows = await _repo.list(soonOnly: widget.soonOnly);
    if (!mounted) return;
    setState(() {
      _rows = rows;
      _loading = false;
    });
  }

  Color _tone(int days) {
    if (days < 7) return Colors.red;
    if (days < 30) return Colors.orange;
    return Colors.green;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.soonOnly ? 'Yakında Bitecek Garantiler' : 'Garanti Takibi')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: _rows.isEmpty
                  ? ListView(
                      children: [
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 64),
                          child: Center(
                            child: Text(
                              widget.soonOnly
                                  ? '30 gün içinde bitecek garanti yok.'
                                  : 'Aktif garantili telefon yok.',
                            ),
                          ),
                        ),
                      ],
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.all(16),
                      itemCount: _rows.length,
                      itemBuilder: (context, i) {
                        final r = _rows[i];
                        final color = _tone(r.remainingDays);
                        return Card(
                          margin: const EdgeInsets.only(bottom: 8),
                          child: ListTile(
                            onTap: () => Navigator.of(context).push(
                              MaterialPageRoute(builder: (_) => PhoneDetailScreen(phoneId: r.phoneId)),
                            ),
                            title: Text(r.label),
                            subtitle: Text(r.imei1 ?? 'IMEI girilmemiş'),
                            trailing: Chip(
                              label: Text(r.formattedSpan, style: TextStyle(color: color)),
                              backgroundColor: color.withValues(alpha: 0.12),
                              side: BorderSide(color: color.withValues(alpha: 0.4)),
                            ),
                          ),
                        );
                      },
                    ),
            ),
    );
  }
}
