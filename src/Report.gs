// ==========================================
// KALKULASI & PENYUSUNAN LAPORAN LENGKAP
// ==========================================

// Ganti fungsi routerRingkasanDanDetail_ dengan yang ini:
function routerRingkasanDanDetail_(msgText, caller, isDetail) {
  var parts = msgText.split(" ").filter(Boolean);
  var arg = (parts[1] || "").toLowerCase();

  var isGlobal = false;
  var filterIndex = parts.indexOf("semua");
  if (filterIndex !== -1) {
    if (caller.Role !== "admin" && caller.Role !== "superadmin") {
      return "❌ Hanya admin yang dapat melihat laporan seluruh pengguna.";
    }
    isGlobal = true;
    parts.splice(filterIndex, 1);
    arg = (parts[1] || "").toLowerCase();
  }

  // 1. Hari Ini
  if (arg === "hariini" || arg === "harian") {
    var todaySlash = Utilities.formatDate(new Date(), "GMT+7", "dd/MM/yyyy");
    return generateLaporanByTanggal_(caller, todaySlash, isDetail, isGlobal);
  }

  // 2. MINGGU INI (BARU DITAMBAHKAN)
  if (arg === "mingguini" || arg === "mingguan") {
    return generateLaporanMingguIni_(caller, isDetail, isGlobal);
  }

  // 3. Bulan Ini
  if (arg === "bulanini" || arg === "bulanan") {
    var thisMonth = Utilities.formatDate(new Date(), "GMT+7", "MM-yyyy");
    return generateLaporanByBulan_(caller, thisMonth, isDetail, isGlobal);
  }

  // 4. Tanggal Khusus (DD-MM-YYYY)
  if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(arg)) {
    var p = parseTanggalDDMMYYYY_(arg);
    var tglSlash = pad2_(p.day) + "/" + pad2_(p.month) + "/" + p.year;
    return generateLaporanByTanggal_(caller, tglSlash, isDetail, isGlobal);
  }

  // 5. Bulan Khusus (MM-YYYY)
  if (/^\d{1,2}-\d{4}$/.test(arg)) {
    var pM = monthYearRange_(arg);
    var blnPad = pad2_(pM.mm) + "-" + pM.yyyy;
    return generateLaporanByBulan_(caller, blnPad, isDetail, isGlobal);
  }

  // 6. Default: Semua Akumulasi
  return generateLaporanSemua_(caller, isDetail, isGlobal);
}

