import 'package:flutter/material.dart';

import '../../../core/utils/money.dart';
import '../../../data/repositories/phone_repository.dart';
import '../../../domain/models/phone.dart';
import 'phone_detail_screen.dart';
import 'purchase_screen.dart';

/// Masaüstü Phones.tsx'in mobil karşılığı: durum sekmeleri + iki arama kutusu
/// (genel + yalnızca Etiket No), kart listesi (tablo yerine — dokunmatikte
/// daha okunur).
class PhonesScreen extends StatefulWidget {
  const PhonesScreen({super.key});

  @override
  State<PhonesScreen> createState() => _PhonesScreenState();
}

class _PhonesScreenState extends State<PhonesScreen> {
  final _repo = PhoneRepository();
  final _searchCtrl = TextEditingController();
  final _tagCtrl = TextEditingController();
  String _tab = 'in_stock';
  List<PhoneRow> _phones = [];
  Map<String, int> _counts = {};
  bool _loading = true;

  static const _tabs = [
    ('in_stock', 'Stokta'),
    ('reserved', 'Rezerve'),
    ('consigned', 'Konsinye'),
    ('scrap', 'Hurda'),
    ('all', 'Tümü'),
  ];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final phones = await _repo.listPhones(
      tab: _tab,
      search: _searchCtrl.text,
      tagSearch: _tagCtrl.text,
    );
    final counts = await _repo.statusCounts();
    if (mounted) {
      setState(() {
        _phones = phones;
        _counts = counts;
        _loading = false;
      });
    }
  }

  int _countOf(String key) {
    if (key == 'all') return _counts.values.fold(0, (s, n) => s + n);
    return _counts[key] ?? 0;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Telefonlar')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
            child: Row(
              children: [
                Expanded(
                  flex: 3,
                  child: TextField(
                    controller: _searchCtrl,
                    decoration: const InputDecoration(
                      isDense: true,
                      prefixIcon: Icon(Icons.search_rounded, size: 20),
                      hintText: 'Bu listede ara…',
                    ),
                    onChanged: (_) => _load(),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  flex: 2,
                  child: TextField(
                    controller: _tagCtrl,
                    decoration: const InputDecoration(
                      isDense: true,
                      prefixIcon: Icon(Icons.label_outline_rounded, size: 20),
                      hintText: 'Etiket No ile Ara…',
                    ),
                    onChanged: (_) => _load(),
                  ),
                ),
              ],
            ),
          ),
          SizedBox(
            height: 44,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 8),
              children: _tabs.map((t) {
                final selected = _tab == t.$1;
                return Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
                  child: ChoiceChip(
                    label: Text('${t.$2} (${_countOf(t.$1)})'),
                    selected: selected,
                    onSelected: (_) {
                      setState(() => _tab = t.$1);
                      _load();
                    },
                  ),
                );
              }).toList(),
            ),
          ),
          const Divider(height: 1),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _phones.isEmpty
                    ? const Center(child: Text('Bu durumda telefon yok'))
                    : RefreshIndicator(
                        onRefresh: _load,
                        child: ListView.builder(
                          padding: const EdgeInsets.all(8),
                          itemCount: _phones.length,
                          itemBuilder: (context, i) => _PhoneCard(
                            phone: _phones[i],
                            onTap: () async {
                              await Navigator.of(context).push(
                                MaterialPageRoute(
                                  builder: (_) => PhoneDetailScreen(phoneId: _phones[i].id),
                                ),
                              );
                              _load();
                            },
                          ),
                        ),
                      ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        icon: const Icon(Icons.add_rounded),
        label: const Text('Telefon Al'),
        onPressed: () async {
          await Navigator.of(context).push(
            MaterialPageRoute(builder: (_) => const PurchaseScreen()),
          );
          _load();
        },
      ),
    );
  }
}

class _PhoneCard extends StatelessWidget {
  final PhoneRow phone;
  final VoidCallback onTap;
  const _PhoneCard({required this.phone, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 4),
      child: ListTile(
        onTap: onTap,
        title: Text(phone.title.isEmpty ? 'Telefon #${phone.id}' : phone.title),
        subtitle: Text(
          [
            if (phone.storageGb != null) '${phone.storageGb}GB',
            if (phone.color != null) phone.color!,
            if (phone.imei1 != null) '…${phone.imei1!.substring(phone.imei1!.length > 6 ? phone.imei1!.length - 6 : 0)}',
            if (phone.etiketNumarasi != null) 'Etiket: ${phone.etiketNumarasi}',
          ].join(' · '),
        ),
        trailing: Text(
          formatKurus(phone.totalCost),
          style: const TextStyle(fontWeight: FontWeight.bold),
        ),
      ),
    );
  }
}
