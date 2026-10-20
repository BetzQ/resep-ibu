/* =========================================================
   BUKU RESEP IBU-IBU — app.js
   Tugas:
   1. Menampilkan daftar resep + pencarian sederhana.
   2. Menampilkan detail resep (foto besar, bumbu, alat, langkah).
   3. Mode Pasar: checklist belanja yang tersimpan di localStorage
      sehingga tidak hilang saat browser ditutup atau di-refresh.
   ========================================================= */

"use strict";

const KUNCI_LOKAL = "pasar_v1_"; // awalan nama penyimpanan di browser

const aplikasi = {
  semuaResep: [],
  kategoriAktif: "semua",
  kataCari: "",
  modePasar: false,
  resepAktif: null
};

/* ---------------------------------------------------------
   1. MULAI APLIKASI
   --------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", mulai);

async function mulai() {
  pasangTombolUtama();
  try {
    const jawaban = await fetch("data.json");
    if (!jawaban.ok) throw new Error("Gagal memuat data");
    const data = await jawaban.json();
    aplikasi.semuaResep = data.resep;
    gambarDaftarResep();
    muatDariAlamat(); // kalau dibuka langsung lewat tautan resep
  } catch (error) {
    document.getElementById("daftar-resep").innerHTML =
      '<div class="kotak-pesan">' +
      "<p class='text-2xl'>⚠️ Data resep belum bisa dimuat.</p>" +
      "<p class='teks-kecil-abu mt-2'>Jika membuka lewat komputer, jalankan lewat internet " +
      "(GitHub Pages) atau buka lewat program pelayan web kecil.</p>" +
      "</div>";
    console.error(error);
  }
}

function pasangTombolUtama() {
  // Pencarian
  const kotakCari = document.getElementById("cari");
  kotakCari.addEventListener("input", function () {
    aplikasi.kataCari = kotakCari.value.toLowerCase().trim();
    gambarDaftarResep();
  });

  // Tombol kategori
  document.querySelectorAll("#filter-kategori .tombol-filter").forEach(function (tombol) {
    tombol.addEventListener("click", function () {
      document.querySelectorAll("#filter-kategori .tombol-filter").forEach(function (t) {
        t.classList.remove("aktif");
      });
      tombol.classList.add("aktif");
      aplikasi.kategoriAktif = tombol.dataset.kategori;
      gambarDaftarResep();
    });
  });

  // Tombol kembali (atas dan bawah)
  document.getElementById("tombol-kembali-atas").addEventListener("click", keDaftarResep);
  document.getElementById("tombol-kembali-bawah").addEventListener("click", keDaftarResep);

  // Perubahan alamat (tombol "kembali" browser)
  window.addEventListener("hashchange", muatDariAlamat);
}

/* ---------------------------------------------------------
   2. HALAMAN DAFTAR RESEP
   --------------------------------------------------------- */
function resepTersaring() {
  const cari = aplikasi.kataCari;
  return aplikasi.semuaResep.filter(function (resep) {
    const cocokKategori =
      aplikasi.kategoriAktif === "semua" || resep.kategori === aplikasi.kategoriAktif;
    const cocokCari =
      cari === "" ||
      resep.nama.toLowerCase().includes(cari) ||
      resep.daerah.toLowerCase().includes(cari) ||
      resep.deskripsi.toLowerCase().includes(cari);
    return cocokKategori && cocokCari;
  });
}

