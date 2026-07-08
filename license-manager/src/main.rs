//! NEVA License Manager — geliştirici aracı, müşteriye verilmez.
//! İlk çalıştırmada exe yanında `neva_private.key` yoksa üretir ve
//! ana uygulamaya gömülecek public key'i `public_key.txt`e yazar.
//!
//! v3: Artık yalnızca lisans üreten bir araç değil; Customer/Device/License
//! olarak normalize edilmiş bir müşteri+lisans kayıt defteri (`neva_licenses.db`).
//! Bir müşterinin gelecekte birden fazla lisansı/cihazı olabilmesi için şema
//! baştan buna göre kuruldu (bkz. db.rs); bugünkü arayüz yalnızca tek aktif
//! lisans/cihaz akışını gösterir.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod db;

use chrono::{Duration, NaiveDate, Utc};
use data_encoding::BASE32_NOPAD;
use db::{CustomerLicense, Db};
use ed25519_dalek::{Signer, SigningKey};
use std::fs;
use std::path::PathBuf;

const EPOCH: &str = "2024-01-01"; // start/end günleri bu tarihe göre u16
const MIN_DAYS: i64 = 7;

/// Ana uygulamanın PLAN_LABELS dizisiyle aynı bucket sırası (Deneme/1 Ay/3 Ay/6 Ay/12 Ay);
/// müşteri app'inde gösterilen genel etiket buradan gelir, License Manager'ın kendi
/// listesinde ise geliştiricinin girdiği tam gün sayısı gösterilir.
fn plan_byte_for_days(days: i64) -> u8 {
    match days {
        0..=7 => 0,
        8..=31 => 1,
        32..=100 => 2,
        101..=200 => 3,
        _ => 4,
    }
}

fn key_dir() -> PathBuf {
    std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|d| d.to_path_buf()))
        .unwrap_or_else(|| PathBuf::from("."))
}

const DEFAULT_PRIVATE_KEY_HEX: &str = "18eb77a34441a91005262839f0e991d79c5c38a7817b89012e85867ca9ead56b";

fn load_or_create_key() -> (SigningKey, String) {
    let dir = key_dir();
    let priv_path = dir.join("neva_private.key");

    let hex = if let Ok(h) = fs::read_to_string(&priv_path) {
        h
    } else {
        let default_hex = DEFAULT_PRIVATE_KEY_HEX.to_string();
        fs::write(&priv_path, &default_hex).expect("private key yazılamadı");
        default_hex
    };

    let bytes: Vec<u8> = (0..64)
        .step_by(2)
        .filter_map(|i| u8::from_str_radix(hex.trim().get(i..i + 2)?, 16).ok())
        .collect();
    let arr: [u8; 32] = bytes.try_into().expect("neva_private.key bozuk");
    let key = SigningKey::from_bytes(&arr);
    let pubhex = hex_of(&key.verifying_key().to_bytes());

    fs::write(
        dir.join("public_key.txt"),
        format!("PUBLIC KEY (ana uygulamaya gömülür):\n{pubhex}\n"),
    )
    .ok();

    (key, pubhex)
}

fn hex_of(b: &[u8]) -> String {
    b.iter().map(|x| format!("{x:02x}")).collect()
}

/// "NVM-84A2-93BC-18FD" → 6 bayt
fn parse_device_id(s: &str) -> Option<[u8; 6]> {
    let hex: String = s
        .to_uppercase()
        .chars()
        .filter(|c| c.is_ascii_hexdigit())
        .collect();
    if hex.len() != 12 {
        return None;
    }
    let mut out = [0u8; 6];
    for i in 0..6 {
        out[i] = u8::from_str_radix(&hex[i * 2..i * 2 + 2], 16).ok()?;
    }
    Some(out)
}

fn days_since_epoch(d: NaiveDate) -> Option<u16> {
    let epoch = NaiveDate::parse_from_str(EPOCH, "%Y-%m-%d").unwrap();
    let days = (d - epoch).num_days();
    (0..=0xFFFE).contains(&days).then_some(days as u16)
}