// FUNGSI BARU: Laporan Minggu Ini (Mulai Senin s/d Hari Ini)
function generateLaporanMingguIni_(caller, isDetail, isGlobal) {
  var now = new Date();
  var dayOfWeek = now.getDay(); // 0 = Minggu, 1 = Senin, ...
  var diffToMonday = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;
  
  var monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  var endOfWeek = new Date(monday);
  endOfWeek.setDate(monday.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  var tglAwalStr = Utilities.formatDate(monday, "GMT+7", "dd/MM/yyyy");
  var tglAkhirStr = Utilities.formatDate(endOfWeek, "GMT+7", "dd/MM/yyyy");

  var allRows = getDashboardRows_();
  if (!isGlobal) {
    allRows = allRows.filter(function(r) { return String(r.chatId) === String(caller.ChatID); });
  }

  var txRows = allRows.filter(function(r) {
    var p = parseTanggalDDMMYYYY_(r.tanggalRaw.replace(/\//g, "-"));
    if (!p) return false;
    var rowDate = new Date(p.year, p.month - 1, p.day, 12, 0, 0);
    return rowDate >= monday && rowDate <= endOfWeek;
  });

  if (txRows.length === 0) {
    return "📭 Belum ada data transaksi minggu ini (" + tglAwalStr + " s/d " + tglAkhirStr + ").";
  }

  return formatOutputLaporan_("MINGGU INI (" + tglAwalStr + " - " + tglAkhirStr + ")", caller, txRows, isDetail, isGlobal);
}

// Laporan Tanggal Tertentu
function generateLaporanByTanggal_(caller, tglSlash, isDetail, isGlobal) {
  var rows = getDashboardRows_().filter(function(r) { return r.tanggalRaw === tglSlash; });
  if (!isGlobal) {
    rows = rows.filter(function(r) { return String(r.chatId) === String(caller.ChatID); });
  }

  if (rows.length === 0) {
    return "📭 Belum ada data transaksi pada tanggal " + tglSlash + " (" + (isGlobal ? "Semua User" : caller.Nama) + ").";
  }

  return formatOutputLaporan_("HARIAN (" + tglSlash + ")", caller, rows, isDetail, isGlobal);
}

// Laporan Bulan Tertentu
function generateLaporanByBulan_(caller, blnPad, isDetail, isGlobal) {
  var allRows = getDashboardRows_();
  if (!isGlobal) {
    allRows = allRows.filter(function(r) { return String(r.chatId) === String(caller.ChatID); });
  }

  var txRows = allRows.filter(function(r) { return r.bulanTahun === blnPad; });
  if (txRows.length === 0) {
    return "📭 Belum ada data transaksi periode " + blnPad + " (" + (isGlobal ? "Semua User" : caller.Nama) + ").";
  }

  var msg = formatOutputLaporan_("BULANAN (" + blnPad + ")", caller, txRows, isDetail, isGlobal);

  // Evaluasi Perbandingan Bulan Sebelumnya
  var parts = blnPad.split("-");
  var curMM = parseInt(parts[0], 10), curYYYY = parseInt(parts[1], 10);
  var prevMM = curMM === 1 ? 12 : curMM - 1;
  var prevYYYY = curMM === 1 ? curYYYY - 1 : curYYYY;
  var prevBlnPad = pad2_(prevMM) + "-" + prevYYYY;

  var prevTxRows = allRows.filter(function(r) { return r.bulanTahun === prevBlnPad; });
  if (prevTxRows.length > 0) {
    var curKeluar = txRows.reduce(function(acc, r) { return r.jenis === "keluar" ? acc + r.nominal : acc; }, 0);
    var prevKeluar = prevTxRows.reduce(function(acc, r) { return r.jenis === "keluar" ? acc + r.nominal : acc; }, 0);
    var selisih = curKeluar - prevKeluar;

    msg += "\n💡 <b>EVALUASI DENGAN BULAN SEBELUMNYA (" + prevBlnPad + "):</b>\n";
    if (selisih > 0) {
      msg += "⚠️ Pengeluaran naik Rp " + selisih.toLocaleString('id-ID') + ". Lebih hemat lagi yuk! 💸";
    } else if (selisih < 0) {
      msg += "🎉 Lebih hemat Rp " + Math.abs(selisih).toLocaleString('id-ID') + ". Mantap, pertahankan! 👍";
    } else {
      msg += "⚖️ Pengeluaran sama persis dengan bulan lalu.";
    }
  }

  return msg;
}

// Laporan Seluruh Transaksi (Akumulasi Total)
function generateLaporanSemua_(caller, isDetail, isGlobal) {
  var rows = getDashboardRows_();
  if (!isGlobal) {
    rows = rows.filter(function(r) { return String(r.chatId) === String(caller.ChatID); });
  }

  if (rows.length === 0) {
    return "📭 Belum ada catatan transaksi sama sekali.";
  }

  return formatOutputLaporan_("KESELURUHAN (TOTAL SEMUA)", caller, rows, isDetail, isGlobal);
}

// Format Tampilan Output (Ringkasan vs Detail)
function formatOutputLaporan_(judulPeriode, caller, rows, isDetail, isGlobal) {
  var totalMasuk = 0, totalKeluar = 0;
  var perDompet = {};
  var listDetail = [];

  rows.forEach(function(r) {
    var dNama = normalizeDompet_(r.dompet);

    if (r.jenis === "masuk") totalMasuk += r.nominal;
    if (r.jenis === "keluar") totalKeluar += r.nominal;

    if (!perDompet[dNama]) perDompet[dNama] = { masuk: 0, keluar: 0 };
    if (r.jenis === "masuk") perDompet[dNama].masuk += r.nominal;
    else perDompet[dNama].keluar += r.nominal;

    if (isDetail) {
      var icon = r.jenis === "masuk" ? "📥" : "📤";
      var ket = r.detail && r.detail !== "-" ? " (" + r.detail + ")" : "";
      var kat = r.kategori && r.kategori !== "-" ? " [" + r.kategori + "]" : "";
      var tagUser = isGlobal ? " - <i>" + (r.nama || "User") + "</i>" : "";
      listDetail.push(icon + " " + r.tanggalRaw + " • <b>" + dNama + "</b>" + kat + ": Rp " + r.nominal.toLocaleString('id-ID') + ket + tagUser);
    }
  });

  var scope = isGlobal ? "🌐 PENGGUNA: <b>Seluruh Pengguna</b>" : "👤 AKUN: <b>" + caller.Nama + "</b>";
  var header = (isDetail ? "📝 <b>DETAIL TRANSAKSI " : "📊 <b>RINGKASAN ") + judulPeriode + "</b>\n" + scope + "\n--------------------------------\n";

  var body = "";
  if (isDetail) {
    body = listDetail.join("\n") + "\n--------------------------------\n";
  } else {
    body = "💼 <b>TOTAL PER DOMPET:</b>\n";
    Object.keys(perDompet).sort().forEach(function(d) {
      body += "• " + d + " ➔ 📥 Rp " + perDompet[d].masuk.toLocaleString('id-ID') + " | 📤 Rp " + perDompet[d].keluar.toLocaleString('id-ID') + "\n";
    });
    body += "--------------------------------\n";
  }

  var footer = "📥 <b>Total Masuk:</b> Rp " + totalMasuk.toLocaleString('id-ID') + "\n" +
               "📤 <b>Total Keluar:</b> Rp " + totalKeluar.toLocaleString('id-ID') + "\n" +
               "🧮 <b>Net:</b> Rp " + (totalMasuk - totalKeluar).toLocaleString('id-ID');

  return header + body + footer;
}

function parseTanggalDDMMYYYY_(str) {
  var m = String(str).trim().match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (!m) return null;
  return { day: parseInt(m[1], 10), month: parseInt(m[2], 10), year: parseInt(m[3], 10) };
}

function monthYearRange_(str) {
  var p = String(str).split("-");
  var mm = parseInt(p[0], 10), yyyy = parseInt(p[1], 10);
  if (!mm || !yyyy) return null;
  return { mm: mm, yyyy: yyyy };
}

function pad2_(n) { return (n < 10 ? "0" : "") + n; }

// ==========================================
// LAPORAN KHUSUS OTORITAS ATAS (RINGKASAN & DETAIL)
// ==========================================
function handleLaporanKhusus_(msgText, caller, isDetail) {
  var callerRole = (caller.Role || "").toLowerCase();
  if (callerRole !== "admin" && callerRole !== "superadmin") {
    return "❌ Akses ditolak. Perintah ini hanya untuk Admin atau Superadmin.";
  }

  var parts = msgText.split(" ").filter(Boolean);
  var cmdName = isDetail ? "/detailkhusus" : "/ringkasankhusus";

  if (parts.length < 2) {
    return "⚠️ Format salah.\nContoh penggunaan:\n" +
           "• <code>" + cmdName + " @username</code>\n" +
           "• <code>" + cmdName + " @username hariini</code>\n" +
           "• <code>" + cmdName + " @username bulanini</code>\n" +
           "• <code>" + cmdName + " @username 06-11-2026</code>";
  }

  var targetUsername = normalizeUsername_(parts[1]);
  var targetUser = getUserByUsername_(targetUsername);

  if (!targetUser) {
    return "⚠️ Pengguna @" + targetUsername + " tidak ditemukan di daftar Users.";
  }

  var targetRole = (targetUser.Role || "user").toLowerCase();

  // Hirarki Otoritas: Admin biasa tidak boleh melihat data sesama Admin atau Superadmin
  if (callerRole === "admin" && (targetRole === "admin" || targetRole === "superadmin")) {
    return "❌ Akses ditolak. Admin hanya diperbolehkan melihat transaksi pengguna dengan role 'user'.";
  }

  // Filter Data Transaksi Milik Target
  var allRows = getDashboardRows_();
  var userRows = allRows.filter(function(r) {
    var matchChatId = targetUser.ChatID && String(r.chatId) === String(targetUser.ChatID);
    var matchUsername = r.username && normalizeUsername_(r.username) === targetUsername;
    return matchChatId || matchUsername;
  });

  if (userRows.length === 0) {
    return "📭 Belum ada riwayat transaksi yang dicatat oleh @" + targetUsername + ".";
  }

  // Filter Periode Waktu
  var filterWaktu = (parts[2] || "").toLowerCase();
  var judulPeriode = "KESELURUHAN (TOTAL SEMUA)";

  if (filterWaktu === "hariini") {
    var todaySlash = Utilities.formatDate(new Date(), "GMT+7", "dd/MM/yyyy");
    userRows = userRows.filter(function(r) { return r.tanggalRaw === todaySlash; });
    judulPeriode = "HARI INI (" + todaySlash + ")";
  } else if (filterWaktu === "bulanini") {
    var thisMonth = Utilities.formatDate(new Date(), "GMT+7", "MM-yyyy");
    userRows = userRows.filter(function(r) { return r.bulanTahun === thisMonth; });
    judulPeriode = "BULAN INI (" + thisMonth + ")";
  } else if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(filterWaktu)) {
    var p = parseTanggalDDMMYYYY_(filterWaktu);
    var tglSlash = pad2_(p.day) + "/" + pad2_(p.month) + "/" + p.year;
    userRows = userRows.filter(function(r) { return r.tanggalRaw === tglSlash; });
    judulPeriode = "TANGGAL (" + tglSlash + ")";
  } else if (/^\d{1,2}-\d{4}$/.test(filterWaktu)) {
    var pM = monthYearRange_(filterWaktu);
    var blnPad = pad2_(pM.mm) + "-" + pM.yyyy;
    userRows = userRows.filter(function(r) { return r.bulanTahun === blnPad; });
    judulPeriode = "BULAN (" + blnPad + ")";
  }

  if (userRows.length === 0) {
    return "📭 Tidak ada data transaksi @" + targetUsername + " pada periode " + judulPeriode + ".";
  }

  // Hitung Nominal & Susun Output
  var totalMasuk = 0, totalKeluar = 0;
  var perDompet = {};
  var listDetail = [];

  userRows.forEach(function(r) {
    var dNama = normalizeDompet_(r.dompet);
    if (r.jenis === "masuk") totalMasuk += r.nominal;
    if (r.jenis === "keluar") totalKeluar += r.nominal;

    if (!perDompet[dNama]) perDompet[dNama] = { masuk: 0, keluar: 0 };
    if (r.jenis === "masuk") perDompet[dNama].masuk += r.nominal;
    else perDompet[dNama].keluar += r.nominal;

    if (isDetail) {
      var icon = r.jenis === "masuk" ? "📥" : "📤";
      var ket = r.detail && r.detail !== "-" ? " (" + r.detail + ")" : "";
      var kat = r.kategori && r.kategori !== "-" ? " [" + r.kategori + "]" : "";
      listDetail.push(icon + " " + r.tanggalRaw + " • <b>" + dNama + "</b>" + kat + ": Rp " + r.nominal.toLocaleString('id-ID') + ket);
    }
  });

  var targetNameDisplay = targetUser.Nama ? targetUser.Nama + " (@" + targetUsername + ")" : "@" + targetUsername;
  var header = (isDetail ? "🔍 <b>DETAIL KHUSUS: " : "📊 <b>RINGKASAN KHUSUS: ") + targetNameDisplay + "</b>\n" +
               "🛡️ Role: <b>" + targetRole + "</b> | Periode: " + judulPeriode + "\n" +
               "--------------------------------\n";

  var body = "";
  if (isDetail) {
    body = listDetail.join("\n") + "\n--------------------------------\n";
  } else {
    body = "💼 <b>TOTAL PER DOMPET:</b>\n";
    Object.keys(perDompet).sort().forEach(function(d) {
      body += "• " + d + " ➔ 📥 Rp " + perDompet[d].masuk.toLocaleString('id-ID') + " | 📤 Rp " + perDompet[d].keluar.toLocaleString('id-ID') + "\n";
    });
    body += "--------------------------------\n";
  }

  var footer = "📥 <b>Total Masuk:</b> Rp " + totalMasuk.toLocaleString('id-ID') + "\n" +
               "📤 <b>Total Keluar:</b> Rp " + totalKeluar.toLocaleString('id-ID') + "\n" +
               "🧮 <b>Net:</b> Rp " + (totalMasuk - totalKeluar).toLocaleString('id-ID');

  return header + body + footer;
}