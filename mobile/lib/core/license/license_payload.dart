/// Kod: NVM- + Base32(payload[12B] ‖ Ed25519 imza[64B]) — Windows license.rs
/// ile birebir aynı format. payload: version(1) device_hash(6) plan(1)
/// start_days(2,BE) end_days(2,BE).
class LicensePayload {
  final List<int> device; // 6 bayt
  final int plan;
  final int startDays;
  final int endDays;

  const LicensePayload({
    required this.device,
    required this.plan,
    required this.startDays,
    required this.endDays,
  });
}

const List<String> planLabels = ['Deneme', '1 Ay', '3 Ay', '6 Ay', '12 Ay', 'Sınırsız'];
