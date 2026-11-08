// ==========================================
// ENTRY POINT & ROUTER WEBHOOK (Main.gs)
// ==========================================

function doPost(e) {
  var chatId, telegramUsername, namaTelegram;
  try {
    var update = JSON.parse(e.postData.contents);

    // ==========================================
    // 1. TANGANI KLIK TOMBOL (CALLBACK QUERY)
    // ==========================================
    if (update.callback_query) {
      chatId = update.callback_query.message.chat.id;
      var callbackData = update.callback_query.data;
      var fromCb = update.callback_query.from || {};
      telegramUsername = fromCb.username || "";
      namaTelegram = [fromCb.first_name, fromCb.last_name].filter(Boolean).join(" ") || ("User " + chatId);

      ensureSheets_();
      var userCb = resolveUser_(chatId, telegramUsername, namaTelegram);
      if (!userCb) {
        sendMessage(chatId, "❌ Akses ditolak. Akun belum terdaftar.");
        return;
      }

      // Tombol Laporan
      if (callbackData === "btn_ringkasan_hariini") {
        sendMessage(chatId, routerRingkasanDanDetail_("/ringkasan hariini", userCb, false));
        return;
      } else if (callbackData === "btn_ringkasan_mingguini") {
        sendMessage(chatId, routerRingkasanDanDetail_("/ringkasan mingguini", userCb, false));
        return;
      } else if (callbackData === "btn_ringkasan_bulanini") {
        sendMessage(chatId, routerRingkasanDanDetail_("/ringkasan bulanini", userCb, false));
        return;
      } else if (callbackData === "btn_detail_hariini") {
        sendMessage(chatId, routerRingkasanDanDetail_("/detail hariini", userCb, true));
        return;
      } else if (callbackData === "btn_detail_mingguini") {
        sendMessage(chatId, routerRingkasanDanDetail_("/detail mingguini", userCb, true));
        return;
      } else if (callbackData === "btn_detail_bulanini") {
        sendMessage(chatId, routerRingkasanDanDetail_("/detail bulanini", userCb, true));
        return;
      } else if (callbackData === "btn_ringkasan_semua") {
        sendMessage(chatId, routerRingkasanDanDetail_("/ringkasan", userCb, false));
        return;
      } else if (callbackData === "btn_cara_input") {
        sendCaraInput(chatId);
        return;
      } else if (callbackData === "btn_users_list") {
        sendMessage(chatId, handleListUsers_(userCb));
        return;
      }

      // LANGKAH 1: User memilih Jenis (Keluar / Masuk) -> Tampilkan Pilihan Dompet
      if (callbackData.indexOf("confirm_struk_") === 0) {
        var partsCb = callbackData.split("_");
        var jenis = partsCb[2]; // Keluar atau Masuk
        var uang = partsCb[3];
        var kat = partsCb[4] || "Umum";
        var det = partsCb[5] || "-";

        var daftarDompet = getDaftarDompetUser_(chatId);
        var keyboardDompet = [];
        var rowTemp = [];

        // Susun tombol dompet (2 tombol per baris)
        daftarDompet.forEach(function(dmp, idx) {
          rowTemp.push({
            text: "💳 " + dmp,
            callback_data: "save_struk_" + jenis + "_" + encodeURIComponent(dmp) + "_" + uang + "_" + kat + "_" + det
          });
          if (rowTemp.length === 2 || idx === daftarDompet.length - 1) {
            keyboardDompet.push(rowTemp);
            rowTemp = [];
          }
        });

        keyboardDompet.push([{ text: "❌ Batalkan", callback_data: "cancel_struk" }]);

        var pesanDompet = "💼 <b>PILIH DOMPET / REKENING:</b>\n\n" +
          "• <b>Jenis:</b> " + jenis + "\n" +
          "• <b>Nominal:</b> Rp " + Number(uang).toLocaleString('id-ID') + "\n" +
          "• <b>Detail:</b> " + decodeURIComponent(det) + "\n\n" +
          "Pilih dompet yang digunakan untuk transaksi ini:";

        sendMessageWithKeyboard(chatId, pesanDompet, keyboardDompet);
        return;
      }

      // LANGKAH 2: User memilih Dompet -> Simpan ke Google Sheets
      if (callbackData.indexOf("save_struk_") === 0) {
        var pSave = callbackData.split("_");
        var jenisFinal = pSave[2];
        var dompetFinal = decodeURIComponent(pSave[3]);
        var uangFinal = pSave[4];
        var katFinal = decodeURIComponent(pSave[5] || "Umum");
        var detFinal = decodeURIComponent(pSave[6] || "-");

        var tglSlash = Utilities.formatDate(new Date(), "GMT+7", "dd/MM/yyyy");
        var newId = simpanBaris_(tglSlash, jenisFinal, dompetFinal, uangFinal, katFinal, detFinal, chatId, telegramUsername, userCb.Nama);

        sendMessage(chatId, "✅ <b>Transaksi dari Struk Berhasil Dicatat!</b>\n" +
          "• <b>Jenis:</b> " + jenisFinal + "\n" +
          "• <b>Nominal:</b> Rp " + Number(uangFinal).toLocaleString('id-ID') + "\n" +
          "• <b>Dompet:</b> " + dompetFinal + "\n" +
          "• <b>Kategori:</b> " + katFinal + "\n" +
          "• <b>Detail:</b> " + detFinal + "\n" +
          "🆔 ID: <code>" + newId + "</code>");
        return;
      }

      if (callbackData === "cancel_struk") {
        sendMessage(chatId, "❌ Pencatatan struk dibatalkan.");
        return;
      }
      return;
    }

    // Pastikan ada pesan masuk
    if (!update.message) return;

    chatId = update.message.chat.id;
    var from = update.message.from || {};
    telegramUsername = from.username || "";
    namaTelegram = [from.first_name, from.last_name].filter(Boolean).join(" ") || ("User " + chatId);

    ensureSheets_();
    var user = resolveUser_(chatId, telegramUsername, namaTelegram);

    // ==========================================
    // REGISTRASI USER BARU
    // ==========================================
    if (!user) {
      if (isBootstrapSuperAdmin_(chatId) && countUsers_() === 0) {
        addUserRow_(telegramUsername, chatId, namaTelegram, "superadmin");
        user = resolveUser_(chatId, telegramUsername, namaTelegram);
        sendMessage(chatId, "✅ Kamu otomatis terdaftar sebagai <b>Superadmin</b> pertama.");
      } else {
        var msgInit = update.message.text ? update.message.text.trim().toLowerCase() : "";
        var cmdInit = msgInit.split(" ")[0];
        if (cmdInit === "/daftar" || cmdInit === "/start") {
          notifikasiPendaftaranToAdmin_(chatId, telegramUsername, namaTelegram);
          sendMessage(chatId, 
            "⏳ <b>Permohonan Pendaftaran Terkirim!</b>\n\n" +
            "Notifikasi telah dikirim ke Admin. Harap tunggu persetujuan." +
            (telegramUsername ? "" : "\n\n⚠️ <b>Tips:</b> Pasang Username di akun Telegrammu.")
          );
          return;
        } else {
          sendMessage(chatId, "❌ Akses ditolak. Ketik <code>/daftar</code> untuk mengajukan akses.");
          return;
        }
      }
    }

    // ==========================================
    // B. DETEKSI GAMBAR / FOTO STRUK
    // ==========================================
    if (update.message.photo) {
      sendMessage(chatId, "🔍 <i>Sedang membaca struk dengan AI... Harap tunggu sebentar.</i>");

      var photos = update.message.photo;
      var fileId = photos[photos.length - 1].file_id;
      
      var imageBlob = getTelegramImageBlob_(fileId);
      if (!imageBlob) {
        sendMessage(chatId, "⚠️ Gagal mengunduh foto dari server Telegram.");
        return;
      }

      var dataStruk = parseStrukWithGemini_(imageBlob);

      if (!dataStruk || dataStruk.error) {
        sendMessage(chatId, "❌ <b>Gagal membaca struk:</b>\n<code>" + (dataStruk ? dataStruk.error : "Unknown error") + "</code>");
        return;
      }

      var konfirmasiMsg = "📸 <b>STRUK TERDETEKSI!</b>\n\n" +
        "• <b>Nominal:</b> Rp " + Number(dataStruk.nominal).toLocaleString('id-ID') + "\n" +
        "• <b>Kategori:</b> " + dataStruk.kategori + "\n" +
        "• <b>Detail:</b> " + dataStruk.detail + "\n\n" +
        "Pilih jenis transaksi untuk menyimpan:";

      var cleanKat = encodeURIComponent(dataStruk.kategori.substring(0, 10));
      var cleanDet = encodeURIComponent(dataStruk.detail.substring(0, 15));

      var keyboardConfirm = [
        [
          { text: "📤 Catat sbg Keluar", callback_data: "confirm_struk_Keluar_" + dataStruk.nominal + "_" + cleanKat + "_" + cleanDet },
          { text: "📥 Catat sbg Masuk", callback_data: "confirm_struk_Masuk_" + dataStruk.nominal + "_" + cleanKat + "_" + cleanDet }
        ],
        [
          { text: "❌ Batalkan", callback_data: "cancel_struk" }
        ]
      ];

      sendMessageWithKeyboard(chatId, konfirmasiMsg, keyboardConfirm);
      return;
    }

    // ==========================================
    // 2. TANGANI PESAN TEKS BIASA
    // ==========================================
    if (!update.message.text) return;
    var msgText = update.message.text.trim();
    var cmd = msgText.split(" ")[0].toLowerCase().split("@")[0];

    // Command Routing Bantuan & Registrasi
    if (cmd === "/start" || cmd === "/menu") { sendMenuUtama(chatId, user); return; }
    if (cmd === "/cara_input") { sendCaraInput(chatId); return; }
    if (cmd === "/daftar") { sendMessage(chatId, "✅ Kamu sudah terdaftar sebagai <b>" + user.Role + "</b>."); return; }

    // Routing RINGKASAN
    if (cmd === "/ringkasan") {
      sendMessage(chatId, routerRingkasanDanDetail_(msgText, user, false));
      return;
    }
    if (cmd === "/ringkasanhariini" || cmd === "/hariini") {
      sendMessage(chatId, routerRingkasanDanDetail_("/ringkasan hariini", user, false));
      return;
    }
    if (cmd === "/ringkasanmingguini" || cmd === "/mingguini") {
      sendMessage(chatId, routerRingkasanDanDetail_("/ringkasan mingguini", user, false));
      return;
    }
    if (cmd === "/ringkasanbulanini" || cmd === "/bulanini") {
      sendMessage(chatId, routerRingkasanDanDetail_("/ringkasan bulanini", user, false));
      return;
    }

    // Routing DETAIL
    if (cmd === "/detail") {
      sendMessage(chatId, routerRingkasanDanDetail_(msgText, user, true));
      return;
    }
    if (cmd === "/detailhariini") {
      sendMessage(chatId, routerRingkasanDanDetail_("/detail hariini", user, true));
      return;
    }
    if (cmd === "/detailmingguini") {
      sendMessage(chatId, routerRingkasanDanDetail_("/detail mingguini", user, true));
      return;
    }
    if (cmd === "/detailbulanini") {
      sendMessage(chatId, routerRingkasanDanDetail_("/detail bulanini", user, true));
      return;
    }

    // Command Khusus Otoritas Atas
    if (cmd === "/ringkasankhusus") {
      sendMessage(chatId, handleLaporanKhusus_(msgText, user, false));
      return;
    }
    if (cmd === "/detailkhusus") {
      sendMessage(chatId, handleLaporanKhusus_(msgText, user, true));
      return;
    }

    // Manajemen Transaksi & User
    if (cmd === "/hapus") { sendMessage(chatId, handleHapusTransaksi_(msgText, user)); return; }
    if (cmd === "/tambahuser") { sendMessage(chatId, handleTambahUser_(msgText, user)); return; }
    if (cmd === "/hapususer") { sendMessage(chatId, handleHapusUser_(msgText, user)); return; }
    if (cmd === "/users") { sendMessage(chatId, handleListUsers_(user)); return; }

    // Input Transaksi Teks (Sebaris atau Form Multiline)
    var data = parseInputTransaction_(msgText);
    if (data && data.Jenis && data.Uang && data.Dompet) {
      var tglSlash = Utilities.formatDate(new Date(), "GMT+7", "dd/MM/yyyy");
      if (data.Tanggal) {
        var parsedTgl = parseTanggalDDMMYYYY_(data.Tanggal);
        if (parsedTgl) tglSlash = pad2_(parsedTgl.day) + "/" + pad2_(parsedTgl.month) + "/" + parsedTgl.year;
      }

      var newId = simpanBaris_(tglSlash, data.Jenis, data.Dompet, data.Uang, data.Kategori || "-", data.Detail || "-", chatId, telegramUsername, user.Nama);
      sendMessage(chatId, "✅ <b>Catatan Berhasil Disimpan!</b>\n" +
        "• <b>Jenis:</b> " + data.Jenis + "\n" +
        "• <b>Nominal:</b> Rp " + Number(data.Uang).toLocaleString('id-ID') + "\n" +
        "• <b>Dompet:</b> " + normalizeDompet_(data.Dompet) + "\n" +
        "• <b>Kategori:</b> " + (data.Kategori || "-") + "\n" +
        "• <b>Detail:</b> " + (data.Detail || "-") + "\n" +
        "🆔 ID: <code>" + newId + "</code>");
    } else {
      sendMessage(chatId, "⚠️ Perintah atau format tidak dikenali. Ketik /menu untuk panduan.");
    }

  } catch (err) {
    if (chatId) sendMessage(chatId, "❌ Terjadi error: " + err.message);
  }
}

