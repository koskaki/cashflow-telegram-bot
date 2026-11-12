// ==========================================
// TELEGRAM API & INTERFACE PESAN (TelegramAPI.gs)
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

  // Di dalam function sendMenuUtama(chatId, user)
  var keyboard = [
    [
      { text: "📊 Ringkasan Hari Ini", callback_data: "btn_ringkasan_hariini" },
      { text: "📈 Ringkasan Minggu Ini", callback_data: "btn_ringkasan_mingguini" },
      
    ],
    [
      { text: "📅 Ringkasan Bulan Ini", callback_data: "btn_ringkasan_bulanini" }
    ],
    [
      { text: "📝 Detail Hari Ini", callback_data: "btn_detail_hariini" },
      { text: "📑 Detail Minggu Ini", callback_data: "btn_detail_mingguini" },
      
    ],
    [
      { text: "🗓️ Detail Bulan Ini", callback_data: "btn_detail_bulanini" }
    ],
    [
      { text: "💡 Evaluasi Kemarin", callback_data: "btn_eval_kemarin" },
      { text: "💡 Evaluasi Minggu Lalu", callback_data: "btn_eval_minggulalu" },
    ],
    [
      { text: "💡 Evaluasi Bulan Lalu", callback_data: "btn_eval_bulanlalu" }
    ],
    [
      { text: "💼 Total Akumulasi Semua", callback_data: "btn_ringkasan_semua" }
    ],
    [
      { text: "📥 Unduh Laporan (Excel/CSV)", callback_data: "btn_ekspor_file" }
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
    "3️⃣ <b>Bahasa Bebas / Gaul (AI):</b>\n" +
    "<i>\"tadi beli bensin 30rb cash\"</i>\n" +
    "<i>\"gajian 5jt masuk bca\"</i>\n\n" +
    "4️⃣ <b>Foto Struk / Nota:</b>\n" +
    "Cukup kirim foto struk belanja, AI akan otomatis mendeteksi nominalnya.";
  sendMessage(chatId, msg);
}

// Mengambil seluruh Chat ID Superadmin dan Admin untuk penerima notifikasi pendaftaran
function getSuperadminAndAdminChatIds_() {
  var chatIds = [];
  try {
    var ss = (typeof getSpreadsheet_ === "function") ? getSpreadsheet_() : SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Users");
    if (!sheet) return chatIds;

    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      var cId = String(data[i][1] || "").trim();
      var role = String(data[i][3] || "").toLowerCase().trim();

      if (cId && (role === "admin" || role === "superadmin")) {
        if (chatIds.indexOf(cId) === -1) {
          chatIds.push(cId);
        }
      }
    }
  } catch (err) {
    Logger.log("Gagal membaca admin chat IDs: " + err.message);
  }

  // Fallback: Jika sheet kosong atau belum terbaca, ambil dari BOOTSTRAP_SUPERADMIN_IDS / Script Properties
  if (chatIds.length === 0) {
    try {
      var props = PropertiesService.getScriptProperties();
      var fallbackId = props.getProperty("SUPERADMIN_ID") || (typeof BOOTSTRAP_SUPERADMIN_IDS !== "undefined" ? BOOTSTRAP_SUPERADMIN_IDS[0] : null);
      if (fallbackId) chatIds.push(String(fallbackId));
    } catch (e) {}
  }

  return chatIds;
}

