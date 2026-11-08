# 🤖 Bot Cashflow Telegram Multi-User dengan Gemini OCR

Bot Telegram berbasis Google Apps Script dan Google Sheets untuk pencatatan keuangan pribadi maupun kelompok. Dilengkapi fitur OCR otomatis menggunakan Google Gemini Vision AI (`gemini-3.8-flash`) untuk membaca total nominal struk belanja secara otomatis.

---

## ✨ Fitur Utama
- **OCR Struk Belanja:** Mengambil total belanja dari foto struk/nota tanpa menghabiskan kuota Google Drive.
- **Pencatatan Fleksibel:** Mendukung perintah singkat satu baris maupun form multiline toleran format.
- **Laporan Otomatis:** Ringkasan dan rincian transaksi harian, mingguan, bulanan, hingga per dompet.
- **Multi-User & Hak Akses:** Registrasi akun approval admin/superadmin.

---

## 🚀 Panduan Instalasi

### 1. Persiapan Akun & API Key
1. **Bot Telegram:**
   - Hubungi [@BotFather](https://t.me/BotFather) di Telegram.
   - Buat bot baru lewat `/newbot` dan simpan token bot Anda.
2. **Google Gemini API Key:**
   - Buka [Google AI Studio](https://aistudio.google.com/).
   - Dapatkan API Key gratis (Free Tier).
3. **Google Sheets:**
   - Buat spreadsheet baru di Google Drive.
   - Siapkan dua tab: `Transaksi` dan `Users`.
   - Header tab `Transaksi`: `ID`, `Tanggal`, `Jenis`, `Dompet`, `Uang`, `Kategori`, `Detail`, `ChatID`, `Username`, `Nama`.
   - Header tab `Users`: `Username`, `ChatID`, `Nama`, `Role`, `TanggalDitambahkan`.

### 2. Pemasangan Kode di Google Apps Script
1. Di Google Sheets Anda, buka menu **Ekstensi > Apps Script**.
2. Buat file `.gs` sesuai struktur kode repositori (`Main.gs`, `Database.gs`, `TelegramAPI.gs`, `Config.gs`).
3. Salin kode dari masing-masing file repositori ini ke dalam editor Apps Script.

### 3. Konfigurasi Properti Skrip (Environment)
1. Buka menu **Setelan Proyek (Project Settings)** (ikon gerigi).
2. Di bagian **Properti skrip (Script properties)**, tambahkan variabel berikut:
   - `TELEGRAM_BOT_TOKEN`: Token bot Telegram Anda.
   - `GEMINI_API_KEY`: Kunci API Google Gemini Anda.
   - `SPREADSHEET_URL`: URL lengkap file Google Sheets Anda.
   - `SUPERADMIN_ID`: Chat ID Telegram Anda.
   - `SHEET_TRANSAKSI`: `Transaksi`
   - `SHEET_USERS`: `Users`

### 4. Deploy Webhook
1. Klik tombol **Terapkan (Deploy) > Deployment baru (New deployment)**.
2. Pilih jenis **Aplikasi web (Web app)**.
3. Konfigurasi:
   - **Jalankan sebagai (Execute as):** *Saya (Me)*
   - **Siapa yang memiliki akses (Who has access):** *Siapa saja (Anyone)*
4. Klik **Terapkan (Deploy)** dan salin URL Web App yang dihasilkan.

### 5. Hubungkan Webhook ke Telegram
Buka browser dan akses tautan berikut (ganti `<TOKEN_BOT>` dan `<URL_WEB_APP>`):
```text
[https://api.telegram.org/bot](https://api.telegram.org/bot)<TOKEN_BOT>/setWebhook?url=<URL_WEB_APP>


### 6. Sumber pembuata
1. Youtube
2. Repositori Orang
3. AI (Gemini dan Claude)