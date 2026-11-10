// ==========================================
// KALKULASI & PENYUSUNAN LAPORAN LENGKAP
// ==========================================

function padRight_(str, len) {
  str = String(str || "");
  while (str.length < len) str += " ";
  return str.substring(0, len);
}

function padLeft_(str, len) {
  str = String(str || "");
  while (str.length < len) str = " " + str;
  return str;
}


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

// Format Tampilan Output (Lengkap: Mutasi Periode + Saldo Real-Time Semua Dompet)
function formatOutputLaporan_(judulPeriode, caller, rows, isDetail, isGlobal) {
  var totalMasuk = 0, totalKeluar = 0;
  var perDompet = {};
  var listDetail = [];
  var garis = "──────────────────────────────";

  // 1. Hitung mutasi pada periode yang dipilih
  rows.forEach(function(r) {
    var dNama = normalizeDompet_(r.dompet);

    if (r.jenis === "masuk") totalMasuk += r.nominal;
    if (r.jenis === "keluar") totalKeluar += r.nominal;

    if (!perDompet[dNama]) perDompet[dNama] = { masuk: 0, keluar: 0 };
    if (r.jenis === "masuk") perDompet[dNama].masuk += r.nominal;
    else perDompet[dNama].keluar += r.nominal;

    if (isDetail) {
      var tglShort = r.tanggalRaw ? r.tanggalRaw.substring(0, 5) : "";
      var isMasuk = (r.jenis === "masuk");
      var dot = isMasuk ? "🟢" : "🔴";
      var judulItem = (r.detail && r.detail !== "-") ? r.detail : (r.kategori || "Transaksi");
      if (judulItem.length > 20) judulItem = judulItem.substring(0, 18) + "..";

      var nomStr = "Rp " + Number(r.nominal).toLocaleString('id-ID');
      var tagUser = isGlobal ? " • " + (r.nama || "User") : "";

      listDetail.push(dot + " <b>" + judulItem + "</b>: " + nomStr + "\n" +
                      "   <i>" + tglShort + " • " + dNama + " • " + (r.kategori || "Umum") + tagUser + "</i>");
    }
  });

  // 2. Hitung Sisa Saldo Nyata (Real-time) Seluruh Transaksi dari Awal
  var allRows = getDashboardRows_();
  if (!isGlobal) {
    allRows = allRows.filter(function(r) { return String(r.chatId) === String(caller.ChatID); });
  }

  var saldoRealtimePerDompet = {};
  var totalSaldoSemuaDompet = 0;

  allRows.forEach(function(r) {
    var dNama = normalizeDompet_(r.dompet);
    if (!saldoRealtimePerDompet[dNama]) saldoRealtimePerDompet[dNama] = 0;
    if (r.jenis === "masuk") {
      saldoRealtimePerDompet[dNama] += r.nominal;
      totalSaldoSemuaDompet += r.nominal;
    } else if (r.jenis === "keluar") {
      saldoRealtimePerDompet[dNama] -= r.nominal;
      totalSaldoSemuaDompet -= r.nominal;
    }
  });

  // Header Laporan
  var namaDisplay = (caller.Nama && caller.Nama.trim() !== ".") ? caller.Nama : (caller.Username ? "@" + caller.Username : "User");
  var scope = isGlobal ? "🌐 Pengguna: <b>Seluruh Pengguna</b>" : "👤 Akun: <b>" + namaDisplay + "</b>";
  var header = (isDetail ? "📝 <b>DETAIL " : "📊 <b>RINGKASAN ") + judulPeriode + "</b>\n" + scope + "\n" + garis + "\n";

  // Body Laporan
  var body = "";
  if (isDetail) {
    body = listDetail.join("\n\n") + "\n" + garis + "\n";
  } else {
    // Tabel Arus Periode Tersebut
    body = "<pre>";
    body += padRight_("DOMPET", 7) + padLeft_("IN / OUT", 11) + padLeft_("SELISIH", 12) + "\n";
    body += garis + "\n";

    var keys = Object.keys(perDompet).sort();
    keys.forEach(function(d, idx) {
      var inNom = perDompet[d].masuk || 0;
      var outNom = perDompet[d].keluar || 0;
      var selisihPeriode = inNom - outNom;

      var inStr = "+" + Number(inNom).toLocaleString('id-ID');
      var outStr = "-" + Number(outNom).toLocaleString('id-ID');
      var selisihStr = Number(selisihPeriode).toLocaleString('id-ID');

      body += padRight_(d, 7) + padLeft_(inStr, 11) + padLeft_(selisihStr, 12) + "\n";
      body += padRight_("", 7) + padLeft_(outStr, 11) + padLeft_("", 12) + "\n";

      if (idx < keys.length - 1) body += "\n";
    });

    body += garis + "\n";
    body += "</pre>\n";
  }

  // Ringkasan Periode
  var selisihTotal = totalMasuk - totalKeluar;
  var footerPeriode = "📥 <b>Total Masuk  :</b> Rp " + Number(totalMasuk).toLocaleString('id-ID') + "\n" +
                      "📤 <b>Total Keluar :</b> Rp " + Number(totalKeluar).toLocaleString('id-ID') + "\n" +
                      "⚖️ <b>Arus Kas Net :</b> <b>Rp " + Number(selisihTotal).toLocaleString('id-ID') + "</b>\n" +
                      garis + "\n";

  // Rincian Saldo Nyata (Real-time) Sekarang
  var footerSaldoNyata = "💼 <b>SISA SALDO DOMPET SEKARANG:</b>\n<pre>";
  Object.keys(saldoRealtimePerDompet).sort().forEach(function(d) {
    var sNom = Number(saldoRealtimePerDompet[d]).toLocaleString('id-ID');
    footerSaldoNyata += padRight_(d, 12) + ": Rp " + padLeft_(sNom, 13) + "\n";
  });
  footerSaldoNyata += garis + "\n";
  footerSaldoNyata += padRight_("TOTAL SALDO", 12) + ": Rp " + padLeft_(Number(totalSaldoSemuaDompet).toLocaleString('id-ID'), 13) + "\n";
  footerSaldoNyata += "</pre>";

  return header + body + footerPeriode + footerSaldoNyata;
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
      var tglShort = r.tanggalRaw ? r.tanggalRaw.substring(0, 5) : "";
      var isMasuk = (r.jenis === "masuk");
      var dot = isMasuk ? "🟢" : "🔴";
      var judulItem = (r.detail && r.detail !== "-") ? r.detail : (r.kategori || "Transaksi");
      if (judulItem.length > 20) judulItem = judulItem.substring(0, 18) + "..";

      var nomStr = "Rp " + Number(r.nominal).toLocaleString('id-ID');
      listDetail.push(dot + " <b>" + judulItem + "</b>: " + nomStr + "\n" +
                      "   <i>" + tglShort + " • " + dNama + " • " + (r.kategori || "Umum") + "</i>");
    }
  });

  var targetNameDisplay = targetUser.Nama ? targetUser.Nama + " (@" + targetUsername + ")" : "@" + targetUsername;
  var header = (isDetail ? "🔍 <b>DETAIL KHUSUS: " : "📊 <b>RINGKASAN KHUSUS: ") + targetNameDisplay + "</b>\n" +
               "🛡️ Role: <b>" + targetRole + "</b> | Periode: " + judulPeriode + "\n" +
               "--------------------------------\n";

  var body = "";
  if (isDetail) {
    body = listDetail.join("\n") + "\n\n";
  } else {
    var garis = "──────────────────────────────";
    body = "<pre>";
    body += padRight_("DOMPET", 7) + padLeft_("IN / OUT", 11) + padLeft_("SISA", 12) + "\n";
    body += garis + "\n";

    var keysKhusus = Object.keys(perDompet).sort();
    keysKhusus.forEach(function(d, idx) {
      var inNom = perDompet[d].masuk || 0;
      var outNom = perDompet[d].keluar || 0;
      var sisaDompet = inNom - outNom;

      var inStr = "+" + Number(inNom).toLocaleString('id-ID');
      var outStr = "-" + Number(outNom).toLocaleString('id-ID');
      var sisaStr = Number(sisaDompet).toLocaleString('id-ID');

      body += padRight_(d, 7) + padLeft_(inStr, 11) + padLeft_(sisaStr, 12) + "\n";
      body += padRight_("", 7) + padLeft_(outStr, 11) + padLeft_("", 12) + "\n";

      if (idx < keysKhusus.length - 1) {
        body += "\n";
      }
    });

    body += garis + "\n";
    body += "</pre>\n";
  }

  var sisaKhusus = totalMasuk - totalKeluar;
  var footer = "📥 <b>Total Masuk  :</b> Rp " + Number(totalMasuk).toLocaleString('id-ID') + "\n" +
               "📤 <b>Total Keluar :</b> Rp " + Number(totalKeluar).toLocaleString('id-ID') + "\n" +
               "💰 <b>Sisa Bersih  :</b> <b>Rp " + Number(sisaKhusus).toLocaleString('id-ID') + "</b>";

  return header + body + footer;
}