fn make_code(key: &SigningKey, device: [u8; 6], plan: u8, start: u16, end: u16) -> String {
    let mut payload = Vec::with_capacity(12);
    payload.push(1u8); // format sürümü
    payload.extend_from_slice(&device);
    payload.push(plan);
    payload.extend_from_slice(&start.to_be_bytes());
    payload.extend_from_slice(&end.to_be_bytes());
    let sig = key.sign(&payload);
    payload.extend_from_slice(&sig.to_bytes());
    let b32 = BASE32_NOPAD.encode(&payload);
    let grouped = b32
        .as_bytes()
        .chunks(5)
        .map(|c| std::str::from_utf8(c).unwrap())
        .collect::<Vec<_>>()
        .join("-");
    format!("NVM-{grouped}")
}

fn parse_date(s: &str) -> Option<NaiveDate> {
    NaiveDate::parse_from_str(s.trim(), "%Y-%m-%d").ok()
}

/// Kalan gün — None ise sınırsız.
fn days_left(end_date: &Option<String>) -> Option<i64> {
    let end = end_date.as_ref()?;
    let end_d = parse_date(end)?;
    Some((end_d - Utc::now().date_naive()).num_days())
}

#[derive(PartialEq, Clone)]
enum View {
    List,
    New,
    Detail(i64),
}

struct NewForm {
    full_name: String,
    phone: String,
    device_id: String,
    days: String,
    unlimited: bool,
    description: String,
    error: String,
    generated_code: String,
}

impl Default for NewForm {
    fn default() -> Self {
        Self {
            full_name: String::new(),
            phone: String::new(),
            device_id: String::new(),
            days: "30".into(),
            unlimited: false,
            description: String::new(),
            error: String::new(),
            generated_code: String::new(),
        }
    }
}

#[derive(Default)]
struct DetailForms {
    transfer_open: bool,
    transfer_device_id: String,
    extend_open: bool,
    extend_days: String,
    error: String,
    last_code: String,
}

struct App {
    key: SigningKey,
    pubhex: String,
    db: Db,
    view: View,
    search: String,
    new_form: NewForm,
    detail_forms: DetailForms,
}

impl App {
    fn new() -> Self {
        let (key, pubhex) = load_or_create_key();
        let db = Db::open(&key_dir().join("neva_licenses.db")).expect("veritabanı açılamadı");
        Self {
            key,
            pubhex,
            db,
            view: View::List,
            search: String::new(),
            new_form: NewForm::default(),
            detail_forms: DetailForms::default(),
        }
    }

    fn create_customer(&mut self) {
        let f = &mut self.new_form;
        f.error.clear();
        f.generated_code.clear();

        if f.full_name.trim().len() < 2 {
            f.error = "Ad Soyad zorunludur.".into();
            return;
        }
        if f.phone.trim().len() < 5 {
            f.error = "Telefon numarası zorunludur.".into();
            return;
        }
        let Some(device) = parse_device_id(&f.device_id) else {
            f.error = "Device ID geçersiz (örn: NVM-84A2-93BC-18FD)".into();
            return;
        };

        let today = Utc::now().date_naive();
        let Some(start) = days_since_epoch(today) else {
            f.error = "Sistem tarihi aralık dışı.".into();
            return;
        };

        let (plan_label, plan_byte, end_u16, end_date_str): (String, u8, u16, Option<String>) =
            if f.unlimited {
                ("Sınırsız".into(), 5, 0xFFFF, None)
            } else {
                let days: i64 = match f.days.trim().parse() {
                    Ok(d) => d,
                    Err(_) => {
                        f.error = "Gün sayısı geçerli bir tam sayı olmalı.".into();
                        return;
                    }
                };
                if days < MIN_DAYS {
                    f.error = format!("Gün sayısı en az {MIN_DAYS} olmalı.");
                    return;
                }
                let end_date = today + Duration::days(days);
                let Some(end) = days_since_epoch(end_date) else {
                    f.error = "Bitiş tarihi aralık dışı.".into();
                    return;
                };
                (
                    format!("{days} Gün"),
                    plan_byte_for_days(days),
                    end,
                    Some(end_date.format("%Y-%m-%d").to_string()),
                )
            };

        let code = make_code(&self.key, device, plan_byte, start, end_u16);
        let start_str = today.format("%Y-%m-%d").to_string();

        match self.db.create_customer_license(
            f.full_name.trim(),
            f.phone.trim(),
            &f.device_id.trim().to_uppercase(),
            &plan_label,
            plan_byte,
            &start_str,
            end_date_str.as_deref(),
            f.description.trim(),
            &code,
        ) {
            Ok(license_id) => {
                f.generated_code = code;
                let full_name = f.full_name.clone();
                *f = NewForm::default();
                f.full_name = full_name; // formu tamamen sıfırlamak yerine küçük bir iz bırak
                self.view = View::Detail(license_id);
            }
            Err(e) => f.error = format!("Kaydedilemedi: {e}"),
        }
    }

