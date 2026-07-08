//! NEVA License Manager — geliştirici aracı, müşteriye verilmez.
//! İlk çalıştırmada exe yanında `neva_private.key` yoksa üretir ve
//! ana uygulamaya gömülecek public key'i `public_key.txt`e yazar.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use chrono::{Duration, NaiveDate, Utc};
use data_encoding::BASE32_NOPAD;
use ed25519_dalek::{Signer, SigningKey};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

const EPOCH: &str = "2024-01-01"; // start/end günleri bu tarihe göre u16
const PLANS: &[(&str, u8, Option<i64>)] = &[
    ("Deneme (7 gün)", 0, Some(7)),
    ("1 Ay", 1, Some(30)),
    ("3 Ay", 2, Some(90)),
    ("6 Ay", 3, Some(180)),
    ("12 Ay", 4, Some(365)),
    ("Sınırsız", 5, None),
];

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

#[derive(Serialize, Deserialize)]
struct LicenseRecord {
    device_id: String,
    plan: String,
    start: String,
    end: String,
    description: String,
    code: String,
    created_at: String,
}

struct App {
    key: SigningKey,
    pubhex: String,
    device_id: String,
    plan_idx: usize,
    start: String,
    end: String,
    description: String,
    code: String,
    error: String,
    history: Vec<LicenseRecord>,
}

impl App {
    fn new() -> Self {
        let (key, pubhex) = load_or_create_key();
        let history: Vec<LicenseRecord> = fs::read_to_string(key_dir().join("licenses.json"))
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default();
        let today = Utc::now().date_naive();
        Self {
            key,
            pubhex,
            device_id: String::new(),
            plan_idx: 1,
            start: today.format("%Y-%m-%d").to_string(),
            end: (today + Duration::days(30)).format("%Y-%m-%d").to_string(),
            description: String::new(),
            code: String::new(),
            error: String::new(),
            history,
        }
    }

    fn sync_end_from_plan(&mut self) {
        if let Ok(s) = NaiveDate::parse_from_str(&self.start, "%Y-%m-%d") {
            match PLANS[self.plan_idx].2 {
                Some(days) => self.end = (s + Duration::days(days)).format("%Y-%m-%d").to_string(),
                None => self.end = "sınırsız".into(),
            }
        }
    }

    fn generate(&mut self) {
        self.error.clear();
        self.code.clear();
        let Some(device) = parse_device_id(&self.device_id) else {
            self.error = "Device ID geçersiz (örn: NVM-84A2-93BC-18FD)".into();
            return;
        };
        let Ok(start_d) = NaiveDate::parse_from_str(&self.start, "%Y-%m-%d") else {
            self.error = "Başlangıç tarihi geçersiz (YYYY-AA-GG)".into();
            return;
        };
        let Some(start) = days_since_epoch(start_d) else {
            self.error = "Başlangıç tarihi aralık dışı".into();
            return;
        };
        let (plan_label, plan_byte, plan_days) = PLANS[self.plan_idx];
        let end: u16 = if plan_days.is_none() || self.end.trim() == "sınırsız" {
            0xFFFF
        } else {
            let Ok(end_d) = NaiveDate::parse_from_str(&self.end, "%Y-%m-%d") else {
                self.error = "Bitiş tarihi geçersiz (YYYY-AA-GG)".into();
                return;
            };
            match days_since_epoch(end_d) {
                Some(e) if e > start => e,
                _ => {
                    self.error = "Bitiş, başlangıçtan sonra olmalı".into();
                    return;
                }
            }
        };
        self.code = make_code(&self.key, device, plan_byte, start, end);
        self.history.push(LicenseRecord {
            device_id: self.device_id.trim().to_uppercase(),
            plan: plan_label.to_string(),
            start: self.start.clone(),
            end: self.end.clone(),
            description: self.description.clone(),
            code: self.code.clone(),
            created_at: Utc::now().format("%Y-%m-%d %H:%M").to_string(),
        });
        if let Ok(json) = serde_json::to_string_pretty(&self.history) {
            fs::write(key_dir().join("licenses.json"), json).ok();
        }
    }
}

impl eframe::App for App {
    fn update(&mut self, ctx: &eframe::egui::Context, _frame: &mut eframe::Frame) {
        use eframe::egui::{self, RichText};
        egui::CentralPanel::default().show(ctx, |ui| {
            ui.heading("NEVA License Manager");
            ui.label(RichText::new(format!("Public key: {}", self.pubhex)).small().weak());
            ui.separator();

            egui::Grid::new("form").num_columns(2).spacing([12.0, 8.0]).show(ui, |ui| {
                ui.label("Device ID");
                ui.text_edit_singleline(&mut self.device_id);
                ui.end_row();

                ui.label("Lisans Türü");
                let before = self.plan_idx;
                egui::ComboBox::from_id_salt("plan")
                    .selected_text(PLANS[self.plan_idx].0)
                    .show_ui(ui, |ui| {
                        for (i, (label, _, _)) in PLANS.iter().enumerate() {
                            ui.selectable_value(&mut self.plan_idx, i, *label);
                        }
                    });
                if before != self.plan_idx {
                    self.sync_end_from_plan();
                }
                ui.end_row();

                ui.label("Başlangıç");
                if ui.text_edit_singleline(&mut self.start).changed() {
                    self.sync_end_from_plan();
                }
                ui.end_row();

                ui.label("Bitiş");
                ui.text_edit_singleline(&mut self.end);
                ui.end_row();

                ui.label("Açıklama");
                ui.text_edit_singleline(&mut self.description);
                ui.end_row();
            });

            ui.add_space(8.0);
            if ui.button("  Lisans Oluştur  ").clicked() {
                self.generate();
            }
            if !self.error.is_empty() {
                ui.colored_label(egui::Color32::from_rgb(220, 38, 38), &self.error);
            }
            if !self.code.is_empty() {
                ui.add_space(8.0);
                ui.label("Lisans Kodu:");
                ui.add(
                    egui::TextEdit::multiline(&mut self.code.as_str())
                        .desired_width(f32::INFINITY)
                        .desired_rows(3),
                );
                if ui.button("Panoya Kopyala").clicked() {
                    ctx.copy_text(self.code.clone());
                }
            }

            ui.add_space(12.0);
            ui.separator();
            ui.label(RichText::new(format!("Üretilen lisanslar: {}", self.history.len())).weak());
            egui::ScrollArea::vertical().max_height(160.0).show(ui, |ui| {
                for r in self.history.iter().rev().take(20) {
                    ui.label(
                        RichText::new(format!(
                            "{} · {} · {} → {} · {}",
                            r.created_at, r.device_id, r.start, r.end, r.plan
                        ))
                        .small(),
                    );
                }
            });
        });
    }
}

fn main() -> eframe::Result {
    // Headless üretim: neva-license-manager.exe gen NVM-XXXX-XXXX-XXXX <gün|unlimited>
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
            let plan = match days {
                0..=7 => 0,
                8..=31 => 1,
                32..=100 => 2,
                101..=200 => 3,
                _ => 4,
            };
            (plan, days_since_epoch(today + Duration::days(days)).expect("tarih aralık dışı"))
        };
        println!("{}", make_code(&key, device, plan, start, end));
        std::process::exit(0);
    }

    let options = eframe::NativeOptions {
        viewport: eframe::egui::ViewportBuilder::default()
            .with_inner_size([560.0, 520.0])
            .with_title("NEVA License Manager"),
        ..Default::default()
    };
    eframe::run_native(
        "NEVA License Manager",
        options,
        Box::new(|_| Ok(Box::new(App::new()))),
    )
}
