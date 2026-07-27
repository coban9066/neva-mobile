/// Masaüstündeki PhoneStatus/PhoneRow (types.ts) ile aynı sözleşme.
enum PhoneStatus { inStock, reserved, sold, returned, scrap, consigned }

extension PhoneStatusX on PhoneStatus {
  String get dbValue => switch (this) {
        PhoneStatus.inStock => 'in_stock',
        PhoneStatus.reserved => 'reserved',
        PhoneStatus.sold => 'sold',
        PhoneStatus.returned => 'returned',
        PhoneStatus.scrap => 'scrap',
        PhoneStatus.consigned => 'consigned',
      };

  String get label => switch (this) {
        PhoneStatus.inStock => 'Stokta',
        PhoneStatus.reserved => 'Rezerve',
        PhoneStatus.sold => 'Satıldı',
        PhoneStatus.returned => 'İade',
        PhoneStatus.scrap => 'Hurda',
        PhoneStatus.consigned => 'Konsinye',
      };

  static PhoneStatus fromDb(String v) => switch (v) {
        'in_stock' => PhoneStatus.inStock,
        'reserved' => PhoneStatus.reserved,
        'sold' => PhoneStatus.sold,
        'returned' => PhoneStatus.returned,
        'scrap' => PhoneStatus.scrap,
        'consigned' => PhoneStatus.consigned,
        _ => PhoneStatus.inStock,
      };
}

const List<String> cosmeticGrades = ['Sıfır', 'Sıfır Gibi', 'İyi', 'Normal', 'Temiz Kullanılmış'];

enum Region { domestic, import }

extension RegionX on Region {
  String get dbValue => this == Region.domestic ? 'domestic' : 'import';
  String get label => this == Region.domestic ? '🇹🇷 Yurt İçi' : '🌍 Yurt Dışı';
}

class PhoneRow {
  final int id;
  final String? imei1;
  final String? imei2;
  final String? brandName;
  final String? modelName;
  final String? color;
  final int? storageGb;
  final String? cosmeticGrade;
  final int? batteryHealth;
  final PhoneStatus status;
  final Region? region;
  final int? totalCost;
  final String? etiketNumarasi;
  final String? notes;
  final String? warrantyUntil;

  PhoneRow({
    required this.id,
    this.imei1,
    this.imei2,
    this.brandName,
    this.modelName,
    this.color,
    this.storageGb,
    this.cosmeticGrade,
    this.batteryHealth,
    required this.status,
    this.region,
    this.totalCost,
    this.etiketNumarasi,
    this.notes,
    this.warrantyUntil,
  });

  factory PhoneRow.fromMap(Map<String, Object?> m) => PhoneRow(
        id: m['id'] as int,
        imei1: m['imei1'] as String?,
        imei2: m['imei2'] as String?,
        brandName: m['brand_name'] as String?,
        modelName: m['model_name'] as String?,
        color: m['color'] as String?,
        storageGb: m['storage_gb'] as int?,
        cosmeticGrade: m['cosmetic_grade'] as String?,
        batteryHealth: m['battery_health'] as int?,
        status: PhoneStatusX.fromDb(m['status'] as String),
        region: m['region'] == null
            ? null
            : (m['region'] == 'domestic' ? Region.domestic : Region.import),
        totalCost: m['total_cost'] as int?,
        etiketNumarasi: m['etiket_numarasi'] as String?,
        notes: m['notes'] as String?,
        warrantyUntil: m['warranty_until'] as String?,
      );

  String get title => '${brandName ?? ''} ${modelName ?? ''}'.trim();
}

class Brand {
  final int id;
  final String name;
  Brand({required this.id, required this.name});
  factory Brand.fromMap(Map<String, Object?> m) =>
      Brand(id: m['id'] as int, name: m['name'] as String);
}