    fn do_transfer(&mut self, cl: &CustomerLicense) {
        self.detail_forms.error.clear();
        let Some(device) = parse_device_id(&self.detail_forms.transfer_device_id) else {
            self.detail_forms.error = "Yeni Device ID geçersiz.".into();
            return;
        };
        let Some(start_d) = parse_date(&cl.start_date) else {
            self.detail_forms.error = "Kayıtlı başlangıç tarihi okunamadı.".into();
            return;
        };
        let Some(start) = days_since_epoch(start_d) else {
            self.detail_forms.error = "Başlangıç tarihi aralık dışı.".into();
            return;
        };
        let end_u16 = match &cl.end_date {
            None => 0xFFFFu16,
            Some(e) => match parse_date(e).and_then(days_since_epoch) {
                Some(v) => v,
                None => {
                    self.detail_forms.error = "Kayıtlı bitiş tarihi okunamadı.".into();
                    return;
                }
            },
        };
        let code = make_code(&self.key, device, cl.plan_byte as u8, start, end_u16);
        let new_device_upper = self.detail_forms.transfer_device_id.trim().to_uppercase();
        match self
            .db
            .transfer_device(cl.license_id, cl.customer_id, &new_device_upper, &code)
        {
            Ok(_) => {
                let _ = self.db.log_event(
                    cl.license_id,
                    "transfer",
                    &format!("Yeni Device: {new_device_upper}"),
                );
                self.detail_forms.transfer_open = false;
                self.detail_forms.transfer_device_id.clear();
                self.detail_forms.last_code = code;
            }
            Err(e) => self.detail_forms.error = format!("Transfer başarısız: {e}"),
        }
    }

    fn do_extend(&mut self, cl: &CustomerLicense) {
        self.detail_forms.error.clear();
        if cl.end_date.is_none() {
            self.detail_forms.error = "Sınırsız lisans süresi uzatılamaz.".into();
            return;
        }
        let add_days: i64 = match self.detail_forms.extend_days.trim().parse() {
            Ok(d) if d > 0 => d,
            _ => {
                self.detail_forms.error = "Geçerli bir gün sayısı girin.".into();
                return;
            }
        };
        let Some(device) = parse_device_id(&cl.device_id) else {
            self.detail_forms.error = "Kayıtlı Device ID okunamadı.".into();
            return;
        };
        let Some(start_d) = parse_date(&cl.start_date) else {
            self.detail_forms.error = "Kayıtlı başlangıç tarihi okunamadı.".into();
            return;
        };
        let Some(start) = days_since_epoch(start_d) else {
            self.detail_forms.error = "Başlangıç tarihi aralık dışı.".into();
            return;
        };
        let old_end_d = parse_date(cl.end_date.as_ref().unwrap()).unwrap();
        let new_end_d = old_end_d + Duration::days(add_days);
        let Some(new_end) = days_since_epoch(new_end_d) else {
            self.detail_forms.error = "Yeni bitiş tarihi aralık dışı.".into();
            return;
        };
        let code = make_code(&self.key, device, cl.plan_byte as u8, start, new_end);
        let new_end_str = new_end_d.format("%Y-%m-%d").to_string();
        match self.db.extend(cl.license_id, &new_end_str, &code) {
            Ok(_) => {
                let _ = self.db.log_event(
                    cl.license_id,
                    "extend",
                    &format!("+{add_days} gün (yeni bitiş: {new_end_str})"),
                );
                self.detail_forms.extend_open = false;
                self.detail_forms.extend_days.clear();
                self.detail_forms.last_code = code;
            }
            Err(e) => self.detail_forms.error = format!("Süre uzatma başarısız: {e}"),
        }
    }

