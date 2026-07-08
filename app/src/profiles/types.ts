/**
 * Brand Profile Registry — marka bazlı akıllı form tanımları.
 *
 * Her profil; gösterilecek kalite kontrollerini, pil sağlığı alanının
 * görünürlüğünü ve badge üretimini tanımlar. Yeni marka eklemek = yeni
 * profil dosyası + index.ts registry'sine bir satır. if-else yok.
 *
 * Kontroller pozitif ifade edilir ("iCloud Çıkışı Yapıldı"): işaretli =
 * doğrulanmış iyi durum (yeşil badge), işaretsiz = henüz bilinmiyor.
 */

export interface CheckDef {
  /** phone_checks.check_key — snake_case, markalar arasında çakışabilir (ör. yurt içi ortak) */
  key: string;
  /** Formda ve badge'de görünen etiket */
  label: string;
  /** Doğrulanmadığında telefoncunun karar kalitesini düşüren kritik kontrol */
  critical?: boolean;
}

export interface BrandProfile {
  id: string;
  /** brands.name ile eşleşen adlar (küçük harf karşılaştırılır) */
  brands: string[];
  /** Pil sağlığı (%) alanı bu markada anlamlı mı? (Apple: evet) */
  showBatteryHealth: boolean;
  /** Marka-özel kalite kontrolleri; ortak alanlar profil dışında sabittir */
  checks: CheckDef[];
}
