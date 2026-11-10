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
      
      // Validasi ketat: User wajib terdaftar aktif di sheet Users
      if (!userCb) {
        sendMessage(chatId, "⛔ <b>Akses Ditolak!</b>\nAkunmu belum terdaftar atau telah dinonaktifkan. Ketik <code>/daftar</code> untuk meminta persetujuan admin.");
        return;
      }

      // --- TOMBOL LAPORAN RINGKASAN & DETAIL ---
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
      } // Tombol Buka Panel Pengguna
      if (callbackData === "btn_users_list") {
        var panelRes = handleListUsers_(userCb);
        if (typeof panelRes === "object" && panelRes.keyboard) {
          sendMessageWithKeyboard(chatId, panelRes.pesan, panelRes.keyboard);
        } else {
          sendMessage(chatId, panelRes);
        }
        return;
      }

      // LANGKAH 1: Superadmin Memilih Salah Satu Pengguna
      if (callbackData.indexOf("mg_usr_") === 0) {
        if (userCb.Role !== "admin" && userCb.Role !== "superadmin") {
          sendMessage(chatId, "❌ Akses ditolak.");
          return;
        }

        var targetChatId = callbackData.split("_")[2];
        var ss = (typeof getSpreadsheet_ === "function") ? getSpreadsheet_() : SpreadsheetApp.getActiveSpreadsheet();
        var sheetU = ss.getSheetByName("Users");
        var valU = sheetU.getDataRange().getValues();
        var targetRowData = null;

        for (var rIdx = 1; rIdx < valU.length; rIdx++) {
          if (String(valU[rIdx][1]).trim() === targetChatId) {
            targetRowData = valU[rIdx];
            break;
          }
        }

        if (!targetRowData) {
          sendMessage(chatId, "⚠️ Pengguna tidak ditemukan di database.");
          return;
        }

        var tUname = String(targetRowData[0] || "").replace(/^@+/, "");
        var tDName = String(targetRowData[2] || "-");
        var tRole = String(targetRowData[3] || "user");

        var textPilihan = "⚙️ <b>KELOLA PENGGUNA:</b>\n\n" +
          "• <b>Nama:</b> " + tDName + "\n" +
          "• <b>Username:</b> " + (tUname ? "@" + tUname : "-") + "\n" +
          "• <b>Chat ID:</b> <code>" + targetChatId + "</code>\n" +
          "• <b>Role Saat Ini:</b> <b>" + tRole + "</b>\n\n" +
          "Pilih tindakan:";

        var kbTindakan = [
          [
            { text: "👤 Set sbg User", callback_data: "setr_" + targetChatId + "_user" }
          ]
        ];

        // Hanya Superadmin yang boleh menaikkan/menurunkan Admin & Superadmin
        if (userCb.Role === "superadmin") {
          kbTindakan.push([
            { text: "🛡️ Set sbg Admin", callback_data: "setr_" + targetChatId + "_admin" },
            { text: "👑 Set sbg Superadmin", callback_data: "setr_" + targetChatId + "_superadmin" }
          ]);
          kbTindakan.push([
            { text: "🗑️ Hapus Pengguna Ini", callback_data: "delu_confirm_" + targetChatId }
          ]);
        }

        kbTindakan.push([{ text: "🔙 Kembali ke Daftar", callback_data: "btn_users_list" }]);

        sendMessageWithKeyboard(chatId, textPilihan, kbTindakan);
        return;
      }

      // LANGKAH 2: Eksekusi Perubahan Role via Tombol
      if (callbackData.indexOf("setr_") === 0) {
        if (userCb.Role !== "admin" && userCb.Role !== "superadmin") {
          sendMessage(chatId, "❌ Akses ditolak.");
          return;
        }

        var sParts = callbackData.split("_");
        var tCId = sParts[1];
        var roleBaru = sParts[2];

        if (userCb.Role === "admin" && (roleBaru === "admin" || roleBaru === "superadmin")) {
          sendMessage(chatId, "❌ Admin biasa tidak bisa mengangkat admin lain.");
          return;
        }

        var ss = (typeof getSpreadsheet_ === "function") ? getSpreadsheet_() : SpreadsheetApp.getActiveSpreadsheet();
        var sheetU = ss.getSheetByName("Users");
        var valU = sheetU.getDataRange().getValues();

        for (var r = 1; r < valU.length; r++) {
          if (String(valU[r][1]).trim() === tCId) {
            sheetU.getRange(r + 1, 4).setValue(roleBaru);
            sendMessage(chatId, "✅ Role untuk ID <code>" + tCId + "</code> berhasil diubah menjadi <b>" + roleBaru + "</b>.");
            try {
              sendMessage(tCId, "ℹ️ Role akunmu telah diubah menjadi <b>" + roleBaru + "</b> oleh pengelola.");
            } catch (e) {}
            return;
          }
        }
        sendMessage(chatId, "⚠️ Gagal menemukan data akun.");
        return;
      }

      // LANGKAH 3: Eksekusi Hapus User via Tombol
      if (callbackData.indexOf("delu_confirm_") === 0) {
        if (userCb.Role !== "superadmin") {
          sendMessage(chatId, "❌ Hanya Superadmin yang berhak menghapus pengguna.");
          return;
        }

        var delCId = callbackData.split("_")[2];
        if (String(delCId) === String(chatId)) {
          sendMessage(chatId, "⚠️ Kamu tidak bisa menghapus akunmu sendiri.");
          return;
        }

        var ss = (typeof getSpreadsheet_ === "function") ? getSpreadsheet_() : SpreadsheetApp.getActiveSpreadsheet();
        var sheetU = ss.getSheetByName("Users");
        var valU = sheetU.getDataRange().getValues();

        for (var r = 1; r < valU.length; r++) {
          if (String(valU[r][1]).trim() === delCId) {
            sheetU.deleteRow(r + 1);
            sendMessage(chatId, "🗑️ Pengguna dengan ID <code>" + delCId + "</code> berhasil dihapus dari sistem.");
            try {
              sendMessage(delCId, "⚠️ Akses akunmu ke bot ini telah dinonaktifkan oleh Superadmin.");
            } catch (e) {}
            return;
          }
        }
        sendMessage(chatId, "⚠️ Akun tidak ditemukan.");
        return;
      }

      // --- TOMBOL EVALUASI KEUANGAN AI ---
      if (callbackData === "btn_eval_kemarin") {
        sendMessage(chatId, "⏳ <i>Meri sedang menganalisis keuangan kemarin...</i>");
        var rekap = getRekapPeriodeEvaluasi_(chatId, "kemarin");
        var pesan = generateAnalisisKeuanganGemini_(rekap, userCb.Nama);
        sendMessage(chatId, "💡 <b>EVALUASI KEUANGAN: KEMARIN</b>\n\n" + pesan);
        return;
      } else if (callbackData === "btn_eval_minggulalu") {
        sendMessage(chatId, "⏳ <i>Meri sedang menganalisis keuangan minggu lalu...</i>");
        var rekap = getRekapPeriodeEvaluasi_(chatId, "minggulalu");
        var pesan = generateAnalisisKeuanganGemini_(rekap, userCb.Nama);
        sendMessage(chatId, "💡 <b>EVALUASI KEUANGAN: MINGGU LALU</b>\n\n" + pesan);
        return;
      } else if (callbackData === "btn_eval_bulanlalu" || callbackData === "btn_evaluasi_ai") {
        sendMessage(chatId, "⏳ <i>Meri sedang menganalisis keuangan bulan lalu...</i>");
        var rekap = getRekapPeriodeEvaluasi_(chatId, "bulanlalu");
        var pesan = generateAnalisisKeuanganGemini_(rekap, userCb.Nama);
        sendMessage(chatId, "💡 <b>EVALUASI KEUANGAN: BULAN LALU</b>\n\n" + pesan);
        return;
      } else if (callbackData === "btn_ekspor_file") {
        sendMessage(chatId, "⏳ <i>Sedang menyiapkan rekapan transaksi keuanganmu...</i>");
        kirimFileExcelUser_(chatId, userCb.Nama);
        return;
      }

      // --- TOMBOL PERSETUJUAN PENDAFTARAN USER BARU ---
      // Langkah 1: Admin menekan tombol "Setujui" -> Tampilkan pilihan role
      if (callbackData.indexOf("appr_step1_") === 0) {
        if (userCb.Role !== "admin" && userCb.Role !== "superadmin") {
          sendMessage(chatId, "❌ Akses ditolak. Hanya admin yang berhak memproses pendaftaran.");
          return;
        }

        var p = callbackData.split("_");
        var targetCId = p[2];
        var targetUser = p[3];
        var targetName = p[4];

        var roleKeyboard = [
          [
            { text: "👤 User Biasa", callback_data: "appr_role_user_" + targetCId + "_" + targetUser + "_" + targetName }
          ]
        ];

        if (userCb.Role === "superadmin") {
          roleKeyboard.push([
            { text: "🛡️ Admin", callback_data: "appr_role_admin_" + targetCId + "_" + targetUser + "_" + targetName },
            { text: "👑 Superadmin", callback_data: "appr_role_superadmin_" + targetCId + "_" + targetUser + "_" + targetName }
          ]);
        }

        roleKeyboard.push([{ text: "🔙 Batalkan", callback_data: "cancel_appr" }]);

        var decName = decodeURIComponent(targetName);
        sendMessageWithKeyboard(chatId, "Pilih role untuk <b>" + decName + "</b> (ID: <code>" + targetCId + "</code>):", roleKeyboard);
        return;
      }

     // Langkah 2: Admin memilih role -> Simpan ke sheet Users
      if (callbackData.indexOf("appr_role_") === 0) {
        if (userCb.Role !== "admin" && userCb.Role !== "superadmin") {
          sendMessage(chatId, "❌ Akses ditolak.");
          return;
        }

        var rParts = callbackData.split("_");
        var roleDipilih = rParts[2];
        var targetCId = rParts[3];
        // SIMPAN TANPA @
        var rawUname = decodeURIComponent(rParts[4] || "");
        var targetUser = (rawUname && rawUname !== "-") ? rawUname.replace(/^@+/, "").trim() : "-";
        var targetName = decodeURIComponent(rParts[5] || "User");

        var ss = (typeof getSpreadsheet_ === "function") ? getSpreadsheet_() : SpreadsheetApp.getActiveSpreadsheet();
        var sheetUsers = ss.getSheetByName("Users");
        var dataU = sheetUsers.getDataRange().getValues();
        var updated = false;

        // 1. Cek jika ID sudah ada untuk update
        for (var idx = 1; idx < dataU.length; idx++) {
          if (String(dataU[idx][1]).trim() === String(targetCId)) {
            sheetUsers.getRange(idx + 1, 1).setValue(targetUser);
            sheetUsers.getRange(idx + 1, 3).setValue(targetName);
            sheetUsers.getRange(idx + 1, 4).setValue(roleDipilih);
            updated = true;
            break;
          }
        }

        // 2. Jika akun baru, cari baris kosong pertama untuk mengisi celah
        if (!updated) {
          var tglAppr = Utilities.formatDate(new Date(), "GMT+7", "dd/MM/yyyy HH:mm:ss");
          var targetRow = -1;

          for (var r = 1; r < dataU.length; r++) {
            // Baris dianggap kosong jika kolom Username (A) dan ChatId (B) kosong
            if (!String(dataU[r][0]).trim() && !String(dataU[r][1]).trim()) {
              targetRow = r + 1; // 1-indexed
              break;
            }
          }

          var newRowData = [targetUser, "'" + targetCId, targetName, roleDipilih, tglAppr];

          if (targetRow !== -1) {
            sheetUsers.getRange(targetRow, 1, 1, newRowData.length).setValues([newRowData]);
          } else {
            sheetUsers.appendRow(newRowData);
          }
        }

        sendMessage(chatId, "✅ <b>Pendaftaran Berhasil!</b>\n" +
          "• Nama: <b>" + targetName + "</b>\n" +
          "• Role: <b>" + roleDipilih + "</b>\n" +
          "• Chat ID: <code>" + targetCId + "</code>");

        try {
          sendMessage(targetCId, "🎉 <b>Selamat!</b> Akunmu telah disetujui sebagai <b>" + roleDipilih + "</b>.\nSilakan ketik /menu untuk mulai.");
        } catch (err) {}
        return;
      }

      // Tombol Tolak Pendaftaran
      if (callbackData.indexOf("reject_reg_") === 0) {
        var rejectId = callbackData.split("_")[2];
        sendMessage(chatId, "❌ Pendaftaran akun ID <code>" + rejectId + "</code> telah ditolak.");
        try {
          sendMessage(rejectId, "Mohon maaf, permohonan pendaftaran akunmu belum disetujui oleh admin.");
        } catch (err) {}
        return;
      }

      if (callbackData === "cancel_appr") {
        sendMessage(chatId, "Proses persetujuan pendaftaran dibatalkan.");
        return;
      }

      // --- ALUR SIMPAN TRANSAKSI STRUK ---
      // Langkah 1: User memilih Jenis -> Tampilkan pilihan Dompet
      if (callbackData.indexOf("confirm_struk_") === 0) {
        var partsCb = callbackData.split("_");
        var jenis = partsCb[2];
        var uang = partsCb[3];
        var kat = partsCb[4] || "Umum";
        var det = partsCb[5] || "-";

        var daftarDompet = getDaftarDompetUser_(chatId);
        var keyboardDompet = [];
        var rowTemp = [];

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

      // Langkah 2: User memilih Dompet -> Simpan transaksi
      if (callbackData.indexOf("save_struk_") === 0) {
        var pSave = callbackData.split("_");
        var jenisFinal = pSave[2];
        var dompetFinal = decodeURIComponent(pSave[3]);
        var uangFinal = pSave[4];
        var katFinal = decodeURIComponent(pSave[5] || "Umum");
        var detFinal = decodeURIComponent(pSave[6] || "-");
        var tglSlash = Utilities.formatDate(new Date(), "GMT+7", "dd/MM/yyyy");
        var newId = simpanBaris_(tglSlash, jenisFinal, dompetFinal, uangFinal, katFinal, detFinal, chatId, telegramUsername, userCb.Nama);

        var pesanStrukSukses = "✅ <b>Transaksi dari Struk Berhasil Dicatat!</b>\n\n" +
          "• <b>Jenis:</b> " + jenisFinal + "\n" +
          "• <b>Nominal:</b> Rp " + Number(uangFinal).toLocaleString('id-ID') + "\n" +
          "• <b>Dompet:</b> " + dompetFinal + "\n" +
          "• <b>Kategori:</b> " + katFinal + "\n" +
          "• <b>Detail:</b> " + detFinal + "\n" +
          "🆔 ID: <code>" + newId + "</code>\n\n" +
          "<i>💡 Mau edit? Ketik:</i>\n<code>/edit " + newId + " " + jenisFinal + " " + uangFinal + " " + dompetFinal + " " + katFinal + " " + detFinal + "</code>";

        var kbHapusStruk = [
          [{ text: "🗑️ Hapus Transaksi Ini", callback_data: "deltx_" + newId }]
        ];

        sendMessageWithKeyboard(chatId, pesanStrukSukses, kbHapusStruk);
        return;
      }

      // Tombol Cepat Hapus Transaksi Sekali Klik
      if (callbackData.indexOf("deltx_") === 0) {
        var idHapus = callbackData.split("_")[1];
        var hasilHapus = handleHapusTransaksi_("/hapus " + idHapus, userCb);
        sendMessage(chatId, hasilHapus);
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
    var lowerMsg = msgText.toLowerCase();
    var cmd = lowerMsg.split(" ")[0].split("@")[0];

    // Deteksi sapaan santai
    var sapaanKeywords = ["halo", "hai", "hei", "pagi", "siang", "malam", "assalamualaikum", "ping", "p", "test", "tes"];
    if (sapaanKeywords.indexOf(lowerMsg) !== -1) {
      sendMessage(chatId, responSapaan_(user.Nama));
      return;
    }

    if (lowerMsg.indexOf("makasih") !== -1 || lowerMsg.indexOf("terima kasih") !== -1 || lowerMsg.indexOf("thanks") !== -1) {
      sendMessage(chatId, "Sama-sama! Senang bisa bantu keuanganmu tetap tercatat rapi hari ini ✨");
      return;
    }

    // Command Routing Bantuan & Registrasi
    if (cmd === "/start" || cmd === "/menu") { sendMenuUtama(chatId, user); return; }
    if (cmd === "/cara_input") { sendCaraInput(chatId); return; }
    if (cmd === "/daftar") { sendMessage(chatId, "Akunmu sudah aktif terdaftar sebagai <b>" + user.Role + "</b> kok. Siap dipakai!"); return; }

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

    // Routing Perintah Evaluasi Teks
    if (cmd === "/evaluasikemarin" || msgText.toLowerCase() === "/evaluasi kemarin") {
      sendMessage(chatId, "⏳ <i>Meri sedang menganalisis pengeluaran kemarin...</i>");
      var rk = getRekapPeriodeEvaluasi_(chatId, "kemarin");
      sendMessage(chatId, "💡 <b>EVALUASI KEUANGAN: KEMARIN</b>\n\n" + generateAnalisisKeuanganGemini_(rk, user.Nama));
      return;
    }
    if (cmd === "/evaluasimingguini" || cmd === "/evaluasiminggulalu" || msgText.toLowerCase() === "/evaluasi minggulalu") {
      sendMessage(chatId, "⏳ <i>Meri sedang menganalisis pengeluaran minggu lalu...</i>");
      var rk = getRekapPeriodeEvaluasi_(chatId, "minggulalu");
      sendMessage(chatId, "💡 <b>EVALUASI KEUANGAN: MINGGU LALU</b>\n\n" + generateAnalisisKeuanganGemini_(rk, user.Nama));
      return;
    }
    if (cmd === "/evaluasi" || cmd === "/evaluasibulanlalu" || msgText.toLowerCase() === "/evaluasi bulanlalu") {
      sendMessage(chatId, "⏳ <i>Meri sedang menganalisis pengeluaran bulan lalu...</i>");
      var rk = getRekapPeriodeEvaluasi_(chatId, "bulanlalu");
      sendMessage(chatId, "💡 <b>EVALUASI KEUANGAN: BULAN LALU</b>\n\n" + generateAnalisisKeuanganGemini_(rk, user.Nama));
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

    // Routing Unduh / Ekspor Data
    if (cmd === "/ekspor" || cmd === "/download" || cmd === "/excel") {
      sendMessage(chatId, "⏳ <i>Sedang menyiapkan rekapan transaksi keuanganmu...</i>");
      kirimFileExcelUser_(chatId, user.Nama);
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
    if (cmd === "/edit") { sendMessage(chatId, handleEditTransaksi_(msgText, user)); return; }
    if (cmd === "/tambahuser") { sendMessage(chatId, handleTambahUser_(msgText, user)); return; }
    if (cmd === "/hapususer") { sendMessage(chatId, handleHapusUser_(msgText, user)); return; }
    if (cmd === "/users") { sendMessage(chatId, handleListUsers_(user)); return; }

    // Cek apakah pesan bermaksud mencatat transaksi terstruktur
    var kemungkinanCatatan = (cmd === "masuk" || cmd === "keluar" || msgText.indexOf(":") !== -1);
    var data = parseInputTransaction_(msgText);

    if (data && data.Jenis && data.Uang && data.Dompet) {
      var tglSlash = Utilities.formatDate(new Date(), "GMT+7", "dd/MM/yyyy");
      if (data.Tanggal) {
        var parsedTgl = parseTanggalDDMMYYYY_(data.Tanggal);
        if (parsedTgl) tglSlash = pad2_(parsedTgl.day) + "/" + pad2_(parsedTgl.month) + "/" + parsedTgl.year;
      }

      var newId = simpanBaris_(tglSlash, data.Jenis, data.Dompet, data.Uang, data.Kategori || "-", data.Detail || "-", chatId, telegramUsername, user.Nama);

      var pesanSukses = "🎉 <b>Catatan Berhasil Disimpan!</b>\n\n" +
        "• <b>Jenis:</b> " + data.Jenis + "\n" +
        "• <b>Nominal:</b> Rp " + Number(data.Uang).toLocaleString('id-ID') + "\n" +
        "• <b>Dompet:</b> " + normalizeDompet_(data.Dompet) + "\n" +
        "• <b>Kategori:</b> " + (data.Kategori || "-") + "\n" +
        "• <b>Detail:</b> " + (data.Detail || "-") + "\n\n" +
        "🆔 ID: <code>" + newId + "</code>\n\n" +
        "<i>💡 Mau edit? Ketik:</i>\n<code>/edit " + newId + " " + data.Jenis + " " + data.Uang + " " + data.Dompet + " " + (data.Kategori || "Umum") + " " + (data.Detail || "-") + "</code>";

      var kbHapus = [
        [{ text: "🗑️ Hapus Transaksi Ini", callback_data: "deltx_" + newId }]
      ];

      sendMessageWithKeyboard(chatId, pesanSukses, kbHapus);
    } else if (kemungkinanCatatan) {
      sendMessage(chatId, responSalahFormat_(msgText));
    } else {
      // Pemrosesan teks percakapan bebas atau transaksi non-formal dengan AI
      var aiResult = prosesPesanDenganGemini_(msgText, user.Nama);

      if (aiResult.tipe === "transaksi") {
        var tglNow = Utilities.formatDate(new Date(), "GMT+7", "dd/MM/yyyy");
        var aiId = simpanBaris_(
          tglNow, aiResult.jenis, aiResult.dompet, aiResult.nominal,
          aiResult.kategori || "Umum",
          aiResult.detail || "-",
          chatId, telegramUsername,
          user.Nama);

        var pesanAiSukses = "✨ <b>Transaksi Berhasil Dicatat oleh AI!</b>\n\n" +
          "• <b>Jenis:</b> " + aiResult.jenis + "\n" +
          "• <b>Nominal:</b> Rp " + Number(aiResult.nominal).toLocaleString('id-ID') + "\n" +
          "• <b>Dompet:</b> " + normalizeDompet_(aiResult.dompet) + "\n" +
          "• <b>Kategori:</b> " + (aiResult.kategori || "-") + "\n" +
          "• <b>Detail:</b> " + (aiResult.detail || "-") + "\n\n" +
          "🆔 ID: <code>" + aiId + "</code>\n\n" +
          "<i>💡 Mau edit? Ketik:</i>\n<code>/edit " + aiId + " " + aiResult.jenis + " " + aiResult.nominal + " " + normalizeDompet_(aiResult.dompet) + " " + (aiResult.kategori || "Umum") + " " + (aiResult.detail || "-") + "</code>";

        var kbHapusAi = [
          [{ text: "🗑️ Hapus Transaksi Ini", callback_data: "deltx_" + aiId }]
        ];

        sendMessageWithKeyboard(chatId, pesanAiSukses, kbHapusAi);
      } else {
        sendMessage(chatId, aiResult.pesan);
      }
    }

  } catch (err) {
    if (chatId) sendMessage(chatId, "❌ Terjadi error: " + err.message);
  }
}

// ==========================================
// FUNGSI NOTIFIKASI PENDAFTARAN KE ADMIN
// ==========================================
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
  adminList.forEach(function(adminChatId) {
    sendMessageWithKeyboard(adminChatId, pesanPendaftaran, keyboard);
  });
}

// ==========================================
// FUNGSI MANUAL /tambahuser
// ==========================================
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
  var customName = parts.slice(3).join(" ").trim();

  if (newRole !== "user" && newRole !== "admin" && newRole !== "superadmin") {
    return "⚠️ Role harus 'user', 'admin', atau 'superadmin'.";
  }

  if (callerRole === "admin" && (newRole === "admin" || newRole === "superadmin")) {
    return "❌ Admin biasa hanya dapat menambahkan role 'user'.";
  }

  var ss = (typeof getSpreadsheet_ === "function") ? getSpreadsheet_() : SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Users");
  if (!sheet) return "❌ Sheet 'Users' tidak ditemukan di Spreadsheet.";

  var data = sheet.getDataRange().getValues();
  var isNumericId = /^\d+$/.test(targetInput);
  var targetUsername = isNumericId ? "" : (typeof normalizeUsername_ === "function" ? normalizeUsername_(targetInput) : targetInput.replace("@", "").trim().toLowerCase());
  var targetChatId = isNumericId ? targetInput : "";

  for (var i = 1; i < data.length; i++) {
    var rowUser = (typeof normalizeUsername_ === "function" ? normalizeUsername_(data[i][0]) : String(data[i][0] || "").replace("@", "").trim().toLowerCase());
    var rowChatId = String(data[i][1] || "").trim();

    if ((isNumericId && rowChatId === targetChatId) || (!isNumericId && rowUser && rowUser === targetUsername)) {
      sheet.getRange(i + 1, 4).setValue(newRole);
      if (customName) sheet.getRange(i + 1, 3).setValue(customName);
      return "✅ Peran pengguna <b>" + (customName || targetInput) + "</b> berhasil diperbarui menjadi <b>" + newRole + "</b>.";
    }
  }

  var nowStr = Utilities.formatDate(new Date(), "GMT+7", "dd/MM/yyyy HH:mm:ss");
  // 1. Simpan username murni tanpa tanda @
  var userCol = targetUsername ? targetUsername.replace(/^@+/, "").trim() : "-";
  var chatIdCol = targetChatId ? "'" + targetChatId : "";
  var dispNameCol = customName || (isNumericId ? ("User " + targetChatId) : targetUsername);
  var newRowData = [userCol, chatIdCol, dispNameCol, newRole, nowStr];

  // 2. Cari baris kosong di tengah (jika ada baris yang selnya kosong)
  var targetRow = -1;
  for (var r = 1; r < data.length; r++) {
    var checkUser = String(data[r][0] || "").trim();
    var checkChatId = String(data[r][1] || "").trim();
    if (!checkUser && !checkChatId) {
      targetRow = r + 1; // Baris 1-indexed di spreadsheet
      break;
    }
  }

  // Jika ada baris kosong, isi baris tersebut. Jika tidak ada, baru taruh paling bawah
  if (targetRow !== -1) {
    sheet.getRange(targetRow, 1, 1, newRowData.length).setValues([newRowData]);
  } else {
    sheet.appendRow(newRowData);
  }

  if (targetChatId) {
    try {
      sendMessage(targetChatId, "🎉 <b>Selamat!</b> Akunmu telah disetujui sebagai <b>" + newRole + "</b>. Silakan ketik /menu untuk mulai.");
    } catch (e) {}
  }

  return "✅ Pengguna <b>" + dispNameCol + "</b> berhasil didaftarkan sebagai <b>" + newRole + "</b>.";
}