    fn do_reissue(&mut self, cl: &CustomerLicense) {
        self.detail_forms.error.clear();
        let Some(device) = parse_device_id(&cl.device_id) else {
            self.detail_forms.error = "Kayıtlı Device ID okunamadı.".into();
            return;
        };
        let Some(start_d) = parse_date(&cl.start_date) else {
            self.detail_forms.error = "Kayıtlı başlangıç tarihi okunamadı.".into();
            return;
        };
        let Some(start) = days_since_epoch(start_d) else {
            self.detail_forms.error = "Başlangıç tarihi aralık dışı.".into();
            return;
        };
        let end_u16 = match &cl.end_date {
            None => 0xFFFFu16,
            Some(e) => match parse_date(e).and_then(days_since_epoch) {
                Some(v) => v,
                None => {
                    self.detail_forms.error = "Kayıtlı bitiş tarihi okunamadı.".into();
                    return;
                }
            },
        };
        let code = make_code(&self.key, device, cl.plan_byte as u8, start, end_u16);
        match self.db.reissue(cl.license_id, &code) {
            Ok(_) => {
                let _ = self.db.log_event(cl.license_id, "reissue", "Aynı bilgilerle yeniden üretildi");
                self.detail_forms.last_code = code;
            }
            Err(e) => self.detail_forms.error = format!("Yeniden üretme başarısız: {e}"),
        }
    }
}

/// Durum + renk: Yeşil (aktif/sınırsız) · Turuncu (≤7 gün) · Kırmızı (süresi dolmuş).
fn status_color(cl: &CustomerLicense) -> (egui_color::Color32, &'static str) {
    use egui_color::Color32;
    match days_left(&cl.end_date) {
        None => (Color32::from_rgb(22, 163, 74), "Sınırsız"),
        Some(d) if d < 0 => (Color32::from_rgb(220, 38, 38), "Süresi Doldu"),
        Some(d) if d <= 7 => (Color32::from_rgb(217, 119, 6), "Yakında Dolacak"),
        Some(_) => (Color32::from_rgb(22, 163, 74), "Aktif"),
    }
}

/// eframe::egui::Color32'yi kısa isimle yeniden dışa açar (okunabilirlik için).
mod egui_color {
    pub use eframe::egui::Color32;
}

fn days_left_text(cl: &CustomerLicense) -> String {
    match days_left(&cl.end_date) {
        None => "Sınırsız".into(),
        Some(d) if d < 0 => "Süresi Doldu".into(),
        Some(d) => format!("{d} Gün Kaldı"),
    }
}

impl eframe::App for App {
    fn update(&mut self, ctx: &eframe::egui::Context, _frame: &mut eframe::Frame) {
        use eframe::egui::{self, RichText};

        egui::CentralPanel::default().show(ctx, |ui| {
            ui.horizontal(|ui| {
                ui.heading("NEVA License Manager");
                ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                    if matches!(self.view, View::List) {
                        if ui.button("+ Yeni Müşteri / Lisans").clicked() {
                            self.new_form = NewForm::default();
                            self.view = View::New;
                        }
                    } else if ui.button("← Listeye Dön").clicked() {
                        self.view = View::List;
                    }
                });
            });
            ui.label(RichText::new(format!("Public key: {}", self.pubhex)).small().weak());
            ui.separator();

            match self.view.clone() {
                View::List => self.ui_list(ui),
                View::New => self.ui_new(ui),
                View::Detail(id) => self.ui_detail(ui, id),
            }
        });
    }
}

