// ==========================================
// KONFIGURASI GLOBAL
// ==========================================
// Mengambil service properti bawaan Google Apps Script
var scriptProperties = PropertiesService.getScriptProperties();

// Membaca nilainya tanpa menampilkan teks rahasianya di kodingan
var BOT_TOKEN = scriptProperties.getProperty("TELEGRAM_BOT_TOKEN") || "";
var GEMINI_API_KEY = scriptProperties.getProperty("GEMINI_API_KEY") || "";
var SS_URL = scriptProperties.getProperty("SPREADSHEET_URL") || "";

var rawAdmin = scriptProperties.getProperty("SUPERADMIN_ID") || "";
var BOOTSTRAP_SUPERADMIN_IDS = rawAdmin ? [rawAdmin] : [];

var SHEET_TRANSAKSI = "Transaksi";
var SHEET_USERS = "Users";
var HEADER_ROWS = { Transaksi: 1, Users: 1 };