function notifikasiPendaftaranToAdmin_(chatId, telegramUsername, namaTelegram) {
  var cleanUser = String(telegramUsername || "").replace("@", "").trim();
  var uParam = cleanUser ? encodeURIComponent(cleanUser) : "-";
  var nParam = encodeURIComponent(String(namaTelegram || "User").substring(0, 25));

  var pesanPendaftaran = "📨 <b>PENDAFTARAN PENGGUNA BARU</b>\n\n" +
    "• <b>Nama:</b> " + (namaTelegram || "-") + "\n" +
    "• <b>Username:</b> " + (cleanUser ? "@" + cleanUser : "@-") + "\n" +
    "• <b>Chat ID:</b> <code>" + chatId + "</code>\n\n" +
    "Silakan pilih tindakan persetujuan di bawah:";

  var keyboard = [
    [
      { text: "✅ Setujui Pendaftaran", callback_data: "appr_step1_" + chatId + "_" + uParam + "_" + nParam },
      { text: "❌ Tolak", callback_data: "reject_reg_" + chatId }
    ]
  ];

  var adminList = getSuperadminAndAdminChatIds_();
  
  if (adminList.length === 0) {
    Logger.log("Peringatan: Tidak ada Chat ID admin yang terdaftar untuk menerima notifikasi.");
    return;
  }

  adminList.forEach(function(adminChatId) {
    try {
      sendMessageWithKeyboard(adminChatId, pesanPendaftaran, keyboard);
    } catch (e) {
      Logger.log("Gagal kirim notif ke admin " + adminChatId + ": " + e.message);
    }
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

// Analisis struk menggunakan Gemini Vision API (Flash & Thinking Dimatikan)
function parseStrukWithGemini_(imageBlob) {
  try {
    if (!imageBlob) return { error: "Gambar struk kosong atau tidak valid." };

    var base64Image = Utilities.base64Encode(imageBlob.getBytes());
    var mimeType = imageBlob.getContentType();
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
        "response_mime_type": "application/json",
        "thinkingConfig": {
          "thinkingBudget": 0 // Matikan mode thinking agar respon instan
        }
      }
    };

    var apiUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=" + encodeURIComponent(GEMINI_API_KEY.trim());

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
  if (list.length === 0) {
    list = ["Cash", "BCA", "BRI", "Mandiri"];
  }
  return list;
}

// ==========================================
// TONE OF VOICE & RESPON INTERAKTIF RAMAH (LOKAL)
// ==========================================

function pickRandom_(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function responSapaan_(namaUser) {
  var nama = namaUser ? namaUser.split(" ")[0] : "kak";
  var sapaan = [
    "Halo " + nama + "! Ada transaksi baru yang mau dicatat hari ini? Ketik <code>/menu</code> ya kalau mau cek laporan.",
    "Hai " + nama + "! Siap bantu catat keuanganmu. Cukup kirim foto struk atau ketik transaksimu langsung ya.",
    "Halo! Ada pengeluaran atau pemasukan baru? Langsung kirim ke sini aja ya " + nama + " 😊",
    "Sama-sama " + nama + "! Senang bisa bantu rapikan keuanganmu hari ini ✨"
  ];
  return pickRandom_(sapaan);
}

function responSalahFormat_(dataMentah) {
  var saran = "Waduh, sepertinya format catatanmu belum pas nih 🤔\n\n";

  if (dataMentah && dataMentah.indexOf(":") !== -1) {
    saran += "Pastikan ada minimal <b>Jenis</b>, <b>Dompet</b>, dan <b>Nominal</b> ya.\n\n" +
      "<i>Contoh yang benar:</i>\n" +
      "<pre>\nJenis : Keluar\nDompet : BRI\nNominal : 50000\nKategori : Makan\nDetail : Bakso\n</pre>";
  } else {
    saran += "Kalau mau catat cepat sebaris, urutannya gini ya:\n" +
      "<code>keluar 25000 BCA Makan Nasi padang</code>\n\n" +
      "Atau kalau kamu habis belanja, langsung <b>foto struknya</b> aja biar aku yang hitung otomatis! 📸";
  }

  saran += "\n\nBingung opsi lainnya? Cukup ketik /menu ya!";
  return saran;
}

function responTidakDikenali_(namaUser) {
  var nama = namaUser ? namaUser.split(" ")[0] : "kak";
  var pesan = [
    "Hmm, aku belum paham maksudnya nih " + nama + " 😅\n\nLagi mau catat keuangan atau cek saldo? Tekan /menu aja yuk biar gampang pilihnya!",
    "Hei " + nama + ", kamu lagi bingung ya? Tenang, langsung tekan /menu untuk lihat semua fitur laporan dan cara pakainya ya.",
    "Aku belum bisa mengerti pesan itu nih. Kalau mau catat transaksi, tinggal kirim foto struk belanja atau buka panduan di /menu ya!"
  ];
  return pickRandom_(pesan);
}

// ==========================================
// GEMINI NATURAL LANGUAGE PARSER & ASISTEN (Flash & Thinking Dimatikan)
// ==========================================

function prosesPesanDenganGemini_(userText, namaUser) {
  try {
    var todayStr = Utilities.formatDate(new Date(), "GMT+7", "dd/MM/yyyy");
    
    var prompt = "Kamu adalah asisten keuangan pribadi yang ramah, santai, dan cerdas. Hari ini tanggal: " + todayStr + ".\n" +
      "Nama user: " + (namaUser || "Kak") + ".\n\n" +
      "Tugasmu menganalisis pesan:\n" +
      "1. JIKA PESAN BERISI PENCATATAN KEUANGAN (pemasukan/pengeluaran bahasa sehari-hari, misal: 'habis beli makan 25rb pake cash', 'tadi jajan boba 20k bri', 'gajian 5jt masuk jago'):\n" +
      "   Keluarkan HANYA JSON murni tanpa markdown, persis seperti ini:\n" +
      "   {\"tipe\": \"transaksi\", \"jenis\": \"Keluar\", \"nominal\": 25000, \"dompet\": \"Cash\", \"kategori\": \"Makan\", \"detail\": \"Beli makan\"}\n" +
      "   (Catatan: 'jenis' wajib 'Masuk' atau 'Keluar'. 'nominal' berupa integer bulat tanpa titik/Rp. Jika dompet tidak disebutkan, isi 'Cash').\n\n" +
      "2. JIKA PESAN BUKAN TRANSAKSI (curhat boros, tanya tips hemat, sapaan unik):\n" +
      "   Jawab dengan singkat, ramah, dan suportif layaknya teman akrab.";

    var payload = {
      "contents": [{
        "parts": [{ "text": prompt + "\n\nPesan User: \"" + userText + "\"" }]
      }],
      "generationConfig": {
        "temperature": 0.4,
        "thinkingConfig": {
          "thinkingBudget": 0 // Matikan mode thinking agar respon chat instan
        }
      }
    };

    var apiUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=" + encodeURIComponent(GEMINI_API_KEY.trim());

    var response = UrlFetchApp.fetch(apiUrl, {
      "method": "post",
      "contentType": "application/json",
      "payload": JSON.stringify(payload),
      "muteHttpExceptions": true
    });

    if (response.getResponseCode() !== 200) {
      return { tipe: "chat", pesan: responTidakDikenali_(namaUser) };
    }

    var resJson = JSON.parse(response.getContentText());
    var rawReply = resJson.candidates[0].content.parts[0].text.trim();
    var cleanJson = rawReply.replace(/```json/gi, "").replace(/```/g, "").trim();

    try {
      var parsed = JSON.parse(cleanJson);
      if (parsed.tipe === "transaksi" && parsed.nominal > 0) {
        return parsed;
      }
    } catch (e) {
      // Bukan JSON, kembalikan teks chat biasa
    }

    return { tipe: "chat", pesan: rawReply };

  } catch (err) {
    return { tipe: "chat", pesan: responTidakDikenali_(namaUser) };
  }
}

function generateAnalisisKeuanganGemini_(dataRekap, namaUser) {
  try {
    if (dataRekap.pemasukan === 0 && dataRekap.pengeluaran === 0) {
      return "Hai " + (namaUser || "Kak") + "! Pada periode <b>" + dataRekap.label + "</b> belum ada catatan transaksi yang tercatat nih. Yuk tetap rajin catat ya!";
    }

    var ringkasanKat = dataRekap.topKategori.length > 0 
      ? dataRekap.topKategori.map(function(k) { return "- " + k.nama + ": Rp " + Number(k.total).toLocaleString('id-ID'); }).join("\n")
      : "- Tidak ada kategori spesifik";

    var prompt = "Kamu adalah Meri, asisten dan konsultan keuangan pribadi yang ramah, santai, dan solutif.\n" +
      "Nama user: " + (namaUser || "Kak") + ".\n" +
      "Data evaluasi keuangan periode " + dataRekap.label + ":\n" +
      "- Total Pemasukan: Rp " + Number(dataRekap.pemasukan).toLocaleString('id-ID') + "\n" +
      "- Total Pengeluaran: Rp " + Number(dataRekap.pengeluaran).toLocaleString('id-ID') + "\n" +
      "- Selisih: Rp " + Number(dataRekap.selisih).toLocaleString('id-ID') + "\n" +
      "- Pos Pengeluaran Terbesar:\n" + ringkasanKat + "\n\n" +
      "Tugasmu:\n" +
      "1. Berikan ulasan singkat (2-3 paragraf ringkas) mengenai performa keuangannya pada periode tersebut.\n" +
      "2. Jika pengeluaran lebih besar dari pemasukan, berikan peringatan hangat dan tips penghematan yang realistis.\n" +
      "3. Jika surplus/hemat, berikan apresiasi positif.\n" +
      "4. Gunakan bahasa Indonesia santai dan akrab.";

    var payload = {
      "contents": [{ "parts": [{ "text": prompt }] }],
      "generationConfig": {
        "temperature": 0.4,
        "thinkingConfig": { "thinkingBudget": 0 }
      }
    };

    var apiUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=" + encodeURIComponent(GEMINI_API_KEY.trim());

    var response = UrlFetchApp.fetch(apiUrl, {
      "method": "post",
      "contentType": "application/json",
      "payload": JSON.stringify(payload),
      "muteHttpExceptions": true
    });

    if (response.getResponseCode() === 200) {
      var resJson = JSON.parse(response.getContentText());
      return resJson.candidates[0].content.parts[0].text.trim();
    } else {
      return "⚠️ Sedang ada kendala ke server AI. Meri coba lagi, sebentar ya!";
    }
  } catch (err) {
    return "❌ Haduh Terjadi error: " + err.message;
  }
}

// ==========================================
// EKSPOR LAPORAN KE EXCEL / CSV UNTUK USER
// ==========================================

// Fungsi untuk mengirim file/dokumen ke Telegram
function sendTelegramDocument(chatId, fileBlob, captionText) {
  var url = "https://api.telegram.org/bot" + BOT_TOKEN + "/sendDocument";
  var payload = {
    chat_id: String(chatId),
    caption: captionText || "",
    parse_mode: "HTML",
    document: fileBlob
  };

  UrlFetchApp.fetch(url, {
    method: "post",
    payload: payload,
    muteHttpExceptions: true
  });
}

// Fungsi menghasilkan dan mengirim file laporan khusus milik user
function kirimFileExcelUser_(chatId, namaUser) {
  var rows = getDashboardRows_();
  
  // Header kolom laporan Excel/CSV
  var csvContent = "ID,Tanggal,Jenis,Dompet,Nominal,Kategori,Detail\n";
  var count = 0;

  rows.forEach(function(r) {
    // Saring hanya transaksi milik ChatID user yang meminta
    if (String(r.chatId) === String(chatId)) {
      count++;
      var baris = [
        '"' + r.id + '"',
        '"' + r.tanggalRaw + '"',
        '"' + r.jenis + '"',
        '"' + r.dompet + '"',
        r.nominal,
        '"' + (r.kategori || "-").replace(/"/g, '""') + '"',
        '"' + (r.detail || "-").replace(/"/g, '""') + '"'
      ].join(",");
      csvContent += baris + "\n";
    }
  });

  if (count === 0) {
    sendMessage(chatId, "⚠️ Meri rasa kamu belum memiliki riwayat transaksi untuk diekspor. Huhuu");
    return;
  }

  // Buat file Blob format CSV yang kompatibel dibuka langsung di Excel
  var namaBersih = (namaUser || "User").replace(/[^a-zA-Z0-9]/g, "_");
  var tglStr = Utilities.formatDate(new Date(), "GMT+7", "yyyyMMdd");
  var namaFile = "Laporan_Keuangan_" + namaBersih + "_" + tglStr + ".csv";

  var blob = Utilities.newBlob(csvContent, "text/csv", namaFile);

  sendTelegramDocument(
    chatId, 
    blob, 
    "📁 <b>Laporan Keuanganmu Siap yaaa!</b>\n\n" +
    "• Total Transaksi: <b>" + count + " data</b>\n" +
    "• Format: CSV (Bisa dibuka langsung di Excel / Sheets)"
  );
}

// Generator Token 5 Karakter Huruf & Angka Acak
function generateTokenTransaksi_() {
  var chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Tanpa 0, O, 1, I agar tidak keliru
  var token = "";
  for (var i = 0; i < 5; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

// Generator Token 5 Karakter Acak (Huruf Besar & Angka)
function generateTokenTransaksi_() {
  var chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  var token = "";
  for (var i = 0; i < 5; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

function simpanBaris_(tanggal, jenis, dompet, uang, kategori, detail, chatId, username, nama) {
  var sheet = getDashboardSheet_();
  var rows = sheet.getDataRange().getValues();

  jenis = (jenis.toLowerCase() === "masuk" || jenis.toLowerCase() === "in") ? "Masuk" : "Keluar";
  dompet = normalizeDompet_(dompet);
  var uangNum = parseInt(String(uang).replace(/[^0-9]/g, ""), 10) || 0;
  var userRef = username ? String(username).replace(/^@+/, "").trim() : (nama || "User");
  var tglStr = String(tanggal);

  var sysId = generateCustomId_(tglStr, jenis, dompet);
  var tokenTx = generateTokenTransaksi_();

  // Urutan kolom: 
  // [0] ID, [1] Token, [2] Tanggal, [3] Jenis, [4] Dompet, [5] Uang, 
  // [6] Kategori, [7] Detail, [8] ChatID, [9] Username, [10] Nama
  var newRowData = [
    sysId,
    tokenTx,
    tglStr,
    jenis,
    dompet,
    uangNum,
    kategori || "Umum",
    detail || "-",
    String(chatId),
    userRef,
    nama || "-"
  ];

  // Cari baris kosong di tengah sebelum appendRow
  var targetRow = -1;
  var startRow = HEADER_ROWS.Transaksi || 2;
  for (var i = startRow; i < rows.length; i++) {
    if (!rows[i][0] || String(rows[i][0]).trim() === "") {
      targetRow = i + 1;
      break;
    }
  }

  if (targetRow !== -1) {
    sheet.getRange(targetRow, 1, 1, newRowData.length).setValues([newRowData]);
  } else {
    sheet.appendRow(newRowData);
    targetRow = sheet.getLastRow();
  }

  // Format rupiah di Kolom F (kolom ke-6)
  sheet.getRange(targetRow, 6).setNumberFormat('"Rp"#,##0');

  // Kembalikan ID sistem dan Token
  return { id: sysId, token: tokenTx };
}