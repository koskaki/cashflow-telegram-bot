// ==========================================
// SPREADSHEET READ / WRITE & USER STORE
// ==========================================

function getDashboardSheet_() {
  var ss = SpreadsheetApp.openByUrl(SS_URL);
  return ss.getSheetByName(SHEET_TRANSAKSI) || ss.getSheetByName("Dashboard");
}

function getUsersSheet_() {
  return SpreadsheetApp.openByUrl(SS_URL).getSheetByName(SHEET_USERS);
}

function ensureSheets_() {
  var ss = SpreadsheetApp.openByUrl(SS_URL);
  if (!ss.getSheetByName(SHEET_TRANSAKSI) && !ss.getSheetByName("Dashboard")) {
    ss.insertSheet(SHEET_TRANSAKSI).appendRow(["ID", "Tanggal", "Jenis", "Dompet", "Uang", "Kategori", "Detail", "ChatID", "Username", "Nama"]);
  }
  if (!ss.getSheetByName(SHEET_USERS)) {
    ss.insertSheet(SHEET_USERS).appendRow(["Username", "ChatID", "Nama", "Role", "TanggalDitambahkan"]);
  }
}

// Menyeragamkan penulisan dompet (CASH, cash, Cash -> Cash; bri -> BRI, dll.)
function normalizeDompet_(str) {
  var s = String(str || "Cash").trim();
  if (!s) return "Cash";
  var lower = s.toLowerCase();
  if (lower === "bri" || lower === "bca" || lower === "bni" || lower === "bsi" || lower === "cimb") {
    return lower.toUpperCase();
  }
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function getDashboardRows_() {
  var sheet = getDashboardSheet_();
  if (!sheet) return [];
  var raw = sheet.getDataRange().getValues();
  var out = [];
  var startRow = HEADER_ROWS.Transaksi || 2;

  for (var i = startRow; i < raw.length; i++) {
    var row = raw[i];
    var valTgl = row[2]; // Kolom C: Tanggal
    var tanggalRaw = "";

    if (valTgl instanceof Date) {
      tanggalRaw = Utilities.formatDate(valTgl, "GMT+7", "dd/MM/yyyy");
    } else if (valTgl) {
      tanggalRaw = String(valTgl).trim();
    }

    if (!tanggalRaw || tanggalRaw.indexOf("/") === -1) continue;

    var dp = tanggalRaw.split("/");
    if (dp.length !== 3) continue;

    var dd = parseInt(dp[0], 10);
    var mm = parseInt(dp[1], 10);
    var yyyy = parseInt(dp[2], 10);
    if (isNaN(dd) || isNaN(mm) || isNaN(yyyy)) continue;

    var jenisRaw = String(row[3] || "").toLowerCase().trim(); // Kolom D: Jenis
    var nominal = (typeof row[5] === 'number')                // Kolom F: Uang
      ? row[5]
      : Number(String(row[5] || "").replace(/[^0-9]/g, '')) || 0;

    out.push({
      id: String(row[0] || ""),             // Kolom A: ID
      token: String(row[1] || ""),          // Kolom B: Token
      tanggalRaw: pad2_(dd) + "/" + pad2_(mm) + "/" + yyyy,
      hari: pad2_(dd),
      bulan: pad2_(mm),
      tahun: String(yyyy),
      bulanTahun: pad2_(mm) + "-" + yyyy,
      jenis: jenisRaw.indexOf("masuk") !== -1 ? "masuk" : "keluar",
      dompet: normalizeDompet_(row[4]),     // Kolom E: Dompet
      nominal: nominal,
      kategori: String(row[6] || "-"),     // Kolom G: Kategori
      detail: String(row[7] || "-"),       // Kolom H: Detail
      chatId: String(row[8] || "").trim(), // Kolom I: ChatID
      username: String(row[9] || "").trim(), // Kolom J: Username
      nama: String(row[10] || "").trim()    // Kolom K: Nama
    });
  }
  return out;
}

function generateCustomId_(tanggalSlash, jenis, dompet) {
  var dp = tanggalSlash.split("/");
  var codeJ = (jenis.toLowerCase() === "masuk") ? "MS" : "KL";
  var codeD = dompet.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().substring(0, 2) || "XX";
  var suffix = codeJ + codeD + dp[0] + dp[1] + dp[2].substring(2);
  var rows = getDashboardRows_();
  var count = 1;
  rows.forEach(function (r) {
    if (r.id.indexOf(suffix) !== -1) count++;
  });
  return count + suffix;
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

function resolveUser_(chatId, username, nama) {
  var sheet = getUsersSheet_();
  if (!sheet) return null;
  var rows = sheet.getDataRange().getValues();
  var normUser = normalizeUsername_(username);

  for (var i = HEADER_ROWS.Users; i < rows.length; i++) {
    var uRow = normalizeUsername_(rows[i][0]);
    var cRow = String(rows[i][1] || "").trim();

    // Cocokkan ChatID terlebih dahulu
    if (cRow && cRow === String(chatId)) {
      return {
        rowIndex: i + 1,
        Username: rows[i][0],
        ChatID: String(chatId),
        Nama: rows[i][2] || nama,
        Role: (rows[i][3] || "user").toLowerCase()
      };
    }
  }
  return null;
}

function addUserRow_(username, chatId, nama, role) {
  getUsersSheet_().appendRow([username || "", chatId ? String(chatId) : "", nama || "", role, new Date()]);
}

function countUsers_() {
  return Math.max(0, getUsersSheet_().getLastRow() - HEADER_ROWS.Users);
}

function normalizeUsername_(u) {
  return String(u || "").trim().replace(/^@/, "").toLowerCase();
}

function isBootstrapSuperAdmin_(chatId) {
  return BOOTSTRAP_SUPERADMIN_IDS.indexOf(String(chatId)) !== -1;
}

function handleHapusTransaksi_(msgText, user) {
  var p = msgText.split(" ").filter(Boolean);
  if (p.length < 2) return "⚠️ Format: <code>/hapus &lt;ID&gt;</code>";
  var raw = getDashboardSheet_().getDataRange().getValues();
  var startRow = HEADER_ROWS.Transaksi || 2;
  for (var i = startRow; i < raw.length; i++) {
    if (String(raw[i][0]).toUpperCase() === p[1].toUpperCase()) {
      var owner = String(raw[i][7] || "");
      if (owner !== String(user.ChatID) && user.Role !== "admin" && user.Role !== "superadmin") {
        return "❌ Kamu hanya bisa menghapus transaksi milikmu sendiri.";
      }
      getDashboardSheet_().deleteRow(i + 1);
      return "✅ Transaksi <code>" + p[1] + "</code> berhasil dihapus.";
    }
  }
  return "⚠️ ID transaksi <code>" + p[1] + "</code> tidak ditemukan.";
}

function handleTambahUser_(msgText, caller) {
  var callerRole = (caller.Role || "").toLowerCase();
  if (callerRole !== "admin" && callerRole !== "superadmin") {
    return "❌ Akses ditolak. Hanya Admin atau Superadmin yang dapat menambah pengguna.";
  }

  var parts = msgText.split(" ").filter(Boolean);
  if (parts.length < 3) {
    return "⚠️ Format salah.\n" +
      "• Format: <code>/tambahuser [id/username] [role] [nama_lengkap]</code>\n" +
      "• Contoh: <code>/tambahuser 1020532606 user Irfani Putri</code>";
  }

  var targetInput = parts[1].trim();
  var newRole = parts[2].toLowerCase();
  // Mengambil nama lengkap jika disertakan di belakang perintah
  var customName = parts.slice(3).join(" ").trim();

  if (newRole !== "user" && newRole !== "admin" && newRole !== "superadmin") {
    return "⚠️ Role harus 'user', 'admin', atau 'superadmin'.";
  }

  if (callerRole === "admin" && (newRole === "admin" || newRole === "superadmin")) {
    return "❌ Admin biasa hanya dapat menambahkan role 'user'.";
  }

  var ss;
  if (typeof getSpreadsheet_ === "function") {
    ss = getSpreadsheet_();
  } else {
    var props = PropertiesService.getScriptProperties();
    var sheetUrl = props.getProperty("SPREADSHEET_URL");
    ss = sheetUrl ? SpreadsheetApp.openByUrl(sheetUrl) : SpreadsheetApp.getActiveSpreadsheet();
  }

  var sheet = ss.getSheetByName("Users");
  if (!sheet) return "❌ Sheet 'Users' tidak ditemukan di Spreadsheet.";

  var data = sheet.getDataRange().getValues();
  var isNumericId = /^\d+$/.test(targetInput);
  var targetUsername = isNumericId ? "" : (typeof normalizeUsername_ === "function" ? normalizeUsername_(targetInput) : targetInput.replace("@", "").trim().toLowerCase());
  var targetChatId = isNumericId ? targetInput : "";

  // 1. Jika sudah ada di sheet Users, perbarui Role dan Nama
  for (var i = 1; i < data.length; i++) {
    var rowUser = (typeof normalizeUsername_ === "function" ? normalizeUsername_(data[i][0]) : String(data[i][0] || "").replace("@", "").trim().toLowerCase());
    var rowChatId = String(data[i][1] || "").trim();

    if ((isNumericId && rowChatId === targetChatId) || (!isNumericId && rowUser && rowUser === targetUsername)) {
      sheet.getRange(i + 1, 4).setValue(newRole);
      if (customName) {
        sheet.getRange(i + 1, 3).setValue(customName);
      }
      return "✅ Data pengguna <b>" + (customName || targetInput) + "</b> berhasil diperbarui menjadi <b>" + newRole + "</b>.";
    }
  }

  // 2. Jika pendaftar baru, simpan nama Telegram yang sebenarnya
  var nowStr = Utilities.formatDate(new Date(), "GMT+7", "dd/MM/yyyy HH:mm:ss");
  var userCol = targetUsername ? "@" + targetUsername : "-";
  var chatIdCol = targetChatId ? "'" + targetChatId : "";
  var dispNameCol = customName || (isNumericId ? ("User " + targetChatId) : targetUsername);

  sheet.appendRow([userCol, chatIdCol, dispNameCol, newRole, nowStr]);

  if (targetChatId) {
    try {
      sendMessage(targetChatId, "🎉 <b>Yeay!</b> Akunmu telah disetujui sebagai <b>" + newRole + "</b>. Silakan ketik /menu untuk mulai.");
    } catch (e) { }
  }

  return "✅ Pengguna <b>" + dispNameCol + "</b> berhasil didaftarkan sebagai <b>" + newRole + "</b>.";
}

function handleHapusUser_(msgText, caller) {
  if (caller.Role !== "admin" && caller.Role !== "superadmin") return "❌ Khusus admin/superadmin.";
  var p = msgText.split(" ").filter(Boolean);
  if (p.length < 2) return "⚠️ Format: <code>/hapususer @username</code>";
  var sheet = getUsersSheet_();
  var rows = sheet.getDataRange().getValues();
  var uTarget = normalizeUsername_(p[1]);
  for (var i = HEADER_ROWS.Users; i < rows.length; i++) {
    if (normalizeUsername_(rows[i][0]) === uTarget) {
      sheet.deleteRow(i + 1);
      return "✅ @" + uTarget + " telah dihapus.";
    }
  }
  return "⚠️ User @" + uTarget + " tidak ditemukan.";
}

function handleListUsers_(caller) {
  var callerRole = (caller.Role || "").toLowerCase();
  if (callerRole !== "admin" && callerRole !== "superadmin") {
    return "❌ Akses ditolak. Hanya Admin atau Superadmin yang dapat melihat daftar pengguna.";
  }

  var ss = (typeof getSpreadsheet_ === "function") ? getSpreadsheet_() : SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Users");
  if (!sheet) return "❌ Sheet 'Users' tidak ditemukan.";

  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return "📭 Belum ada pengguna yang terdaftar.";

  var keyboardUsers = [];

  for (var i = 1; i < data.length; i++) {
    var rawUser = String(data[i][0] || "").replace(/^@+/, "").trim();
    var cId = String(data[i][1] || "").trim();
    var dName = String(data[i][2] || "").trim();
    var role = String(data[i][3] || "user").trim();

    if (!cId && !rawUser) continue;

    // Normalisasi tampilan label tombol
    var labelNama = dName && dName !== "." ? dName : (rawUser ? "@" + rawUser : "ID: " + cId);
    var badgeRole = role === "superadmin" ? "👑" : (role === "admin" ? "🛡️" : "👤");

    keyboardUsers.push([
      {
        text: badgeRole + " " + labelNama + " (" + role + ")",
        callback_data: "mg_usr_" + cId
      }
    ]);
  }

  keyboardUsers.push([{ text: "🔙 Tutup Menu", callback_data: "cancel_appr" }]);

  return {
    pesan: "👥 <b>PANEL MANAJEMEN PENGGUNA</b>\n\nKlik nama pengguna di bawah untuk mengedit role atau menghapus akun:",
    keyboard: keyboardUsers
  };
}

function getUserByUsername_(username) {
  var norm = normalizeUsername_(username);
  if (!norm) return null;
  var sheet = getUsersSheet_();
  var rows = sheet.getDataRange().getValues();
  for (var i = HEADER_ROWS.Users; i < rows.length; i++) {
    if (normalizeUsername_(rows[i][0]) === norm) {
      return {
        rowIndex: i + 1,
        Username: rows[i][0],
        ChatID: String(rows[i][1] || "").trim(),
        Nama: rows[i][2] || "",
        Role: String(rows[i][3] || "user").toLowerCase()
      };
    }
  }
  return null;
}

// ==========================================
// HITUNG DATA KEUANGAN FLEKSIBEL UNTUK AI
// Periode: "kemarin", "minggulalu", "bulanlalu"
// ==========================================

function getRekapPeriodeEvaluasi_(chatId, periode) {
  var rows = getDashboardRows_();
  var now = new Date();
  var totalMasuk = 0;
  var totalKeluar = 0;
  var kategoriKeluar = {};
  var labelPeriode = "";

  if (periode === "kemarin") {
    var dKemarin = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    var tglTarget = Utilities.formatDate(dKemarin, "GMT+7", "dd/MM/yyyy");
    labelPeriode = "Kemarin (" + tglTarget + ")";

    rows.forEach(function (r) {
      if (String(r.chatId) === String(chatId) && r.tanggalRaw === tglTarget) {
        if (r.jenis === "masuk") totalMasuk += r.nominal;
        if (r.jenis === "keluar") {
          totalKeluar += r.nominal;
          var kat = r.kategori || "Lain-lain";
          kategoriKeluar[kat] = (kategoriKeluar[kat] || 0) + r.nominal;
        }
      }
    });

  } else if (periode === "minggulalu") {
    // Menghitung Senin - Minggu pada pekan lalu
    var dayOfWeek = now.getDay(); // 0: Minggu, 1: Senin, dst.
    var distanceToMon = (dayOfWeek === 0) ? 6 : (dayOfWeek - 1);

    var startLastWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - distanceToMon - 7);
    var endLastWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - distanceToMon - 1);

    var startStr = Utilities.formatDate(startLastWeek, "GMT+7", "dd/MM/yyyy");
    var endStr = Utilities.formatDate(endLastWeek, "GMT+7", "dd/MM/yyyy");
    labelPeriode = "Minggu Lalu (" + startStr + " s/d " + endStr + ")";

    rows.forEach(function (r) {
      if (String(r.chatId) === String(chatId)) {
        var dp = r.tanggalRaw.split("/");
        var rowDate = new Date(parseInt(dp[2], 10), parseInt(dp[1], 10) - 1, parseInt(dp[0], 10));
        if (rowDate >= startLastWeek && rowDate <= endLastWeek) {
          if (r.jenis === "masuk") totalMasuk += r.nominal;
          if (r.jenis === "keluar") {
            totalKeluar += r.nominal;
            var kat = r.kategori || "Lain-lain";
            kategoriKeluar[kat] = (kategoriKeluar[kat] || 0) + r.nominal;
          }
        }
      }
    });

  } else {
    // Default: Bulan Lalu
    var targetDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    var targetBulan = pad2_(targetDate.getMonth() + 1);
    var targetTahun = String(targetDate.getFullYear());
    var targetBulanTahun = targetBulan + "-" + targetTahun;
    labelPeriode = "Bulan Lalu (" + targetBulanTahun + ")";

    rows.forEach(function (r) {
      if (String(r.chatId) === String(chatId) && r.bulanTahun === targetBulanTahun) {
        if (r.jenis === "masuk") totalMasuk += r.nominal;
        if (r.jenis === "keluar") {
          totalKeluar += r.nominal;
          var kat = r.kategori || "Lain-lain";
          kategoriKeluar[kat] = (kategoriKeluar[kat] || 0) + r.nominal;
        }
      }
    });
  }

  var katSorted = Object.keys(kategoriKeluar).map(function (k) {
    return { nama: k, total: kategoriKeluar[k] };
  }).sort(function (a, b) {
    return b.total - a.total;
  });

  return {
    label: labelPeriode,
    pemasukan: totalMasuk,
    pengeluaran: totalKeluar,
    selisih: totalKeluar - totalMasuk,
    topKategori: katSorted.slice(0, 3)
  };
}