function gambarDaftarResep() {
  const wadah = document.getElementById("daftar-resep");
  const daftar = resepTersaring();
  const hitung = document.getElementById("jumlah-resep");
  const kosong = document.getElementById("tidak-ketemu");

  hitung.textContent = daftar.length + " resep siap dibaca.";
  kosong.hidden = daftar.length !== 0;

  wadah.innerHTML = "";
  daftar.forEach(function (resep, nomor) {
    const tombol = document.createElement("button");
    tombol.className = "kartu-resep";
    tombol.type = "button";
    tombol.innerHTML =
      '<img class="kartu-gambar" src="' + amanTeks(resep.gambar) + '" alt="' + amanTeks(resep.nama) + '" ' +
        'loading="lazy" onerror="gagalGambar(this)" />' +
      '<div class="kartu-isi">' +
        '<h2 class="kartu-judul">' + resep.ikon + " " + amanTeks(resep.nama) + "</h2>" +
        '<p class="kartu-asal">📍 ' + amanTeks(resep.daerah) + "</p>" +
        '<span class="kartu-info">⏱️ ' + resep.waktu + " menit &nbsp;•&nbsp; 👨‍👩‍👧 " + amanTeks(resep.porsi) + "</span>" +
      "</div>";
    tombol.addEventListener("click", function () {
      window.location.hash = "#/resep/" + resep.id;
    });
    wadah.appendChild(tombol);
  });
}

function keDaftarResep() {
  window.location.hash = "#/";
}