// ==========================================
// PARSER INPUT TRANSAKSI
// ==========================================
function parseInputTransaction_(text) {
  if (text.indexOf(":") !== -1) {
    var lines = text.split("\n");
    var res = {};
    lines.forEach(function(l) {
      var p = l.split(":");
      if (p.length >= 2) {
        var k = p[0].trim().toLowerCase();
        var v = p.slice(1).join(":").trim();

        if (k.indexOf("jenis") !== -1 || k.indexOf("tipe") !== -1) res.Jenis = normalizeJenis_(v);
        if (k.indexOf("dompet") !== -1 || k.indexOf("rekening") !== -1 || k.indexOf("akun") !== -1) res.Dompet = v;
        if (k.indexOf("uang") !== -1 || k.indexOf("nominal") !== -1 || k.indexOf("total") !== -1 || k.indexOf("jumlah") !== -1) res.Uang = v.replace(/[^0-9]/g, '');
        if (k.indexOf("kategori") !== -1 || k.indexOf("kat") !== -1) res.Kategori = v;
        if (k.indexOf("detail") !== -1 || k.indexOf("keterangan") !== -1 || k.indexOf("ket") !== -1) res.Detail = v;
        if (k.indexOf("tanggal") !== -1 || k.indexOf("tgl") !== -1) res.Tanggal = v;
      }
    });
    return (res.Jenis && res.Uang && res.Dompet) ? res : null;
  }

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

// ==========================================
// HAPUS TRANSAKSI BERDASARKAN ID
// Format: /hapus [ID_TRANSAKSI]
// ==========================================
function handleHapusTransaksi_(msgText, caller) {
  var parts = msgText.split(" ").filter(Boolean);
  if (parts.length < 2) {
    return "⚠️ Format salah.\nContoh: <code>/hapus 1MSBL081126</code>";
  }

  var targetId = parts[1].trim();
  var ss = (typeof getSpreadsheet_ === "function") ? getSpreadsheet_() : SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Transaksi");
  if (!sheet) return "❌ Sheet Transaksi tidak ditemukan.";

  var data = sheet.getDataRange().getValues();
  var callerRole = (caller.Role || "user").toLowerCase();
  var isPrivileged = (callerRole === "admin" || callerRole === "superadmin");

  for (var i = 1; i < data.length; i++) {
    var rowId = String(data[i][0] || "").trim(); // Kolom A: ID Transaksi
    var rowChatId = String(data[i][7] || "").trim(); // Kolom H: Chat ID Pemilik

    if (rowId.toLowerCase() === targetId.toLowerCase()) {
      // Validasi kepemilikan
      if (!isPrivileged && rowChatId !== String(caller.ChatID)) {
        return "❌ Akses ditolak. Kamu hanya bisa menghapus transaksimu sendiri.";
      }

      var rowInfo = "• Jenis: " + data[i][2] + "\n• Nominal: Rp " + Number(data[i][4]).toLocaleString('id-ID') + "\n• Dompet: " + data[i][3];
      sheet.deleteRow(i + 1);

      return "🗑️ <b>Transaksi Berhasil Dihapus!</b>\n" +
             "🆔 ID: <code>" + targetId + "</code>\n" + rowInfo;
    }
  }

  return "⚠️ Transaksi dengan ID <code>" + targetId + "</code> tidak ditemukan.";
}

// ==========================================
// EDIT TRANSAKSI BERDASARKAN ID
// Format Cepat: /edit [ID] [Jenis] [Nominal] [Dompet] [Kategori] [Detail]
// Contoh: /edit 1MSBL081126 Keluar 50000 Cash Makan Bakso
// ==========================================
function handleEditTransaksi_(msgText, caller) {
  var lines = msgText.trim();
  var parts = lines.split(" ").filter(Boolean);

  if (parts.length < 5) {
    return "⚠️ <b>Format Edit Transaksi:</b>\n" +
           "<code>/edit [ID] [Jenis] [Nominal] [Dompet] [Kategori] [Detail]</code>\n\n" +
           "<b>Contoh:</b>\n" +
           "<code>/edit 1MSBL081126 Keluar 25000 Cash Makan Nasi Padang</code>";
  }

  var targetId = parts[1].trim();
  var jenisBaru = normalizeJenis_(parts[2]);
  var nominalBaru = Number(parts[3].replace(/[^0-9]/g, ''));
  var dompetBaru = parts[4].trim();
  var kategoriBaru = parts[5] || "Umum";
  var detailBaru = parts.slice(6).join(" ") || "-";

  if (!jenisBaru || !nominalBaru || !dompetBaru) {
    return "⚠️ Data input tidak lengkap. Pastikan jenis, nominal, dan dompet valid.";
  }

  var ss = (typeof getSpreadsheet_ === "function") ? getSpreadsheet_() : SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Transaksi");
  if (!sheet) return "❌ Sheet Transaksi tidak ditemukan.";

  var data = sheet.getDataRange().getValues();
  var callerRole = (caller.Role || "user").toLowerCase();
  var isPrivileged = (callerRole === "admin" || callerRole === "superadmin");

  for (var i = 1; i < data.length; i++) {
    var rowId = String(data[i][0] || "").trim();
    var rowChatId = String(data[i][7] || "").trim();

    if (rowId.toLowerCase() === targetId.toLowerCase()) {
      if (!isPrivileged && rowChatId !== String(caller.ChatID)) {
        return "❌ Akses ditolak. Kamu hanya bisa mengedit transaksimu sendiri.";
      }

      // Kolom spreadsheet: C: Jenis (3), D: Dompet (4), E: Nominal (5), F: Kategori (6), G: Detail (7)
      sheet.getRange(i + 1, 3).setValue(jenisBaru);
      sheet.getRange(i + 1, 4).setValue(normalizeDompet_(dompetBaru));
      sheet.getRange(i + 1, 5).setValue(nominalBaru);
      sheet.getRange(i + 1, 6).setValue(kategoriBaru);
      sheet.getRange(i + 1, 7).setValue(detailBaru);

      return "✏️ <b>Transaksi Berhasil Diperbarui!</b>\n\n" +
             "🆔 ID: <code>" + targetId + "</code>\n" +
             "• <b>Jenis:</b> " + jenisBaru + "\n" +
             "• <b>Nominal:</b> Rp " + nominalBaru.toLocaleString('id-ID') + "\n" +
             "• <b>Dompet:</b> " + normalizeDompet_(dompetBaru) + "\n" +
             "• <b>Kategori:</b> " + kategoriBaru + "\n" +
             "• <b>Detail:</b> " + detailBaru;
    }
  }

  return "⚠️ Transaksi dengan ID <code>" + targetId + "</code> tidak ditemukan.";
}