# 🤖 Meri Si Pencatat Keuangan (Bot Telegram Multi-User dengan Gemini OCR)

**Meri Si Pencatat Keuangan** adalah bot Telegram berbasis Google Apps Script dan Google Sheets untuk pencatatan keuangan pribadi maupun kelompok. Dilengkapi fitur OCR otomatis menggunakan Google Gemini Vision AI (`gemini-3.6-flash`) dengan mode instan (`thinkingBudget: 0`) untuk membaca struk belanja, pencatatan berbasis bahasa percakapan sehari-hari, evaluasi keuangan berkala, dan manajemen pengguna interaktif.

---

## ✨ Fitur Utama
- **OCR Struk Belanja:** Mengambil total nominal akhir, kategori, dan detail struk secara otomatis dari foto tanpa menghabiskan kuota Google Drive.
- **Natural Language Input:** Mendukung pencatatan transaksi dari bahasa santai sehari-hari (contoh: *"tadi beli bensin 30rb cash"* atau *"gajian 5jt masuk bca"*).
- **Pencatatan Fleksibel:** Mendukung perintah singkat satu baris maupun form multiline toleran format.
- **Edit & Hapus Transaksi:** Fitur koreksi data via `/edit` dan penghapusan transaksi via perintah `/hapus <ID>` atau tombol instan `[🗑️ Hapus Transaksi Ini]`.
- **Laporan Real-Time & Sisa Saldo:** Laporan ringkasan dan detail transaksi (harian, mingguan, bulanan) dengan format monospace `<pre>`, indikator status 🟢/🔴, serta rincian sisa saldo aktual per dompet (Cash, BRI, Blu, Jago, dll.) dan total saldo terkini[cite: 1, 2].
- **Evaluasi Keuangan AI:** Ulasan performa pengeluaran otomatis oleh Meri untuk periode kemarin, minggu lalu, dan bulan lalu lengkap dengan pos pengeluaran terbesar[cite: 1].
- **Ekspor Data:** Fitur unduh seluruh riwayat transaksi langsung ke chat Telegram dalam format file CSV/Excel[cite: 1].
- **Multi-User & Hak Akses:** Registrasi akun via tombol approval admin/superadmin (`Setujui`/`Tolak`), panel pengelolaan role user, penanganan aman untuk user tanpa username Telegram, serta pembersihan username tanpa simbol `@`[cite: 1].

---

### Sumber pembuatan
1. Youtube
2. Repositori Orang
3. AI (Gemini dan Claude)

---

## 🚀 Panduan Instalasi

### 1. Persiapan Akun & API Key
1. **Bot Telegram (Meri Si Pencatat Keuangan):**
   - Hubungi [@BotFather](https://t.me/BotFather) di Telegram.
   - Buat bot baru lewat `/newbot`, beri nama tampilan **Meri Si Pencatat Keuangan**, dan simpan token bot Anda.
2. **Google Gemini API Key:**
   - Buka [Google AI Studio](https://aistudio.google.com/).
   - Dapatkan API Key gratis (Free Tier).
3. **Google Sheets:**
   - Buat spreadsheet baru di Google Drive.
   - Siapkan dua tab: `Transaksi` dan `Users`[cite: 1].
   - Header tab `Transaksi`: `ID`, `Tanggal`, `Jenis`, `Dompet`, `Uang`, `Kategori`, `Detail`, `ChatID`, `Username`, `Nama`.
   - Header tab `Users`: `Username`, `ChatID`, `Nama`, `Role`, `TanggalDitambahkan`.

### 2. Pemasangan Kode di Google Apps Script
1. Di Google Sheets Anda, buka menu **Ekstensi > Apps Script**.
2. Buat file `.gs` sesuai struktur kode repositori (`Main.gs`, `Database.gs`, `TelegramAPI.gs`, `Report.gs`, `Config.gs`)[cite: 1].
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