function muatDariAlamat() {
  const alamat = window.location.hash || "#/";
  const cocok = alamat.match(/^#\/resep\/([\w-]+)/);
  if (cocok) {
    bukaResep(cocok[1]);
  } else {
    tampilkanDaftar();
  }
}

function tampilkanDaftar() {
  aplikasi.modePasar = false;
  aplikasi.resepAktif = null;
  document.getElementById("halaman-resep").hidden = true;
  document.getElementById("halaman-daftar").hidden = false;
  window.scrollTo(0, 0);
  document.title = "Buku Resep Ibu-Ibu — Resep Masakan Lengkap";
}

/* ---------------------------------------------------------
   3. HALAMAN DETAIL RESEP
   --------------------------------------------------------- */
function bukaResep(id) {
  const resep = aplikasi.semuaResep.find(function (r) { return r.id === id; });
  if (!resep) {
    keDaftarResep();
    return;
  }
  aplikasi.resepAktif = resep;
  aplikasi.modePasar = false;
  document.getElementById("halaman-daftar").hidden = true;
  document.getElementById("halaman-resep").hidden = false;
  gambarDetailResep(resep);
  window.scrollTo(0, 0);
  document.title = resep.nama + " — Buku Resep Ibu-Ibu";
}

function gambarDetailResep(resep) {
  document.getElementById("isi-resep").innerHTML =
    '<img class="foto-resep" src="' + amanTeks(resep.gambar) + '" alt="' + amanTeks(resep.nama) + '" onerror="gagalGambar(this)" />' +
    '<h2 class="judul-resep">' + resep.ikon + " " + amanTeks(resep.nama) + "</h2>" +
    '<p class="asal-resep">📍 ' + amanTeks(resep.daerah) + "</p>" +
    '<p class="deskripsi-resep">' + amanTeks(resep.deskripsi) + "</p>" +
    '<div class="baris-info">' +
      '<span class="kotak-info">⏱️ Waktu: ' + resep.waktu + " menit</span>" +
      '<span class="kotak-info">👨‍👩‍👧 Porsi: ' + amanTeks(resep.porsi) + "</span>" +
      '<span class="kotak-info">🎯 Tingkat: ' + amanTeks(resep.tingkat) + "</span>" +
    "</div>" +
    tombolMenujuPasar(resep) +
    bagianDaftar("🧅 BAHAN UTAMA", resep.bahanUtama, "judul-bagian", false) +
    bagianDaftar("🌶️ BUMBU-BUMBU", resep.bumbu, "judul-bagian judul-bagian-merah", false) +
    bagianDaftar("🍳 ALAT MASAK", resep.alat, "judul-bagian judul-bagian-biru", true) +
    bagianLangkah(resep) +
    bagianTips(resep);
}

function tombolMenujuPasar(resep) {
  return (
    '<button class="tombol-pasar" type="button" id="tombol-pasar">' +
    "🛒 BAWA KE PASAR (Daftar Belanja)" +
    "</button>"
  );
}

function bagianDaftar(judul, daftar, kelasJudul, hanyaNama) {
  let isi = '<h3 class="' + kelasJudul + '">' + judul + "</h3>";
  isi += '<ul class="daftar-item">';
  daftar.forEach(function (item) {
    isi +=
      '<li class="item-baris">' +
        '<span class="ikon-item" aria-hidden="true">' + item.ikon + "</span>" +
        '<span class="nama-item">' + amanTeks(item.nama) + "</span>" +
        (hanyaNama ? "" : '<span class="jumlah-item">' + amanTeks(item.jumlah) + "</span>") +
      "</li>";
  });
  isi += "</ul>";
  return isi;
}

function bagianLangkah(resep) {
  let isi = '<h3 class="judul-bagian">👩‍🍳 LANGKAH MEMASAK</h3>';
  isi += '<ol class="daftar-langkah">';
  resep.langkah.forEach(function (langkah, nomor) {
    isi +=
      '<li class="langkah-baris">' +
        '<span class="nomor-langkah">' + (nomor + 1) + "</span>" +
        '<span class="teks-langkah">' + amanTeks(langkah) + "</span>" +
      "</li>";
  });
  isi += "</ol>";
  return isi;
}

function bagianTips(resep) {
  if (!resep.tips || resep.tips.length === 0) return "";
  let isi = '<h3 class="judul-bagian">💡 TIPS IBU-IBU</h3>';
  isi += '<div class="kotak-tips"><ul>';
  resep.tips.forEach(function (tips) {
    isi += "<li>" + amanTeks(tips) + "</li>";
  });
  isi += "</ul></div>";
  return isi;
}

/* ---------------------------------------------------------
   4. MODE PASAR (CHECKLIST BELANJA)
   --------------------------------------------------------- */
document.addEventListener("click", function (peristiwa) {
  const tombol = peristiwa.target.closest("#tombol-pasar");
  if (tombol && aplikasi.resepAktif) {
    bukaModePasar(aplikasi.resepAktif);
  }
});

function semuaBarisBeli(resep) {
  const daftar = [];
  resep.bahanUtama.forEach(function (item, i) {
    daftar.push({ kunci: "bahan-" + i, nama: item.nama, jumlah: item.jumlah, ikon: item.ikon, jenis: "Bahan Utama" });
  });
  resep.bumbu.forEach(function (item, i) {
    daftar.push({ kunci: "bumbu-" + i, nama: item.nama, jumlah: item.jumlah, ikon: item.ikon, jenis: "Bumbu" });
  });
  return daftar;
}

function bacaCentangan(idResep) {
  try {
    return JSON.parse(localStorage.getItem(KUNCI_LOKAL + idResep)) || {};
  } catch (e) {
    return {};
  }
}

function simpanCentangan(idResep, data) {
  try {
    localStorage.setItem(KUNCI_LOKAL + idResep, JSON.stringify(data));
  } catch (e) {
    console.error("Penyimpanan browser penuh atau diblokir.", e);
  }
}

function bukaModePasar(resep) {
  aplikasi.modePasar = true;
  const wadah = document.getElementById("isi-resep");
  const baris = semuaBarisBeli(resep);
  const centang = bacaCentangan(resep.id);

  let isi =
    '<button class="tombol-kembali" type="button" id="tombol-kembali-resep">⬅️ KEMBALI KE RESEP</button>' +
    '<h2 class="judul-pasar">🛒 DAFTAR BELANJA PASAR</h2>' +
    '<p class="deskripsi-resep">Centang satu per satu barang yang sudah ibu beli. ' +
      "Centangan tersimpan otomatis di HP/komputer, jadi aman meskipun halaman ditutup.</p>" +
    '<p class="kotak-progres" id="teks-progres"></p>' +
    '<ul class="daftar-belanja">';

  baris.forEach(function (item) {
    const sudah = centang[item.kunci] === true;
    isi +=
      '<li class="baris-belanja' + (sudah ? " sudah-dibeli" : "") + '" data-kunci="' + item.kunci + '">' +
        '<input class="kotak-centang" type="checkbox" id="centang-' + item.kunci + '"' + (sudah ? " checked" : "") + " />" +
        '<span class="ikon-item" aria-hidden="true">' + item.ikon + "</span>" +
        '<label class="nama-belanja" for="centang-' + item.kunci + '">' +
          amanTeks(item.nama) + " <small>(" + amanTeks(item.jumlah) + ")</small>" +
        "</label>" +
        '<span class="jenis-bahan">' + item.jenis + "</span>" +
      "</li>";
  });

  isi += "</ul>";
  isi += '<button class="tombol-netral" type="button" id="tombol-centang-semua">✅ CENTANG SEMUA</button>';
  isi += '<button class="tombol-merah" type="button" id="tombol-kosongkan">❌ KOSONGKAN CENTANGAN</button>';
  isi += '<button class="tombol-kembali" type="button" id="tombol-kembali-resep-2">⬅️ KEMBALI KE RESEP</button>';

  wadah.innerHTML = isi;

  wadah.querySelectorAll(".baris-belanja").forEach(function (barisEl) {
    barisEl.addEventListener("click", function (peristiwa) {
      // biarkan label/klik apa pun di baris tetap memutar centang dengan normal
      setTimeout(function () {
        perbaruiStatusBaris(resep.id, barisEl);
      }, 0);
    });
    const kotak = barisEl.querySelector(".kotak-centang");
    kotak.addEventListener("change", function () {
      perbaruiStatusBaris(resep.id, barisEl);
    });
  });

  wadah.querySelector("#tombol-centang-semua").addEventListener("click", function () {
    const semua = {};
    baris.forEach(function (item) { semua[item.kunci] = true; });
    simpanCentangan(resep.id, semua);
    bukaModePasar(resep);
  });

  wadah.querySelector("#tombol-kosongkan").addEventListener("click", function () {
    if (confirm("Yakin ingin mengosongkan semua centangan belanja?")) {
      simpanCentangan(resep.id, {});
      bukaModePasar(resep);
    }
  });

  [ "#tombol-kembali-resep", "#tombol-kembali-resep-2" ].forEach(function (idTombol) {
    wadah.querySelector(idTombol).addEventListener("click", function () {
      aplikasi.modePasar = false;
      gambarDetailResep(resep);
    });
  });

  perbaruiProgres();
  window.scrollTo(0, 0);
}

function perbaruiStatusBaris(idResep, barisEl) {
  const kotak = barisEl.querySelector(".kotak-centang");
  const centang = bacaCentangan(idResep);
  centang[barisEl.dataset.kunci] = kotak.checked;
  simpanCentangan(idResep, centang);
  barisEl.classList.toggle("sudah-dibeli", kotak.checked);
  perbaruiProgres();
}

function perbaruiProgres() {
  const resep = aplikasi.resepAktif;
  if (!resep) return;
  const kotak = document.querySelectorAll("#isi-resep .kotak-centang");
  if (kotak.length === 0) return;
  const sudah = document.querySelectorAll("#isi-resep .kotak-centang:checked").length;
  const total = kotak.length;
  const teks = document.getElementById("teks-progres");
  if (!teks) return;
  teks.textContent = sudah + " dari " + total + " barang sudah dibeli";
}

/* ---------------------------------------------------------
   5. BANTUAN KECIL
   --------------------------------------------------------- */
// Menjaga agar teks dari data tidak membuka kode berbahaya.
function amanTeks(teks) {
  return String(teks)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Jika foto gagal dimuat, tampilkan kotak nama makanan agar tetap jelas.
function gagalGambar(img) {
  const nama = img.getAttribute("alt") || "Makanan";
  const kotak = document.createElement("div");
  kotak.style.cssText =
    "background:#f5efe1;border:4px solid #d9d2c2;display:flex;align-items:center;" +
    "justify-content:center;text-align:center;font-size:24px;font-weight:800;padding:24px;";
  kotak.style.height = img.classList.contains("foto-resep") ? "320px" : img.style.height || "220px";
  kotak.textContent = "🍽️ " + nama;
  img.replaceWith(kotak);
}
