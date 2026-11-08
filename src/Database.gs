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
    var valTgl = row[1];
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

    var jenisRaw = String(row[2] || "").toLowerCase().trim();
    var nominal = (typeof row[4] === 'number') 
      ? row[4] 
      : Number(String(row[4] || "").replace(/[^0-9]/g, '')) || 0;

    out.push({
      id: String(row[0] || ""),
      tanggalRaw: pad2_(dd) + "/" + pad2_(mm) + "/" + yyyy,
      hari: pad2_(dd),
      bulan: pad2_(mm),
      tahun: String(yyyy),
      bulanTahun: pad2_(mm) + "-" + yyyy,
      jenis: jenisRaw.indexOf("masuk") !== -1 ? "masuk" : "keluar",
      dompet: normalizeDompet_(row[3]), // Menggunakan normalisasi kapitalisasi di sini
      nominal: nominal,
      kategori: String(row[5] || "-"),
      detail: String(row[6] || "-"),
      chatId: String(row[7] || "").trim(),
      username: String(row[8] || "").trim(),
      nama: String(row[9] || "").trim()
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
  rows.forEach(function(r) {
    if (r.id.indexOf(suffix) !== -1) count++;
  });
  return count + suffix;
}

function simpanBaris_(tanggal, jenis, dompet, uang, kategori, detail, chatId, username, nama) {
  var sheet = getDashboardSheet_();
  var rows = sheet.getDataRange().getValues();
  
  // Normalisasi data
  jenis = (jenis.toLowerCase() === "masuk" || jenis.toLowerCase() === "in") ? "Masuk" : "Keluar";
  dompet = normalizeDompet_(dompet);
  var uangNum = parseInt(String(uang).replace(/[^0-9]/g, ""), 10) || 0;
  // Bersihkan tanda @ agar selalu konsisten berupa teks username murni
var userRef = username ? String(username).replace(/^@/, "").trim() : (nama || "User");
  
  var tglStr = String(tanggal);
  var id = generateCustomId_(tglStr, jenis, dompet);

  var newRowData = [
    id,
    tglStr,
    jenis,
    dompet,
    uangNum,
    kategori || "Umum",
    detail || "-",
    String(chatId),
    userRef
  ];

  // Cari baris kosong pertama setelah header (kolom A kosong)
  var targetRow = -1;
  var startRow = HEADER_ROWS.Transaksi || 2;
  for (var i = startRow; i < rows.length; i++) {
    if (!rows[i][0] || String(rows[i][0]).trim() === "") {
      targetRow = i + 1; // 1-indexed di Google Sheets
      break;
    }
  }

  if (targetRow !== -1) {
    sheet.getRange(targetRow, 1, 1, newRowData.length).setValues([newRowData]);
  } else {
    sheet.appendRow(newRowData);
    targetRow = sheet.getLastRow();
  }

  // Format kolom nominal (Kolom E) menjadi format mata uang
  sheet.getRange(targetRow, 5).setNumberFormat('"Rp"#,##0');

  return id;
}

function resolveUser_(chatId, username, nama) {
  var sheet = getUsersSheet_();
  var rows = sheet.getDataRange().getValues();
  var normUser = normalizeUsername_(username);

  for (var i = HEADER_ROWS.Users; i < rows.length; i++) {
    var uRow = normalizeUsername_(rows[i][0]);
    var cRow = String(rows[i][1] || "").trim();
    if (cRow === String(chatId) || (normUser && uRow === normUser)) {
      if (!cRow && chatId) {
        sheet.getRange(i + 1, 2).setValue(String(chatId));
        sheet.getRange(i + 1, 3).setValue(nama);
      }
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
  if (caller.Role !== "admin" && caller.Role !== "superadmin") return "❌ Khusus admin/superadmin.";
  var p = msgText.split(" ").filter(Boolean);
  if (p.length < 3) return "⚠️ Format: <code>/tambahuser @username &lt;user|admin&gt;</code>";
  var u = normalizeUsername_(p[1]);
  var r = p[2].toLowerCase();
  addUserRow_(u, "", "", r);
  return "✅ @" + u + " berhasil didaftarkan sebagai <b>" + r + "</b>.";
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
  if (caller.Role !== "admin" && caller.Role !== "superadmin") return "❌ Khusus admin.";
  var rows = getUsersSheet_().getDataRange().getValues();
  var msg = "👥 <b>DAFTAR PENGGUNA TERDAFTAR:</b>\n";
  for (var i = HEADER_ROWS.Users; i < rows.length; i++) {
    if (rows[i][0] || rows[i][1]) {
      msg += "• @" + (rows[i][0] || "-") + " (" + (rows[i][2] || "User") + ") — <b>" + rows[i][3] + "</b>\n";
    }
  }
  return msg;
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