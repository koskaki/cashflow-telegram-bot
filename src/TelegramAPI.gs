// ==========================================
// TELEGRAM API & INTERFACE PESAN
// ==========================================

// Fungsi kirim pesan teks biasa
function sendMessage(chatId, text) {
  UrlFetchApp.fetch("https://api.telegram.org/bot" + BOT_TOKEN + "/sendMessage", {
    "method": "post",
    "contentType": "application/json",
    "payload": JSON.stringify({
      "chat_id": chatId,
      "text": text,
      "parse_mode": "HTML"
    }),
    "muteHttpExceptions": true
  });
}

// Fungsi kirim pesan dengan tombol interaktif (Inline Keyboard)
function sendMessageWithKeyboard(chatId, text, inlineKeyboard) {
  UrlFetchApp.fetch("https://api.telegram.org/bot" + BOT_TOKEN + "/sendMessage", {
    "method": "post",
    "contentType": "application/json",
    "payload": JSON.stringify({
      "chat_id": chatId,
      "text": text,
      "parse_mode": "HTML",
      "reply_markup": {
        "inline_keyboard": inlineKeyboard
      }
    }),
    "muteHttpExceptions": true
  });
}

// Fungsi Menu Utama
function sendMenuUtama(chatId, user) {
  var msg = "📱 <b>BOT CASHFLOW TELEGRAM</b>\n\n" +
    "Pilih menu di bawah untuk laporan cepat:";

  var keyboard = [
    [
      { text: "📊 Hari Ini", callback_data: "btn_ringkasan_hariini" },
      { text: "📈 Minggu Ini", callback_data: "btn_ringkasan_mingguini" },
      { text: "📅 Bulan Ini", callback_data: "btn_ringkasan_bulanini" }
    ],
    [
      { text: "📝 Detail Hari Ini", callback_data: "btn_detail_hariini" },
      { text: "📑 Detail Minggu Ini", callback_data: "btn_detail_mingguini" },
      { text: "🗓️ Detail Bulan Ini", callback_data: "btn_detail_bulanini" }
    ],
    [
      { text: "💼 Total Akumulasi Semua", callback_data: "btn_ringkasan_semua" }
    ],
    [
      { text: "💵 Panduan Input Cepat", callback_data: "btn_cara_input" }
    ]
  ];

  var role = (user && user.Role ? user.Role : "user").toLowerCase();
  if (role === "admin" || role === "superadmin") {
    keyboard.push([
      { text: "👥 Daftar Pengguna Aktif", callback_data: "btn_users_list" }
    ]);
  }

  sendMessageWithKeyboard(chatId, msg, keyboard);
}

// Panduan input cepat
function sendCaraInput(chatId) {
  var msg = "💵 <b>CARA MENCATAT TRANSAKSI</b>\n\n" +
    "1️⃣ <b>Format Cepat Sebaris:</b>\n" +
    "<code>keluar 25000 BCA Makan Nasi padang</code>\n" +
    "<code>masuk 1000000 Jago Gaji Bonus proyek</code>\n" +
    "Sintaks: <code>&lt;jenis&gt; &lt;nominal&gt; &lt;dompet&gt; &lt;kategori&gt; &lt;keterangan&gt;</code>\n\n" +
    "2️⃣ <b>Format Form Multiline:</b>\n" +
    "<pre>\nJenis : Keluar\nDompet : Mandiri\nUang : 50000\nKategori : Belanja\nDetail : Pulsa\n</pre>\n\n" +
    "3️⃣ <b>Foto Struk / Nota:</b>\n" +
    "Cukup kirim foto struk belanja, AI akan otomatis mendeteksi nominalnya.";
  sendMessage(chatId, msg);
}

// Notifikasi ke admin saat pendaftaran akun baru
function notifikasiPendaftaranToAdmin_(chatId, username, nama) {
  var rows = getUsersSheet_().getDataRange().getValues();
  var targets = [];
  
  for (var i = HEADER_ROWS.Users; i < rows.length; i++) {
    var r = String(rows[i][3] || "").toLowerCase();
    var id = String(rows[i][1] || "");
    if (id && (r === "admin" || r === "superadmin")) targets.push(id);
  }
  
  BOOTSTRAP_SUPERADMIN_IDS.forEach(function(bs) {
    if (targets.indexOf(bs) === -1) targets.push(bs);
  });

  var text = "📩 <b>PENDAFTARAN PENGGUNA BARU</b>\n\n" +
    "• Nama: " + nama + "\n" +
    "• Username: @" + (username || "-") + "\n" +
    "• Chat ID: <code>" + chatId + "</code>\n\n" +
    "📌 Ketik perintah berikut untuk menyetujui:\n" +
    "<code>/tambahuser @" + username + " user</code>";

  targets.forEach(function(tId) {
    sendMessage(tId, text);
  });
}