// Parser Input Transaksi (Fleksibel: Mendukung Uang / Nominal / Rp / titik / spasi)
function parseInputTransaction_(text) {
  if (text.indexOf(":") !== -1) {
    var lines = text.split("\n");
    var res = {};
    lines.forEach(function(l) {
      var p = l.split(":");
      if (p.length >= 2) {
        var k = p[0].trim().toLowerCase();
        var v = p.slice(1).join(":").trim();
        
        if (k.indexOf("jenis") !== -1 || k.indexOf("tipe") !== -1) {
          res.Jenis = normalizeJenis_(v);
        }
        if (k.indexOf("dompet") !== -1 || k.indexOf("rekening") !== -1 || k.indexOf("akun") !== -1) {
          res.Dompet = v;
        }
        // Mendukung kunci: uang, nominal, total, jumlah (dan menghapus Rp / titik)
        if (k.indexOf("uang") !== -1 || k.indexOf("nominal") !== -1 || k.indexOf("total") !== -1 || k.indexOf("jumlah") !== -1) {
          res.Uang = v.replace(/[^0-9]/g, '');
        }
        if (k.indexOf("kategori") !== -1 || k.indexOf("kat") !== -1) {
          res.Kategori = v;
        }
        if (k.indexOf("detail") !== -1 || k.indexOf("keterangan") !== -1 || k.indexOf("ket") !== -1) {
          res.Detail = v;
        }
        if (k.indexOf("tanggal") !== -1 || k.indexOf("tgl") !== -1) {
          res.Tanggal = v;
        }
      }
    });
    return (res.Jenis && res.Uang && res.Dompet) ? res : null;
  }

  // Format Cepat Sebaris (contoh: keluar 25000 BCA Makan Nasi padang)
  var parts = text.split(" ").filter(Boolean);
  if (parts.length >= 3) {
    var jenis = normalizeJenis_(parts[0]);
    var uang = parts[1].replace(/[^0-9]/g, '');
    if (jenis && uang) {
      return {
        Jenis: jenis,
        Uang: uang,
        Dompet: parts[2],
        Kategori: parts[3] || "Umum",
        Detail: parts.slice(4).join(" ") || "-"
      };
    }
  }
  return null;
}

function normalizeJenis_(str) {
  var s = String(str || "").toLowerCase();
  if (s.indexOf("masuk") !== -1 || s.indexOf("in") !== -1) return "Masuk";
  if (s.indexOf("keluar") !== -1 || s.indexOf("out") !== -1) return "Keluar";
  return null;
}