impl App {
    fn ui_list(&mut self, ui: &mut eframe::egui::Ui) {
        use eframe::egui::{self, RichText};

        ui.horizontal(|ui| {
            ui.label("Ara:");
            ui.add(
                egui::TextEdit::singleline(&mut self.search)
                    .hint_text("Ad Soyad, Telefon, Device ID veya Customer ID…")
                    .desired_width(320.0),
            );
        });
        ui.add_space(8.0);

        let list = self.db.list(self.search.trim()).unwrap_or_default();
        if list.is_empty() {
            ui.label(RichText::new("Kayıtlı lisans bulunamadı.").weak());
            return;
        }

        egui::ScrollArea::vertical().show(ui, |ui| {
            for cl in &list {
                let (color, status_label) = status_color(cl);
                egui::Frame::group(ui.style())
                    .fill(ui.visuals().faint_bg_color)
                    .show(ui, |ui| {
                        ui.set_width(ui.available_width());
                        ui.horizontal(|ui| {
                            ui.vertical(|ui| {
                                ui.label(RichText::new(&cl.customer_code).strong().small());
                                ui.label(RichText::new(&cl.full_name).strong());
                                ui.label(RichText::new(&cl.phone).weak().small());
                                ui.label(RichText::new(&cl.device_id).monospace().small());
                            });
                            ui.separator();
                            ui.vertical(|ui| {
                                ui.label(RichText::new(days_left_text(cl)).strong().size(16.0).color(color));
                                ui.label(RichText::new(&cl.plan_label).small().weak());
                                ui.label(RichText::new(status_label).small().color(color));
                            });
                            ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                                if ui.button("Detay").clicked() {
                                    self.detail_forms = Default::default();
                                    self.view = View::Detail(cl.license_id);
                                }
                            });
                        });
                    });
                ui.add_space(6.0);
            }
        });
    }

    fn ui_new(&mut self, ui: &mut eframe::egui::Ui) {
        use eframe::egui;
        let f = &mut self.new_form;

        egui::Grid::new("new-form").num_columns(2).spacing([12.0, 8.0]).show(ui, |ui| {
            ui.label("Ad Soyad");
            ui.text_edit_singleline(&mut f.full_name);
            ui.end_row();

            ui.label("Telefon Numarası");
            ui.text_edit_singleline(&mut f.phone);
            ui.end_row();

            ui.label("Device ID");
            ui.text_edit_singleline(&mut f.device_id);
            ui.end_row();

            ui.label("Sınırsız Lisans");
            ui.checkbox(&mut f.unlimited, "");
            ui.end_row();

            ui.label(format!("Gün Sayısı (min {MIN_DAYS})"));
            ui.add_enabled(!f.unlimited, egui::TextEdit::singleline(&mut f.days));
            ui.end_row();

            ui.label("Açıklama");
            ui.text_edit_singleline(&mut f.description);
            ui.end_row();
        });

        ui.add_space(8.0);
        if ui.button("  Lisans Oluştur  ").clicked() {
            self.create_customer();
        }
        if !self.new_form.error.is_empty() {
            ui.colored_label(egui::Color32::from_rgb(220, 38, 38), &self.new_form.error);
        }
        if !self.new_form.generated_code.is_empty() {
            ui.add_space(8.0);
            ui.label("Lisans Kodu:");
            ui.add(
                egui::TextEdit::multiline(&mut self.new_form.generated_code.as_str())
                    .desired_width(f32::INFINITY)
                    .desired_rows(3),
            );
        }
    }

    fn ui_detail(&mut self, ui: &mut eframe::egui::Ui, license_id: i64) {
        use eframe::egui::{self, RichText};

        let Ok(cl) = self.db.get(license_id) else {
            ui.label("Kayıt bulunamadı.");
            return;
        };
        let (color, status_label) = status_color(&cl);

        egui::Grid::new("detail-grid").num_columns(2).spacing([12.0, 6.0]).show(ui, |ui| {
            ui.label(RichText::new("Customer ID").weak());
            ui.label(RichText::new(&cl.customer_code).strong());
            ui.end_row();

            ui.label(RichText::new("Ad Soyad").weak());
            ui.label(&cl.full_name);
            ui.end_row();

            ui.label(RichText::new("Telefon").weak());
            ui.label(&cl.phone);
            ui.end_row();

            ui.label(RichText::new("Device ID").weak());
            ui.label(RichText::new(&cl.device_id).monospace());
            ui.end_row();

            ui.label(RichText::new("Başlangıç").weak());
            ui.label(&cl.start_date);
            ui.end_row();

            ui.label(RichText::new("Bitiş").weak());
            ui.label(cl.end_date.as_deref().unwrap_or("Sınırsız"));
            ui.end_row();

            ui.label(RichText::new("Kalan Gün").weak());
            ui.label(RichText::new(days_left_text(&cl)).strong().color(color));
            ui.end_row();

            ui.label(RichText::new("Lisans Türü").weak());
            ui.label(&cl.plan_label);
            ui.end_row();

            ui.label(RichText::new("Durum").weak());
            ui.label(RichText::new(status_label).color(color));
            ui.end_row();

            ui.label(RichText::new("Açıklama").weak());
            ui.label(if cl.description.is_empty() { "—" } else { &cl.description });
            ui.end_row();

            ui.label(RichText::new("Kayıt Durumu").weak());
            ui.label(if cl.status == "active" { "Aktif Kayıt" } else { &cl.status });
            ui.end_row();
        });

        ui.add_space(10.0);
        ui.horizontal(|ui| {
            if ui.button("Lisans Transfer Et").clicked() {
                self.detail_forms.transfer_open = !self.detail_forms.transfer_open;
                self.detail_forms.extend_open = false;
            }
            if cl.end_date.is_some() && ui.button("Süre Uzat").clicked() {
                self.detail_forms.extend_open = !self.detail_forms.extend_open;
                self.detail_forms.transfer_open = false;
            }
            if ui.button("Yeniden Üret").clicked() {
                self.do_reissue(&cl);
            }
        });

        if self.detail_forms.transfer_open {
            ui.add_space(6.0);
            ui.horizontal(|ui| {
                ui.label("Yeni Device ID:");
                ui.text_edit_singleline(&mut self.detail_forms.transfer_device_id);
                if ui.button("Onayla").clicked() {
                    self.do_transfer(&cl);
                }
            });
            ui.label(RichText::new("Kalan gün, başlangıç ve bitiş tarihi aynen korunur; yalnızca cihaz bağı ve kod değişir. Eski Device ID geçersiz olur.").small().weak());
        }

        if self.detail_forms.extend_open {
            ui.add_space(6.0);
            ui.horizontal(|ui| {
                ui.label("Eklenecek Gün:");
                ui.text_edit_singleline(&mut self.detail_forms.extend_days);
                if ui.button("Onayla").clicked() {
                    self.do_extend(&cl);
                }
            });
        }

        if !self.detail_forms.error.is_empty() {
            ui.add_space(6.0);
            ui.colored_label(egui::Color32::from_rgb(220, 38, 38), &self.detail_forms.error);
        }

        let display_code = if self.detail_forms.last_code.is_empty() {
            cl.code.clone()
        } else {
            self.detail_forms.last_code.clone()
        };
        ui.add_space(10.0);
        ui.label("Güncel Lisans Kodu:");
        ui.add(
            egui::TextEdit::multiline(&mut display_code.as_str())
                .desired_width(f32::INFINITY)
                .desired_rows(3),
        );
        if ui.button("Panoya Kopyala").clicked() {
            ui.ctx().copy_text(display_code);
        }

        ui.add_space(12.0);
        ui.separator();
        ui.label(RichText::new("Lisans Geçmişi").strong());
        let history = self.db.history(license_id).unwrap_or_default();
        egui::ScrollArea::vertical().max_height(180.0).show(ui, |ui| {
            for ev in &history {
                let label = match ev.event_type.as_str() {
                    "created" => "İlk Aktivasyon",
                    "transfer" => "Device Transfer",
                    "extend" => "Süre Uzatma",
                    "reissue" => "Yeniden Üretim",
                    other => other,
                };
                ui.label(RichText::new(format!("{} — {} · {}", ev.at, label, ev.detail)).small());
            }
        });
    }
}