// Mengambil file gambar dari Telegram dalam bentuk Blob biner
function getTelegramImageBlob_(fileId) {
  try {
    var res = UrlFetchApp.fetch("https://api.telegram.org/bot" + BOT_TOKEN + "/getFile?file_id=" + fileId);
    var json = JSON.parse(res.getContentText());
    if (!json.ok || !json.result || !json.result.file_path) {
      return null;
    }
    var downloadUrl = "https://api.telegram.org/file/bot" + BOT_TOKEN + "/" + json.result.file_path;
    return UrlFetchApp.fetch(downloadUrl).getBlob();
  } catch (err) {
    Logger.log("Gagal ambil blob Telegram: " + err.message);
    return null;
  }
}

// Analisis struk menggunakan Gemini Vision API
function parseStrukWithGemini_(imageBlob) {
  try {
    if (!imageBlob) return { error: "Gambar struk kosong atau tidak valid." };

    var base64Image = Utilities.base64Encode(imageBlob.getBytes());
    var mimeType = imageBlob.getContentType();
// Jika Telegram mengirim application/octet-stream atau kosong, paksa ke image/jpeg
if (!mimeType || mimeType.indexOf("image/") !== 0) {
  mimeType = "image/jpeg";
}

    var promptText = "Kamu adalah asisten keuangan OCR struk belanja. Analisis gambar ini.\n" +
      "Ambil nominal TOTAL AKHIR belanja yang harus dibayar konsumen.\n" +
      "Keluarkan HANYA JSON murni tanpa markdown, tanpa penjelasan apa pun, contoh persis:\n" +
      "{\"nominal\": 114800, \"kategori\": \"Belanja\", \"detail\": \"Indomaret\"}\n" +
      "Catatan: 'nominal' harus berupa angka bulat integer murni (tanpa titik, tanpa koma, tanpa Rp).";

    var payload = {
      "contents": [{
        "parts": [
          { "text": promptText },
          {
            "inline_data": {
              "mime_type": mimeType,
              "data": base64Image
            }
          }
        ]
      }],
      "generationConfig": {
        "temperature": 0.1,
        "response_mime_type": "application/json"
      }
    };

    var apiUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=" + encodeURIComponent(GEMINI_API_KEY.trim());

    var response = UrlFetchApp.fetch(apiUrl, {
      "method": "post",
      "contentType": "application/json",
      "payload": JSON.stringify(payload),
      "muteHttpExceptions": true
    });

    var statusCode = response.getResponseCode();
    var contentText = response.getContentText();

    if (statusCode !== 200) {
      try {
        var errObj = JSON.parse(contentText);
        return { error: "Google API (" + statusCode + "): " + (errObj.error ? errObj.error.message : contentText) };
      } catch (e) {
        return { error: "Google API (" + statusCode + "): " + contentText };
      }
    }

    var resJson = JSON.parse(contentText);
    if (!resJson.candidates || !resJson.candidates[0] || !resJson.candidates[0].content) {
      return { error: "Respons kosong dari AI." };
    }

    var rawText = resJson.candidates[0].content.parts[0].text.trim();
    rawText = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();

    var parsed = JSON.parse(rawText);
    var nominalInt = 0;

    if (typeof parsed.nominal === "number") {
      nominalInt = Math.round(parsed.nominal);
    } else {
      nominalInt = parseInt(String(parsed.nominal || "").replace(/[^0-9]/g, ""), 10) || 0;
    }

    if (nominalInt <= 0) {
      return { error: "Nominal tidak terbaca atau 0." };
    }

    return {
      nominal: nominalInt,
      kategori: String(parsed.kategori || "Belanja").substring(0, 15),
      detail: String(parsed.detail || "Struk Belanja").substring(0, 20)
    };

  } catch (err) {
    return { error: "Crash Script: " + err.message };
  }
}

// Mengambil daftar dompet unik milik user yang bersangkutan
function getDaftarDompetUser_(chatId) {
  var rows = getDashboardRows_();
  var dompetSet = {};

  rows.forEach(function(r) {
    if (String(r.chatId) === String(chatId) && r.dompet) {
      dompetSet[normalizeDompet_(r.dompet)] = true;
    }
  });

  var list = Object.keys(dompetSet);
  // Jika belum ada riwayat dompet, sediakan opsi standar
  if (list.length === 0) {
    list = ["Cash", "BCA", "BRI", "Mandiri"];
  }
  return list;
}