fn main() -> eframe::Result {
    // Headless üretim: neva-license-manager.exe gen NVM-XXXX-XXXX-XXXX <gün|unlimited>
    // release.cjs bu komutu kullanır — imza mantığı ve çıktı formatı değişmedi.
    let args: Vec<String> = std::env::args().collect();
    if args.len() >= 4 && args[1] == "gen" {
        let (key, _) = load_or_create_key();
        let device = parse_device_id(&args[2]).expect("Device ID geçersiz");
        let today = Utc::now().date_naive();
        let start = days_since_epoch(today).expect("tarih aralık dışı");
        let (plan, end) = if args[3] == "unlimited" {
            (5u8, 0xFFFFu16)
        } else {
            let days: i64 = args[3].parse().expect("gün sayısı geçersiz");
            let plan = plan_byte_for_days(days);
            (plan, days_since_epoch(today + Duration::days(days)).expect("tarih aralık dışı"))
        };
        println!("{}", make_code(&key, device, plan, start, end));
        std::process::exit(0);
    }

    let options = eframe::NativeOptions {
        viewport: eframe::egui::ViewportBuilder::default()
            .with_inner_size([640.0, 640.0])
            .with_title("NEVA License Manager"),
        ..Default::default()
    };
    eframe::run_native(
        "NEVA License Manager",
        options,
        Box::new(|_| Ok(Box::new(App::new()))),
    )
}
