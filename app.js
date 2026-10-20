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
const KUNCI_FAVORIT = "favorit_v1_daftar"; // daftar resep tersimpan (bookmark) di browser
const KUNCI_FYP = "fyp_v1_skor"; // skor selera ibu per daerah/negara (algoritma rekomendasi)

const JUMLAH_KARTU_AWAL = 24; // kartu dirender bertahap supaya HP lansia tetap lancar
const JUMLAH_TAMBAHAN = 24;

const LAMA_LIHAT_SHORTS = 3000; // 3 detik menonton = dihitung 1 poin selera
const BAGIAN_PRIORITAS = 7; // 7 dari 10 video = sesuai selera (70%)
const BAGIAN_PENYEGAR = 3; // 3 dari 10 video = daerah/negara acak (30% penyegaran)

// Resep yang ditandai ibu sebagai favorit (hanya id resep makanan —
// bahan/bumbu/checklist pasar TIDAK ikut disimpan di sini).
let daftarFavorit = new Set();

// Skor selera ibu: { "Padang": 5, "Jepang": 2, ... } — dipakai Mode Shorts
// untuk mengurutkan video yang paling mungkin disukai.
let skorFyp = {};

const aplikasi = {
  semuaResep: [],
  kategoriAktif: "semua",
  kataCari: "",
  modePasar: false,
  resepAktif: null,
  batasTampil: JUMLAH_KARTU_AWAL
};

// Titik berhenti menggulir daftar resep — disimpan agar saat kembali
// dari halaman resep, ibu tidak perlu menggulir dari awal lagi.
let posisiDaftar = 0;

// Keadaan Mode Shorts (video otomatis)
let shortsTerbuka = false; // sedang di Mode Shorts?
let posisiShorts = 0; // posisi gulir daftar sebelum masuk Mode Shorts
let antreanShorts = []; // urutan resep yang tampil sebagai video
let suaraShortsNyala = false; // video mulai dalam keadaan bisu
let pengamatShorts = null; // pemantau video mana yang sedang tampil
let itemAktifShorts = null; // video yang sedang dilihat
let jedaLihatShorts = null; // penghitung 3 detik
let sudahDihitungShorts = new Set(); // biar satu video tidak dihitung dua kali
let jedaCariShorts = null;

// Keadaan video cara memasak di halaman detail resep
let videoResepAktif = null; // video yang sedang tampil di halaman detail biasa
let videoModalAktif = null; // video yang sedang tampil di dalam modal Mode Shorts

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
    muatFavorit(); // resep tersimpan (bookmark) dari localStorage
    muatSkorFyp(); // skor selera ibu (algoritma rekomendasi Mode Shorts)
    perbaruiHitungFavorit();
    gambarDaftarResep();
    muatDariAlamat(); // kalau dibuka langsung lewat tautan resep
    fetchViralRecipes(); // section "Lagi Rame" di paling atas
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
  // Pencarian (dijeda 250ms supaya mengetik cepat tidak bikin HP ngelag)
  const kotakCari = document.getElementById("cari");
  let jedaCari = null;
  kotakCari.addEventListener("input", function () {
    clearTimeout(jedaCari);
    jedaCari = setTimeout(function () {
      aplikasi.kataCari = kotakCari.value.toLowerCase().trim();
      aplikasi.batasTampil = JUMLAH_KARTU_AWAL;
      gambarDaftarResep();
    }, 250);
  });

  // Tombol kategori
  document.querySelectorAll("#filter-kategori .tombol-filter").forEach(function (tombol) {
    tombol.addEventListener("click", function () {
      document.querySelectorAll("#filter-kategori .tombol-filter").forEach(function (t) {
        t.classList.remove("aktif");
      });
      tombol.classList.add("aktif");
      aplikasi.kategoriAktif = tombol.dataset.kategori;
      aplikasi.batasTampil = JUMLAH_KARTU_AWAL;
      gambarDaftarResep();
    });
  });

  // Tombol kembali (atas dan bawah)
  document.getElementById("tombol-kembali-atas").addEventListener("click", keDaftarResep);
  document.getElementById("tombol-kembali-bawah").addEventListener("click", keDaftarResep);

  // Tombol "tampilkan lebih banyak" (render bertahap supaya tidak lag)
  document.getElementById("tombol-muat-lebih").addEventListener("click", function () {
    aplikasi.batasTampil += JUMLAH_TAMBAHAN;
    gambarDaftarResep(true); // cukup menyambung kartu baru — tidak render ulang
  });

  // Tombol "ke atas" mengambang — muncul setelah menggulir jauh di daftar resep
  const tombolKeAtas = document.getElementById("tombol-ke-atas");
  if (tombolKeAtas) {
    window.addEventListener("scroll", function () {
      const masihDiDaftar = aplikasi.resepAktif === null && !aplikasi.modePasar;
      tombolKeAtas.hidden = !(masihDiDaftar && window.scrollY > 800);
    }, { passive: true });
    tombolKeAtas.addEventListener("click", function () {
      const kurangGerak = window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: 0, behavior: kurangGerak ? "auto" : "smooth" });
    });
  }

  pasangTombolShorts(); // pintu masuk + kendali Mode Shorts

  // Biar browser tidak menggeser posisi gulir sendiri saat tombol
  // kembali/forward ditekan — posisi daftar dikembalikan secara manual.
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";

  // Perubahan alamat (tombol "kembali" browser)
  window.addEventListener("hashchange", muatDariAlamat);
}

/* ---------------------------------------------------------
   2. HALAMAN DAFTAR RESEP
   --------------------------------------------------------- */
function resepTersaring() {
  const cari = aplikasi.kataCari;
  const kategori = aplikasi.kategoriAktif;
  return aplikasi.semuaResep.filter(function (resep) {
    // kategori "tersimpan" = hanya resep yang ditandai favorit ibu
    const cocokKategori =
      kategori === "semua" ||
      (kategori === "tersimpan"
        ? daftarFavorit.has(resep.id)
        : resep.kategori === kategori);
    if (!cocokKategori) return false;
    if (cari === "") return true;
    if (resep.nama.toLowerCase().includes(cari)) return true;
    if (resep.daerah.toLowerCase().includes(cari)) return true;
    if (resep.deskripsi.toLowerCase().includes(cari)) return true;
    // ikut mencari di nama bahan & bumbu supaya mudah menemukan lauk dari isi kulkas
    const bahan = resep.bahan || resep.bahanUtama || [];
    const bumbu = resep.bumbu || [];
    return bahan.concat(bumbu).some(function (item) {
      return item.nama.toLowerCase().includes(cari);
    });
  });
}

function gambarDaftarResep(tambahSaja) {
  const wadah = document.getElementById("daftar-resep");
  const tombolMuat = document.getElementById("tombol-muat-lebih");
  const daftar = resepTersaring();
  const hitung = document.getElementById("jumlah-resep");
  const kosong = document.getElementById("tidak-ketemu");

  const tampil = Math.min(aplikasi.batasTampil, daftar.length);
  const sisa = daftar.length - tampil;

  hitung.textContent =
    daftar.length + " resep siap dibaca." +
    (sisa > 0 ? " Menampilkan " + tampil + " dulu, sisanya menyusul." : "");
  kosong.hidden = daftar.length !== 0;
  if (daftar.length === 0) {
    // pesan kotak kosong menyesuaikan: belum menyimpan resep vs kata kunci tak ketemu
    kosong.innerHTML =
      aplikasi.kategoriAktif === "tersimpan" && aplikasi.kataCari === ""
        ? "<p class='text-2xl'>⭐ Belum ada resep yang tersimpan.</p>" +
          "<p class='teks-kecil-abu mt-2'>Cara menyimpan: buka resep lalu tekan tombol " +
          "\"⭐ SIMPAN RESEP INI\", atau tekan tombol \"☆ SIMPAN\" di pojok kanan atas kartu resep.</p>"
        : "<p class='text-2xl'>😕 Resep tidak ditemukan.</p>" +
          "<p class='teks-kecil-abu mt-2'>Coba kata kunci lain, misalnya “ayam”, “ikan”, atau “soto”.</p>";
  }
  tombolMuat.hidden = sisa <= 0;
  tombolMuat.textContent = "📜 TAMPILKAN LEBIH BANYAK (sisa " + sisa + " resep)";

  // Saat tombol "tampilkan lebih banyak" ditekan, kartu lama dibiarkan
  // dan hanya kartu baru ditambahkan — layar HP tidak kedip/kelambatan.
  const tanda = aplikasi.kategoriAktif + "|" + aplikasi.kataCari;
  const menyambung =
    tambahSaja === true &&
    wadah.dataset.tanda === tanda &&
    wadah.children.length > 0 &&
    wadah.children.length < tampil;

  if (!menyambung) wadah.innerHTML = "";
  const mulaiDari = menyambung ? wadah.children.length : 0;
  const frag = document.createDocumentFragment();
  for (let nomor = mulaiDari; nomor < tampil; nomor++) {
    frag.appendChild(buatKartuResep(daftar[nomor]));
  }
  wadah.appendChild(frag);
  wadah.dataset.tanda = tanda;
}

function buatKartuResep(resep) {
  // Kartu dibungkus div supaya tombol simpan (☆) bisa duduk di pojok kartu
  // tanpa bersarang di dalam tombol kartu (HTML tidak boleh bertumpuk).
  const bungkus = document.createElement("div");
  bungkus.className = "kartu-bungkus";

  const tombol = document.createElement("button");
  tombol.className = "kartu-resep";
  tombol.type = "button";
  tombol.innerHTML =
    '<img class="kartu-gambar" src="' + amanTeks(resep.gambar_masakan || resep.gambar) + '" alt="' + amanTeks(resep.nama) + '" ' +
      'loading="lazy" decoding="async" onerror="gagalGambar(this)" />' +
    '<div class="kartu-isi">' +
      '<h2 class="kartu-judul">' + resep.ikon + " " + amanTeks(resep.nama) + "</h2>" +
      '<p class="kartu-asal">📍 ' + amanTeks(resep.daerah) + "</p>" +
      '<span class="kartu-info">⏱️ ' + resep.waktu + " menit &nbsp;•&nbsp; 👨‍👩‍👧 " + amanTeks(resep.porsi) + "</span>" +
    "</div>";
  tombol.addEventListener("click", function () {
    window.location.hash = "#/resep/" + resep.id;
  });

  // Tombol simpan favorit (hanya menandai id resep makanan ini saja)
  const tombolSimpan = document.createElement("button");
  tombolSimpan.className = "tombol-favorit";
  tombolSimpan.type = "button";
  tombolSimpan.dataset.favorit = resep.id;
  tombolSimpan.setAttribute(
    "aria-label",
    "Simpan resep " + resep.nama + " ke daftar tersimpan"
  );
  pasangTombolFavorit(tombolSimpan, resep);

  bungkus.appendChild(tombol);
  bungkus.appendChild(tombolSimpan);
  return bungkus;
}

function keDaftarResep() {
  window.location.hash = "#/";
}

function muatDariAlamat() {
  const alamat = window.location.hash || "#/";
  if (alamat === "#/shorts") {
    bukaModeShorts();
    return;
  }
  const cocok = alamat.match(/^#\/resep\/([\w-]+)/);
  if (cocok) {
    bukaResep(cocok[1]);
  } else {
    tampilkanDaftar();
  }
}

function tampilkanDaftar() {
  // Kalau datang dari halaman resep/pasar, kembalikan posisi gulir lama.
  // Kalau baru dibuka (awal muat halaman), mulai dari paling atas.
  const dariHalamanResep = aplikasi.resepAktif !== null || aplikasi.modePasar;
  const dariShorts = shortsTerbuka;
  aplikasi.modePasar = false;
  aplikasi.resepAktif = null;
  if (dariShorts) matikanShorts(); // hentikan video + lepas pemantau dsb.
  hentikanVideoResep(); // video cara memasak di halaman detail juga dihentikan
  document.getElementById("halaman-resep").hidden = true;
  document.getElementById("halaman-daftar").hidden = false;
  window.scrollTo(0, dariShorts ? posisiShorts : (dariHalamanResep ? posisiDaftar : 0));
  document.title = "Buku Resep Ibu-Ibu — Resep Masakan Lengkap";
}

// Menghentikan video cara memasak di halaman detail biasa (hemat kuota).
function hentikanVideoResep() {
  const video = videoResepAktif || document.getElementById("video-resep");
  if (video) {
    if (video.pause) video.pause();
    if (video.setAttribute && video.getAttribute && video.getAttribute("src")) {
      video.removeAttribute("src");
      if (video.load) video.load();
    }
  }
  videoResepAktif = null;
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
  if (!aplikasi.resepAktif) posisiDaftar = window.scrollY; // ingat posisi di daftar
  catatSkorFyp(resep); // membuka detail = minat ibu naik (+1 poin selera)
  aplikasi.resepAktif = resep;
  aplikasi.modePasar = false;
  document.getElementById("halaman-daftar").hidden = true;
  document.getElementById("halaman-resep").hidden = false;
  gambarDetailResep(resep);
  window.scrollTo(0, 0);
  document.title = resep.nama + " — Buku Resep Ibu-Ibu";
}

function gambarDetailResep(resep, wadah, untukModal) {
  // wadah bisa diisi supaya resep yang sama bisa muncul di halaman detail
  // maupun di dalam modal Mode Shorts.
  wadah = wadah || document.getElementById("isi-resep");
  wadah.innerHTML =
    '<img class="foto-resep" src="' + amanTeks(resep.gambar_masakan || resep.gambar) + '" alt="' + amanTeks(resep.nama) + '" decoding="async" onerror="gagalGambar(this)" />' +
    '<h2 class="judul-resep">' + resep.ikon + " " + amanTeks(resep.nama) + "</h2>" +
    '<p class="asal-resep">📍 ' + amanTeks(resep.daerah) + "</p>" +
    '<p class="deskripsi-resep">' + amanTeks(resep.deskripsi) + "</p>" +
    '<div class="baris-info">' +
      '<span class="kotak-info">⏱️ Waktu: ' + resep.waktu + " menit</span>" +
      '<span class="kotak-info">👨‍👩‍👧 Porsi: ' + amanTeks(resep.porsi) + "</span>" +
      '<span class="kotak-info">🎯 Tingkat: ' + amanTeks(resep.tingkat) + "</span>" +
    "</div>" +
    tombolSimpanResep(resep, untukModal === true) +
    tombolMenujuPasar(resep, untukModal === true) +
    bagianVideoResep(resep, untukModal === true) +
    bagianDaftar("🧅 BAHAN UTAMA", resep.bahan || resep.bahanUtama || [], "judul-bagian", false) +
    bagianDaftar("🌶️ BUMBU-BUMBU", resep.bumbu || [], "judul-bagian judul-bagian-merah", false) +
    bagianDaftar("🍳 ALAT MASAK", resep.alat_masak || resep.alat || [], "judul-bagian judul-bagian-biru", true) +
    bagianLangkah(resep) +
    bagianTips(resep);

  // Pasang pemutar video cara memasak (halaman detail biasa / modal Shorts).
  pasangVideoResep(resep, wadah, untukModal === true);

  // pasang aksi tombol simpan (status tersimpan/tidak sesuai localStorage)
  const idSimpan = untukModal === true ? "#tombol-simpan-resep-modal" : "#tombol-simpan-resep";
  let tombolSimpan = wadah.querySelector ? wadah.querySelector(idSimpan) : null;
  if (!tombolSimpan) tombolSimpan = document.getElementById(idSimpan.slice(1));
  if (tombolSimpan) pasangTombolFavorit(tombolSimpan, resep);

  // tombol "Bawa ke Pasar" khusus modal (di halaman biasa dipasang lewat
  // pendengar dokumen supaya tetap bisa dipakai di mana saja)
  if (untukModal === true) {
    const tombolPasar = wadah.querySelector ? wadah.querySelector("#tombol-pasar-modal") : null;
    if (tombolPasar) {
      tombolPasar.addEventListener("click", function () {
        bukaModePasar(resep, wadah, true);
      });
    }
  }
}

// Tombol simpan resep (favorit) di halaman detail — hanya id resep makanan
// yang disimpan, bumbu dan checklist pasar tidak ikut.
function tombolSimpanResep(resep, untukModal) {
  return (
    '<button class="tombol-simpan" type="button" id="' +
    (untukModal === true ? "tombol-simpan-resep-modal" : "tombol-simpan-resep") +
    '" data-favorit="' + amanTeks(resep.id) + '" aria-pressed="false">' +
    "⭐ SIMPAN RESEP INI" +
    "</button>"
  );
}

function tombolMenujuPasar(resep, untukModal) {
  // Id berbeda untuk modal supaya tidak bentrok dengan pendengar di halaman biasa.
  return (
    '<button class="tombol-pasar" type="button" id="' +
    (untukModal === true ? "tombol-pasar-modal" : "tombol-pasar") + '">' +
    "🛒 BAWA KE PASAR (Daftar Belanja)" +
    "</button>"
  );
}

/* ---------------------------------------------------------
   VIDEO CARA MEMASAK DI HALAMAN RESEP
   Setiap ibu membuka resep, video cara memasak langsung
   tampil. Video diambil dari YouTube (paling nyambung),
   dan kalau belum ada, dipakai video cadangan agar pemutar
   tidak pernah kosong.
   --------------------------------------------------------- */

// Mengubah tautan apa pun menjadi ID YouTube (11 karakter), atau "" kalau bukan YouTube.
function ambilIdYoutube(tautan) {
  const t = String(tautan || "").trim();
  if (!t) return "";
  // Sudah berupa ID saja
  if (/^[\w-]{11}$/.test(t)) return t;
  const cocok = t.match(/(?:youtu\.be\/|v=|embed\/|shorts\/|\/v\/)([\w-]{11})/);
  if (cocok) return cocok[1];
  return "";
}

// Daftar video resep: YouTube lebih diutamakan, video langsung jadi cadangan.
function daftarVideoResep(resep) {
  const daftar = [];
  (resep.video_youtube || []).forEach(function (id) {
    if (id) daftar.push({ jenis: "youtube", id: String(id) });
  });
  (resep.video_tutorial || []).forEach(function (u) {
    if (u) daftar.push({ jenis: "langsung", url: String(u) });
  });
  return daftar;
}

function bagianVideoResep(resep, untukModal) {
  const daftar = daftarVideoResep(resep);
  const nomor = untukModal === true ? 1 : 0; // halaman detail & modal mulai dari video berbeda
  if (daftar.length === 0) return "";
  const nomorAman = nomor % daftar.length;

  // Tombol besar untuk setiap pilihan video.
  let tombolPilih = "";
  if (daftar.length > 1) {
    let isiTombol = "";
    daftar.forEach(function (_, i) {
      isiTombol +=
        '<button class="tombol-video-pilih' + (i === nomorAman ? " aktif" : "") +
        '" type="button" data-video-nomor="' + i + '">▶️ VIDEO ' + (i + 1) + "</button>";
    });
    tombolPilih =
      '<div class="video-resep-pilih">' + isiTombol + "</div>" +
      '<p class="video-resep-catatan">Tekan tombol di atas untuk berganti video. ' +
        "Kalau satu video tersendat, tekan tombol video lain ya, Bu.</p>";
  }

  // Kalau ada video YouTube, pemutarnya disiapkan sebagai iframe.
  const adaIframe = daftar[nomorAman] && daftar[nomorAman].jenis === "youtube";

  return (
    '<h3 class="judul-bagian video-resep-judul">🎬 VIDEO CARA MEMASAK (' +
      daftar.length + " video)</h3>" +
    (adaIframe
      ? '<div class="video-resep-bingkai"><iframe class="video-resep-iframe" ' +
          'src="https://www.youtube.com/embed/' + amanTeks(daftar[nomorAman].id) + '?rel=0&modestbranding=1" ' +
          'title="Video cara memasak ' + amanTeks(resep.nama) + '" loading="lazy" ' +
          'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" ' +
          'allowfullscreen></iframe></div>'
      : "") +
    '<video class="video-resep" controls playsinline webkit-playsinline ' +
      'preload="metadata" poster="' + amanTeks(resep.gambar_masakan || resep.gambar) + '" ' +
      'aria-label="Video cara memasak ' + amanTeks(resep.nama) + '"></video>' +
    '<p class="video-resep-pesan" hidden></p>' +
    tombolPilih
  );
}


function pasangVideoResep(resep, wadah, untukModal) {
  const daftar = daftarVideoResep(resep);
  const nomorAwal = untukModal === true ? 1 : 0;
  const pesanGagal = "⚠️ Video belum bisa diputar (internet lambat atau video sedang sibuk). " +
    "Coba tekan tombol VIDEO lain, atau baca bahan dan cara memasak di bawah ya, Bu.";

  // Elemen di dalam wadah (halaman resep / modal), plus elemen cadangan.
  const diWadahIframe = wadah && wadah.querySelector ? wadah.querySelector("iframe.video-resep-iframe") : null;
  const diWadahVideo = wadah && wadah.querySelector ? wadah.querySelector("video.video-resep") : null;
  const cadanganVideo = document.getElementById("video-resep");
  const pesanCadangan = document.getElementById("video-resep-pesan");

  const tampilkanPesan = function (pesan, teks) {
    if (pesan) { pesan.hidden = false; pesan.textContent = teks; }
  };
  const sembunyikanPesan = function (pesan) {
    if (pesan) { pesan.hidden = true; pesan.textContent = ""; }
  };

  // Tentukan wadah pesan: dari induk elemen video, atau elemen cadangan.
  const pesanEl = function (el) {
    if (el && el.parentNode && el.parentNode.querySelector) {
      const p = el.parentNode.querySelector(".video-resep-pesan");
      if (p) return p;
    }
    return pesanCadangan;
  };

  // ----- Fungsi memasang satu pilihan video (YouTube atau berkas langsung) -----
  const pasangPilihan = function (nomor) {
    const pilihan = daftar[nomor % daftar.length];
    if (!pilihan) return;

    // Elemen yang dipakai: iframe untuk YouTube, <video> untuk berkas langsung.
    const pakaiIframe = pilihan.jenis === "youtube";
    const iframe = diWadahIframe;
    const video = diWadahVideo || cadanganVideo;
    const pesan = pesanEl(pakaiIframe ? iframe : video) || pesanEl(cadanganVideo) || pesanCadangan;

    // Sembunyikan pemutar YouTube saat memakai berkas langsung, dan sebaliknya.
    if (iframe) iframe.hidden = !pakaiIframe;
    if (pakaiIframe && iframe) {
      const srcBaru = "https://www.youtube.com/embed/" + amanTeks(pilihan.id) + "?rel=0&modestbranding=1";
      if (iframe.getAttribute("src") !== srcBaru) iframe.setAttribute("src", srcBaru);
    }

    if (video) {
      if (video.pause) video.pause();
      if (pakaiIframe) {
        // Tidak perlu memuat berkas apa pun saat memakai YouTube.
        if (video.removeAttribute && video.getAttribute && video.getAttribute("src")) {
          video.removeAttribute("src");
          if (video.load) video.load();
        }
        video.hidden = true;
      } else {
        if (video.setAttribute) video.setAttribute("src", amanTeks(pilihan.url));
        if (video.load) video.load();
        video.hidden = false;
      }
    }

    sembunyikanPesan(pesan);

    // Tandai video aktif supaya tidak ada dua video bersuara bersamaan.
    const aktif = pakaiIframe ? iframe : video;
    if (aktif) {
      if (untukModal === true) videoModalAktif = aktif;
      else videoResepAktif = aktif;
      lebihiKeHalamanShorts(untukModal, aktif);
    }
  };

  // Pesan jelas kalau berkas video gagal dimuat.
  [diWadahVideo, cadanganVideo].forEach(function (video) {
    if (!video || !video.addEventListener || video._videoResepSiap) return;
    video._videoResepSiap = true;
    video.addEventListener("error", function () {
      const adaYoutube = daftar.some(function (v) { return v.jenis === "youtube"; });
      tampilkanPesan(pesanEl(video), adaYoutube
        ? "ℹ️ Video cadangan tidak bisa diputar. Tekan tombol VIDEO untuk menonton lewat YouTube ya, Bu."
        : pesanGagal);
    });
    video.addEventListener("playing", function () { sembunyikanPesan(pesanEl(video)); });
    video.addEventListener("loadeddata", function () { sembunyikanPesan(pesanEl(video)); });
  });

  // Tombol besar untuk berpindah video (VIDEO 1 / VIDEO 2 / ...).
  const tombolSemua = wadah && wadah.querySelectorAll ? wadah.querySelectorAll(".tombol-video-pilih") : [];
  Array.prototype.forEach.call(tombolSemua, function (tombol) {
    tombol.addEventListener("click", function () {
      const nomor = Number(tombol.dataset.videoNomor) || 0;
      Array.prototype.forEach.call(tombolSemua, function (lain) { lain.classList.remove("aktif"); });
      tombol.classList.add("aktif");
      pasangPilihan(nomor);
    });
  });

  // Pasang pilihan awal.
  pasangPilihan(nomorAwal);
}

function lebihiKeHalamanShorts(untukModal, aktifBaru) {
  // Menghentikan video lain yang tidak lagi terlihat supaya tidak ada
  // dua video bersuara bersamaan.
  const lain = untukModal === true ? videoResepAktif : videoModalAktif;
  if (lain && lain !== aktifBaru && lain.pause) lain.pause();
}

function bagianDaftar(judul, daftar, kelasJudul, hanyaNama) {
  let isi = '<h3 class="' + kelasJudul + '">' + judul + "</h3>";
  isi += '<ul class="daftar-item">';
  daftar.forEach(function (item) {
    isi +=
      '<li class="item-baris">' +
        gambarIkonItem(item) +
        '<span class="nama-item">' + amanTeks(item.nama) + "</span>" +
        (hanyaNama ? "" : '<span class="jumlah-item">' + amanTeks(item.jumlah) + "</span>") +
      "</li>";
  });
  isi += "</ul>";
  return isi;
}

// Ikon bahan/alat: pakai gambar PNG (Noto Emoji) dengan cadangan emoji teks.
function gambarIkonItem(item) {
  if (item.gambar_ikon) {
    return (
      '<img class="ikon-item-gambar" src="' + amanTeks(item.gambar_ikon) + '" alt="" ' +
      'loading="lazy" decoding="async" data-emoji="' + amanTeks(item.ikon || "🍽️") + '" ' +
      'onerror="gagalIkon(this)" />'
    );
  }
  return '<span class="ikon-item" aria-hidden="true">' + (item.ikon || "🍽️") + "</span>";
}

function gagalIkon(img) {
  const span = document.createElement("span");
  span.className = "ikon-item";
  span.setAttribute("aria-hidden", "true");
  span.textContent = img.dataset.emoji || "🍽️";
  img.replaceWith(span);
}

function bagianLangkah(resep) {
  let isi = '<h3 class="judul-bagian">👩‍🍳 LANGKAH MEMASAK</h3>';
  isi += '<ol class="daftar-langkah">';
  (resep.langkah_memasak || resep.langkah || []).forEach(function (langkah, nomor) {
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
  (resep.bahan || resep.bahanUtama || []).forEach(function (item, i) {
    daftar.push({ kunci: "bahan-" + i, nama: item.nama, jumlah: item.jumlah, ikon: item.ikon, gambar_ikon: item.gambar_ikon, jenis: "Bahan Utama" });
  });
  (resep.bumbu || []).forEach(function (item, i) {
    daftar.push({ kunci: "bumbu-" + i, nama: item.nama, jumlah: item.jumlah, ikon: item.ikon, gambar_ikon: item.gambar_ikon, jenis: "Bumbu" });
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

function bukaModePasar(resep, wadah, untukModal) {
  aplikasi.modePasar = true;
  wadah = wadah || document.getElementById("isi-resep");
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
        gambarIkonItem(item) +
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
        perbaruiStatusBaris(wadah, resep.id, barisEl);
      }, 0);
    });
    const kotak = barisEl.querySelector(".kotak-centang");
    kotak.addEventListener("change", function () {
      perbaruiStatusBaris(wadah, resep.id, barisEl);
    });
  });

  wadah.querySelector("#tombol-centang-semua").addEventListener("click", function () {
    const semua = {};
    baris.forEach(function (item) { semua[item.kunci] = true; });
    simpanCentangan(resep.id, semua);
    bukaModePasar(resep, wadah, untukModal);
  });

  wadah.querySelector("#tombol-kosongkan").addEventListener("click", function () {
    if (confirm("Yakin ingin mengosongkan semua centangan belanja?")) {
      simpanCentangan(resep.id, {});
      bukaModePasar(resep, wadah, untukModal);
    }
  });

  [ "#tombol-kembali-resep", "#tombol-kembali-resep-2" ].forEach(function (idTombol) {
    wadah.querySelector(idTombol).addEventListener("click", function () {
      aplikasi.modePasar = false;
      gambarDetailResep(resep, wadah, untukModal);
    });
  });

  perbaruiProgres(wadah);
  if (untukModal !== true) window.scrollTo(0, 0);
}

function perbaruiStatusBaris(wadah, idResep, barisEl) {
  const kotak = barisEl.querySelector(".kotak-centang");
  const centang = bacaCentangan(idResep);
  centang[barisEl.dataset.kunci] = kotak.checked;
  simpanCentangan(idResep, centang);
  barisEl.classList.toggle("sudah-dibeli", kotak.checked);
  perbaruiProgres(wadah);
}

function perbaruiProgres(wadah) {
  const resep = aplikasi.resepAktif;
  if (!resep) return;
  wadah = wadah || document.getElementById("isi-resep");
  if (!wadah) return;
  const kotak = wadah.querySelectorAll(".kotak-centang");
  if (kotak.length === 0) return;
  const sudah = wadah.querySelectorAll(".kotak-centang:checked").length;
  const total = kotak.length;
  const teks = wadah.querySelector("#teks-progres") || document.getElementById("teks-progres");
  if (!teks) return;
  teks.textContent = sudah + " dari " + total + " barang sudah dibeli";
}

/* ---------------------------------------------------------
   4B. SECTION "LAGI RAME DI OMONGIN ORANG!" (RESEP VIRAL)
   --------------------------------------------------------- */

// RSS kuliner Indonesia yang dilewatkan proxy gratis rss2json.
const SUMBER_RSS = [
  "https://food.detik.com/rss",
  "https://food.detik.com/info-kuliner/rss",
  "https://www.fimela.com/food/rss"
];

// Kata kunci agar hanya berita resep/viral yang tampil.
const KATA_KUNCI_VIRAL = ["resep", "viral", "cara membuat", "cara bikin", "resepnya", "bikin", "trending"];
const BATAS_BERITA_VIRAL = 8;

// Foto cadangan (dari resep viral permanen) kalau berita tidak punya gambar.
function fotoCadanganViral(nomor) {
  const permanen = aplikasi.semuaResep.filter(function (r) { return r.viral === true; });
  if (permanen.length === 0) return "";
  return permanen[nomor % permanen.length].gambar_masakan || permanen[nomor % permanen.length].gambar || "";
}

async function fetchViralRecipes() {
  const wadah = document.getElementById("viral-cards");
  const teksStatus = document.getElementById("viral-status");
  if (!wadah) return;

  const permanen = aplikasi.semuaResep.filter(function (r) { return r.viral === true; });

  // 1) Tampilkan dulu 5 resep viral permanen supaya section tidak pernah kosong.
  gambarKartuViral(wadah, permanen.map(function (r, i) {
    return {
      judul: r.nama,
      asal: r.daerah,
      gambar: r.gambar_masakan || r.gambar,
      tipe: "resep",
      id: r.id,
      nomor: i
    };
  }));
  teksStatus.textContent =
    "Menampilkan " + permanen.length + " resep viral andalan. Mengambil berita terbaru…";

  // 2) Coba ambil berita kuliner terbaru lewat rss2json (proxy CORS gratis).
  try {
    const berita = await ambilBeritaKuliner();
    if (berita.length > 0) {
      gambarKartuViral(wadah, berita.concat(permanen.map(function (r, i) {
        return {
          judul: r.nama,
          asal: r.daerah,
          gambar: r.gambar_masakan || r.gambar,
          tipe: "resep",
          id: r.id,
          nomor: berita.length + i
        };
      })));
      teksStatus.textContent =
        "✅ " + berita.length + " berita kuliner terbaru berhasil dimuat (sumber: detik Food), " +
        "ditambah " + permanen.length + " resep viral andalan.";
    } else {
      teksStatus.textContent =
        "Menampilkan " + permanen.length + " resep viral andalan. " +
        "Berita terbaru sedang tidak tersedia, silakan coba lagi nanti.";
    }
  } catch (error) {
    console.warn("RSS viral gagal dimuat, memakai resep permanen.", error);
    teksStatus.textContent =
      "Menampilkan " + permanen.length + " resep viral andalan. " +
      "Internet lambat, berita terbaru belum bisa dimuat.";
  }

  pasangTombolGulirViral();
}

async function ambilBeritaKuliner() {
  const terlihat = {};
  const hasil = [];

  for (let s = 0; s < SUMBER_RSS.length; s++) {
    try {
      const url =
        "https://api.rss2json.com/v1/api.json?rss_url=" +
        encodeURIComponent(SUMBER_RSS[s]) +
        "&count=20";
      const jawaban = await fetch(url);
      if (!jawaban.ok) continue;
      const data = await jawaban.json();
      if (data.status !== "ok" || !Array.isArray(data.items)) continue;

      for (let i = 0; i < data.items.length; i++) {
        const berita = data.items[i];
        const judul = String(berita.title || "").trim();
        const tautan = String(berita.link || "").trim();
        if (!judul || !tautan) continue;
        if (judul.length > 90) continue;

        const judulKecil = judul.toLowerCase();
        const cocok = KATA_KUNCI_VIRAL.some(function (kunci) {
          return judulKecil.includes(kunci);
        });
        if (!cocok) continue;
        if (terlihat[judul]) continue;
        terlihat[judul] = true;

        const gambar = String(berita.thumbnail || berita.enclosure?.link || "").trim();
        hasil.push({
          judul: judul,
          asal: "Berita terbaru",
          gambar: gambar || fotoCadanganViral(hasil.length),
          tipe: "berita",
          tautan: tautan,
          nomor: hasil.length
        });
        if (hasil.length >= BATAS_BERITA_VIRAL) return hasil;
      }
      if (hasil.length > 0) return hasil; // sudah cukup dari satu sumber
    } catch (error) {
      console.warn("Sumber RSS gagal:", SUMBER_RSS[s], error);
    }
  }
  return hasil;
}

function gambarKartuViral(wadah, daftar) {
  wadah.innerHTML = "";
  daftar.forEach(function (kartu) {
    const el = document.createElement("div");
    el.className = "kartu-viral";

    const gambarHtml =
      '<img class="gambar-viral" src="' + amanTeks(kartu.gambar) + '" ' +
      'alt="' + amanTeks(kartu.judul) + '" loading="lazy" onerror="gagalGambar(this)" />';
    const badgeViral = '<span class="badge-viral">🔥 VIRAL!</span>';
    const badgeBaru = kartu.tipe === "berita" ? '<span class="badge-baru">BARU</span>' : "";

    const tombolLabel = kartu.tipe === "berita" ? "📰 BACA BERITA" : "🍲 LIHAT RESEPNYA";
    const isiHtml =
      '<div class="isi-viral">' +
        '<h3 class="judul-viral-kartu">' + amanTeks(kartu.judul) + "</h3>" +
        '<p class="asal-viral-kartu">' + amanTeks(kartu.asal || "") + "</p>" +
        '<button class="tombol-viral" type="button">' + tombolLabel + "</button>" +
      "</div>";

    el.innerHTML = gambarHtml + badgeViral + badgeBaru + isiHtml;

    function buka() {
      if (kartu.tipe === "berita") {
        window.open(kartu.tautan, "_blank", "noopener");
      } else {
        window.location.hash = "#/resep/" + kartu.id;
      }
    }

    el.addEventListener("click", buka);
    const tombolDalam = el.querySelector(".tombol-viral");
    if (tombolDalam) tombolDalam.addEventListener("click", buka);

    wadah.appendChild(el);
  });
}

function pasangTombolGulirViral() {
  const wadah = document.getElementById("viral-cards");
  const kiri = document.getElementById("viral-gulir-kiri");
  const kanan = document.getElementById("viral-gulir-kanan");
  if (!wadah || !kiri || !kanan) return;
  const jarak = Math.max(240, wadah.clientWidth - 80);
  kiri.addEventListener("click", function () { wadah.scrollLeft -= jarak; });
  kanan.addEventListener("click", function () { wadah.scrollLeft += jarak; });
}

/* ---------------------------------------------------------
   4C. FAVORIT / RESEP TERSIMPAN (BOOKMARK)
   Hanya menyimpan id resep makanan — bumbu, alat, dan
   checklist Mode Pasar TIDAK ikut. Data disimpan di
   localStorage browser (aman meskipun halaman ditutup).
   --------------------------------------------------------- */
function muatFavorit() {
  try {
    const teks = localStorage.getItem(KUNCI_FAVORIT);
    const isi = teks ? JSON.parse(teks) : [];
    daftarFavorit = new Set(Array.isArray(isi) ? isi : []);
  } catch (e) {
    daftarFavorit = new Set();
  }
}

// Jumlah resep tersimpan yang benar-benar ada di data
// (id resep lama yang sudah tidak ada di data akan diabaikan).
function jumlahFavorit() {
  return aplikasi.semuaResep.filter(function (r) {
    return daftarFavorit.has(r.id);
  }).length;
}

function perbaruiHitungFavorit() {
  const kotak = document.getElementById("jumlah-favorit");
  if (kotak) kotak.textContent = jumlahFavorit();
}

// Menyesuaikan tampilan tombol simpan: masih kosong (☆) atau sudah terisi (★).
function aturTampilFavorit(tombol, tersimpan) {
  if (tombol.classList.contains("shorts-bookmark")) {
    // tombol khusus Mode Shorts: ikon + tulisan besar (ramah lansia)
    if (tersimpan) tombol.classList.add("aktif");
    else tombol.classList.remove("aktif");
    tombol.setAttribute("aria-pressed", tersimpan ? "true" : "false");
    tombol.innerHTML = tersimpan
      ? '<span class="shorts-aksi-ikon" aria-hidden="true">⭐</span><span class="shorts-aksi-teks">TERSIMPAN</span>'
      : '<span class="shorts-aksi-ikon" aria-hidden="true">☆</span><span class="shorts-aksi-teks">SIMPAN</span>';
    return;
  }
  const tombolBesar = tombol.classList.contains("tombol-simpan"); // tombol di halaman detail
  if (tersimpan) tombol.classList.add("aktif");
  else tombol.classList.remove("aktif");
  tombol.setAttribute("aria-pressed", tersimpan ? "true" : "false");
  tombol.textContent = tersimpan
    ? (tombolBesar ? "⭐ RESEP SUDAH TERSIMPAN — tekan untuk menghapus" : "★ TERSIMPAN")
    : (tombolBesar ? "⭐ SIMPAN RESEP INI" : "☆ SIMPAN");
}

function pasangTombolFavorit(tombol, resep) {
  aturTampilFavorit(tombol, daftarFavorit.has(resep.id));
  tombol.addEventListener("click", function (peristiwa) {
    if (peristiwa && peristiwa.stopPropagation) peristiwa.stopPropagation();
    tekanFavorit(resep);
  });
}

function tekanFavorit(resep) {
  if (daftarFavorit.has(resep.id)) daftarFavorit.delete(resep.id);
  else daftarFavorit.add(resep.id);
  try {
    localStorage.setItem(KUNCI_FAVORIT, JSON.stringify(Array.from(daftarFavorit)));
  } catch (e) {
    console.error("Penyimpanan browser penuh atau diblokir.", e);
  }

  const tersimpan = daftarFavorit.has(resep.id);
  // perbarui semua tombol resep yang sama (kartu di daftar & tombol di detail)
  document.querySelectorAll('[data-favorit="' + resep.id + '"]').forEach(function (tombol) {
    aturTampilFavorit(tombol, tersimpan);
  });
  perbaruiHitungFavorit();

  // kalau sedang membuka daftar "⭐ Tersimpan", daftar ikut diperbarui
  if (aplikasi.kategoriAktif === "tersimpan") gambarDaftarResep();
}

/* ---------------------------------------------------------
   4D. ALGORITMA "FYP" — SELERA IBU DI SIMPAN DI LOCALSTORAGE
   Setiap video ditonton >3 detik atau resepnya dibuka,
   skor daerah/negara naik +1. Feed Shorts 70% mengikuti
   selera, 30% daerah/negara acak sebagai penyegaran.
   --------------------------------------------------------- */
function muatSkorFyp() {
  try {
    const teks = localStorage.getItem(KUNCI_FYP);
    const isi = teks ? JSON.parse(teks) : {};
    const bersih = {};
    if (isi && typeof isi === "object" && !Array.isArray(isi)) {
      Object.keys(isi).forEach(function (kunci) {
        const nilai = Number(isi[kunci]);
        if (kunci && nilai > 0) bersih[kunci] = nilai;
      });
    }
    skorFyp = bersih;
  } catch (e) {
    skorFyp = {};
  }
}

function simpanSkorFyp() {
  try {
    localStorage.setItem(KUNCI_FYP, JSON.stringify(skorFyp));
  } catch (e) {
    console.error("Penyimpanan browser penuh atau diblokir.", e);
  }
}

// Kunci selera: Nusantara memakai daerah asal (mis. "Padang"),
// masakan dunia memakai negara (mis. "Jepang").
function kunciFyp(resep) {
  const asal = String(resep.daerah || "").split("—")[0].split("–")[0].trim();
  if (resep.kategori === "dunia") return asal || "Dunia";
  return asal || "Nusantara";
}

// Menambah 1 poin selera untuk daerah/negara masakan ini.
function catatSkorFyp(resep) {
  if (!resep) return;
  const kunci = kunciFyp(resep);
  if (!kunci) return;
  skorFyp[kunci] = (Number(skorFyp[kunci]) || 0) + 1;
  simpanSkorFyp();
}

// Mengacak daftar (Fisher–Yates) tanpa mengubah daftar aslinya.
function acakDaftar(daftar) {
  const salinan = daftar.slice();
  for (let i = salinan.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tukar = salinan[i];
    salinan[i] = salinan[j];
    salinan[j] = tukar;
  }
  return salinan;
}

// Menyusun antrean video: 70% daerah/negara favorit, 30% penyegar acak.
function bangunAntreanShorts() {
  const semua = aplikasi.semuaResep.filter(function (r) {
    return ((r.video_youtube && r.video_youtube.length > 0) ||
      (r.video_tutorial && r.video_tutorial.length > 0)) &&
      (r.gambar_masakan || r.gambar);
  });

  const kunciTerurut = Object.keys(skorFyp)
    .filter(function (kunci) { return Number(skorFyp[kunci]) > 0; })
    .sort(function (a, b) { return Number(skorFyp[b]) - Number(skorFyp[a]); });

  // Belum ada riwayat sama sekali: seluruh antrean diacak (semuanya penyegar).
  if (kunciTerurut.length === 0) return acakDaftar(semua);

  const kunciUtama = {};
  kunciTerurut.forEach(function (kunci) { kunciUtama[kunci] = true; });

  const prioritas = [];
  kunciTerurut.forEach(function (kunci) {
    acakDaftar(semua.filter(function (r) { return kunciFyp(r) === kunci; }))
      .forEach(function (r) { prioritas.push(r); });
  });
  const penyegar = acakDaftar(semua.filter(function (r) {
    return !kunciUtama[kunciFyp(r)];
  }));

  const antrean = [];
  let iPrioritas = 0;
  let iPenyegar = 0;
  while (iPrioritas < prioritas.length || iPenyegar < penyegar.length) {
    for (let i = 0; i < BAGIAN_PRIORITAS && iPrioritas < prioritas.length; i++) {
      antrean.push(prioritas[iPrioritas]);
      iPrioritas++;
    }
    for (let i = 0; i < BAGIAN_PENYEGAR && iPenyegar < penyegar.length; i++) {
      antrean.push(penyegar[iPenyegar]);
      iPenyegar++;
    }
    if (iPrioritas >= prioritas.length) {
      while (iPenyegar < penyegar.length) { antrean.push(penyegar[iPenyegar]); iPenyegar++; }
    }
    if (iPenyegar >= penyegar.length) {
      while (iPrioritas < prioritas.length) { antrean.push(prioritas[iPrioritas]); iPrioritas++; }
    }
  }
  return antrean;
}

// Memilih tautan video untuk Shorts (video langsung). Video YouTube tidak
// dipakai di Mode Shorts karena harus diputar otomatis tanpa sentuhan.
function pilihVideoShorts(resep, nomor) {
  const daftar = resep.video_tutorial || [];
  if (daftar.length === 0) return "";
  if (daftar.length === 1) return daftar[0];
  return daftar[nomor % daftar.length];
}

/* ---------------------------------------------------------
   4E. MODE SHORTS (VIDEO OTOMATIS PENUH LAYAR)
   --------------------------------------------------------- */
function pasangTombolShorts() {
  const tombolMasuk = document.getElementById("tombol-shorts");
  if (tombolMasuk) {
    tombolMasuk.addEventListener("click", function () {
      window.location.hash = "#/shorts";
    });
  }

  const tombolKeluar = document.getElementById("shorts-keluar");
  if (tombolKeluar) {
    tombolKeluar.addEventListener("click", function () {
      keDaftarResep();
    });
  }

  const tombolSuara = document.getElementById("shorts-suara");
  if (tombolSuara) {
    tombolSuara.addEventListener("click", alihSuaraShorts);
  }

  // Catatan: tombol CARI dipasang per video di dalam buatItemShorts()
  // karena setiap video punya tombolnya sendiri di sisi kanan layar.

  const tombolCariTutup = document.getElementById("shorts-cari-tutup");
  if (tombolCariTutup) {
    tombolCariTutup.addEventListener("click", tutupKotakCariShorts);
  }

  const kotakCari = document.getElementById("shorts-cari");
  if (kotakCari) {
    kotakCari.addEventListener("input", function () {
      clearTimeout(jedaCariShorts);
      jedaCariShorts = setTimeout(function () {
        saringShorts(kotakCari.value);
      }, 250);
    });
  }

  const tombolModalTutup = document.getElementById("shorts-modal-tutup");
  if (tombolModalTutup) {
    tombolModalTutup.addEventListener("click", tutupModalShorts);
  }
}

function bukaModeShorts() {
  const halaman = document.getElementById("halaman-shorts");
  const feed = document.getElementById("shorts-feed");
  if (!halaman || !feed) {
    keDaftarResep();
    return;
  }
  if (shortsTerbuka) return; // sudah terbuka, tidak perlu dipasang ulang

  // Ingat posisi daftar supaya saat keluar tidak kembali ke paling atas.
  posisiShorts = aplikasi.resepAktif ? 0 : window.scrollY;
  shortsTerbuka = true;
  sudahDihitungShorts = new Set();

  document.getElementById("halaman-daftar").hidden = true;
  document.getElementById("halaman-resep").hidden = true;
  halaman.hidden = false;
  document.body.classList.add("kunci-gerak-shorts");
  document.title = "Mode Shorts — Buku Resep Ibu-Ibu";

  gambarFeedShorts(bangunAntreanShorts());
}

// Melepas semua pemantau + menghentikan video (hemat baterai & kuota).
function matikanShorts() {
  if (!shortsTerbuka) return;
  shortsTerbuka = false;
  if (pengamatShorts) {
    pengamatShorts.disconnect();
    pengamatShorts = null;
  }
  clearTimeout(jedaLihatShorts);
  jedaShortsHentikanVideo();
  itemAktifShorts = null;
  const feed = document.getElementById("shorts-feed");
  if (feed) feed.innerHTML = "";
  const halaman = document.getElementById("halaman-shorts");
  if (halaman) halaman.hidden = true;
  const modal = document.getElementById("shorts-modal");
  if (modal) modal.hidden = true;
  document.body.classList.remove("kunci-gerak-shorts");
}

function jedaShortsHentikanVideo() {
  const feed = document.getElementById("shorts-feed");
  if (!feed || !feed.querySelectorAll) return;
  feed.querySelectorAll("video").forEach(function (video) {
    if (video.pause) video.pause();
  });
}

function pilihVideoTerpasang(video) {
  if (!video || !video.play) return;
  const janji = video.play();
  if (janji && janji.catch) janji.catch(function () { /* autoplay ditolak browser */ });
}

function gambarFeedShorts(antrean) {
  const feed = document.getElementById("shorts-feed");
  if (!feed) return;
  if (pengamatShorts) {
    pengamatShorts.disconnect();
    pengamatShorts = null;
  }
  clearTimeout(jedaLihatShorts);
  itemAktifShorts = null;
  antreanShorts = antrean;
  feed.innerHTML = "";

  const frag = document.createDocumentFragment();
  antrean.forEach(function (resep, nomor) {
    frag.appendChild(buatItemShorts(resep, nomor));
  });
  feed.appendChild(frag);
  feed.scrollTop = 0;

  perbaruiStatusShorts(antrean.length);
  pasangPengamatShorts();
}

function perbaruiStatusShorts(jumlah) {
  const status = document.getElementById("shorts-status");
  const panduan = document.getElementById("shorts-panduan");
  if (panduan) panduan.hidden = jumlah === 0;
  if (!status) return;
  if (jumlah === 0) {
    status.hidden = false;
    status.textContent = "😕 Tidak ada masakan yang cocok. Coba kata kunci lain ya, Bu.";
    return;
  }
  status.hidden = true;
  status.textContent = "";
}

// Menulis keterangan pencarian di Mode Shorts (jumlah hasil + contoh pertama).
function tulisStatusCariShorts(kata, hasil) {
  const status = document.getElementById("shorts-status");
  if (!status) return;
  if (hasil.length === 0) {
    status.hidden = false;
    status.textContent = "😕 Tidak ada masakan yang cocok dengan “" + kata + "”. Coba kata lain ya, Bu.";
    return;
  }
  status.hidden = false;
  status.textContent = "🔍 " + hasil.length + " masakan ditemukan untuk “" + kata +
    "”. Video mulai dari " + hasil[0].nama + ".";
}

function buatItemShorts(resep, nomor) {
  const item = document.createElement("div");
  item.className = "shorts-item";
  item.dataset.id = resep.id;
  item.dataset.video = pilihVideoShorts(resep, nomor);
  const gambar = amanTeks(resep.gambar_masakan || resep.gambar);

  item.innerHTML =
    // Video dipasang saat item mendekat layar (hemat kuota & memori HP).
    '<video class="shorts-video" playsinline webkit-playsinline muted loop preload="none" ' +
      'poster="' + gambar + '" aria-hidden="true"></video>' +
    // Lapisan transparan penutup video: gesture geser jari selalu diteruskan
    // ke kolom feed, tidak pernah tertahan pemutar video.
    '<div class="shorts-overlay-geser" aria-hidden="true"></div>' +
    '<div class="shorts-panel">' +
      '<img class="shorts-thumb" src="' + gambar + '" alt="" loading="lazy" decoding="async" onerror="gagalGambar(this)" />' +
      '<div class="shorts-teks">' +
        '<p class="shorts-nama">' + resep.ikon + " " + amanTeks(resep.nama) + "</p>" +
        '<p class="shorts-asal">📍 ' + amanTeks(resep.daerah) + " &nbsp;•&nbsp; ⏱️ " + resep.waktu + " menit</p>" +
      "</div>" +
    "</div>" +
    '<div class="shorts-aksi">' +
      '<button class="shorts-tombol shorts-bookmark" type="button" data-favorit="' + amanTeks(resep.id) + '" aria-pressed="false" aria-label="Simpan resep ' + amanTeks(resep.nama) + '"></button>' +
      '<button class="shorts-tombol shorts-detail" type="button" aria-label="Buka resep lengkap ' + amanTeks(resep.nama) + '">' +
        '<span class="shorts-aksi-ikon" aria-hidden="true">📖</span><span class="shorts-aksi-teks">RESEP</span>' +
      "</button>" +
      '<button class="shorts-tombol shorts-cari-buka" type="button" aria-label="Cari masakan lain">' +
        '<span class="shorts-aksi-ikon" aria-hidden="true">🔍</span><span class="shorts-aksi-teks">CARI</span>' +
      "</button>" +
    "</div>";

  // Tombol simpan memakai sistem favorit yang sama dengan daftar resep.
  const tombolSimpan = item.querySelector(".shorts-bookmark");
  if (tombolSimpan) aturTampilFavorit(tombolSimpan, daftarFavorit.has(resep.id));
  if (tombolSimpan) {
    tombolSimpan.addEventListener("click", function (peristiwa) {
      if (peristiwa && peristiwa.stopPropagation) peristiwa.stopPropagation();
      tekanFavorit(resep);
    });
  }

  const tombolDetail = item.querySelector(".shorts-detail");
  if (tombolDetail) {
    tombolDetail.addEventListener("click", function (peristiwa) {
      if (peristiwa && peristiwa.stopPropagation) peristiwa.stopPropagation();
      bukaModalShorts(resep);
    });
  }

  const tombolCari = item.querySelector(".shorts-cari-buka");
  if (tombolCari) {
    tombolCari.addEventListener("click", function (peristiwa) {
      if (peristiwa && peristiwa.stopPropagation) peristiwa.stopPropagation();
      bukaKotakCariShorts();
    });
  }

  return item;
}

function pasangPengamatShorts() {
  const feed = document.getElementById("shorts-feed");
  if (!feed || !feed.querySelectorAll) return;
  const itemSemua = feed.querySelectorAll(".shorts-item");

  // Pemantau memutuskan video mana yang sedang tampil di layar.
  if (typeof IntersectionObserver !== "undefined") {
    pengamatShorts = new IntersectionObserver(function (entri) {
      entri.forEach(function (satu) {
        const item = satu.target;
        if (satu.isIntersecting && satu.intersectionRatio >= 0.55) {
          pasangVideoItemShorts(item);
          const resep = cariResepShorts(item.dataset.id);
          if (item !== itemAktifShorts) {
            letakkanItemAktifShorts(item, resep);
          }
        } else if (!satu.isIntersecting) {
          const video = item.querySelector ? item.querySelector("video") : null;
          if (video && video.pause) video.pause();
          if (satu.intersectionRatio === 0) lepasVideoItemShorts(item);
        }
      });
    }, { root: feed, threshold: [0, 0.55, 0.9] });
    itemSemua.forEach(function (item) { pengamatShorts.observe(item); });
    return;
  }

  // Cadangan untuk browser lama: aktifkan video pertama saja.
  if (itemSemua.length > 0) {
    pasangVideoItemShorts(itemSemua[0]);
    letakkanItemAktifShorts(itemSemua[0], cariResepShorts(itemSemua[0].dataset.id));
  }
}

function cariResepShorts(id) {
  return aplikasi.semuaResep.find(function (r) { return r.id === id; });
}

// Memasang tautan video hanya saat item mendekati layar.
function pasangVideoItemShorts(item) {
  const video = item.querySelector ? item.querySelector("video") : null;
  if (!video) return;
  const tautan = item.dataset.video || "";
  if (!tautan) return;
  if (video.getAttribute("src") !== tautan) {
    video.setAttribute("src", tautan);
    if (video.load) video.load();
  }
  video.muted = !suaraShortsNyala;
  pilihVideoTerpasang(video);
}

// Melepas tautan video dari item yang jauh (menghemat memori HP lansia).
function lepasVideoItemShorts(item) {
  const video = item.querySelector ? item.querySelector("video") : null;
  if (!video) return;
  if (video.pause) video.pause();
  video.removeAttribute("src");
  if (video.load) video.load();
}

// Video mana yang sedang dilihat + hitung 3 detik untuk poin selera.
function letakkanItemAktifShorts(item, resep) {
  itemAktifShorts = item;
  clearTimeout(jedaLihatShorts);
  if (!resep || sudahDihitungShorts.has(resep.id)) return;
  jedaLihatShorts = setTimeout(function () {
    if (itemAktifShorts !== item) return; // sudah digeser ke video lain
    sudahDihitungShorts.add(resep.id);
    catatSkorFyp(resep);
  }, LAMA_LIHAT_SHORTS);
}

function alihSuaraShorts() {
  suaraShortsNyala = !suaraShortsNyala;
  const tombol = document.getElementById("shorts-suara");
  const ikon = document.getElementById("shorts-ikon-suara");
  const teks = tombol ? tombol.querySelector(".shorts-suara-teks") : null;
  if (tombol) tombol.setAttribute("aria-pressed", suaraShortsNyala ? "true" : "false");
  if (ikon) ikon.textContent = suaraShortsNyala ? "🔊" : "🔇";
  if (teks) teks.textContent = suaraShortsNyala ? "SUARA NYALA" : "SUARA MATI";

  const feed = document.getElementById("shorts-feed");
  if (!feed || !feed.querySelectorAll) return;
  feed.querySelectorAll("video").forEach(function (video) {
    video.muted = !suaraShortsNyala;
    // Menyalakan suara butuh sentuhan pengguna — klik tombol ini sudah cukup.
    if (suaraShortsNyala) pilihVideoTerpasang(video);
  });
}

function bukaKotakCariShorts() {
  const bungkus = document.getElementById("shorts-cari-bungkus");
  const kotak = document.getElementById("shorts-cari");
  if (bungkus) bungkus.hidden = false;
  if (kotak) kotak.focus();
}

function tutupKotakCariShorts() {
  const bungkus = document.getElementById("shorts-cari-bungkus");
  const kotak = document.getElementById("shorts-cari");
  if (kotak) kotak.value = "";
  if (bungkus) bungkus.hidden = true;
  gambarFeedShorts(bangunAntreanShorts()); // kembalikan antrean sesuai selera
}

// Menyaring video yang paling mirip dengan kata yang diketik ibu.
function saringAntreanShorts(kata) {
  const cari = String(kata || "").toLowerCase().trim();
  if (cari === "") return bangunAntreanShorts();
  const cocok = [];
  aplikasi.semuaResep.forEach(function (resep) {
    if ((!resep.video_tutorial || resep.video_tutorial.length === 0) &&
      (!resep.video_youtube || resep.video_youtube.length === 0)) return;
    let nilai = 0;
    if (String(resep.nama).toLowerCase().includes(cari)) nilai = 3;
    else if (String(resep.daerah).toLowerCase().includes(cari)) nilai = 2;
    else {
      const bahan = (resep.bahan || resep.bahanUtama || []).concat(resep.bumbu || []);
      if (bahan.some(function (item) {
        return String(item.nama).toLowerCase().includes(cari);
      })) nilai = 1;
    }
    if (nilai > 0) cocok.push({ resep: resep, nilai: nilai });
  });
  cocok.sort(function (a, b) { return b.nilai - a.nilai; });
  return cocok.map(function (x) { return x.resep; });
}

function saringShorts(kata) {
  const cari = String(kata || "").toLowerCase().trim();
  if (cari === "") {
    gambarFeedShorts(bangunAntreanShorts()); // kosong = kembali ke antrean selera
    return;
  }
  const hasil = saringAntreanShorts(cari);
  gambarFeedShorts(hasil);
  tulisStatusCariShorts(kata.trim(), hasil);
}

function bukaModalShorts(resep) {
  const modal = document.getElementById("shorts-modal");
  const isi = document.getElementById("isi-resep-modal");
  if (!modal || !isi) return;
  catatSkorFyp(resep); // membuka resep = minat ibu naik (+1 poin selera)
  gambarDetailResep(resep, isi, true);
  modal.hidden = false;
  modal.scrollTop = 0;
  jedaShortsHentikanVideo(); // video jeda dulu supaya ibu fokus membaca
}

function tutupModalShorts() {
  const modal = document.getElementById("shorts-modal");
  const isi = document.getElementById("isi-resep-modal");
  if (modal) modal.hidden = true;
  if (videoModalAktif && videoModalAktif.pause) videoModalAktif.pause();
  videoModalAktif = null;
  if (isi) isi.innerHTML = "";
  aplikasi.modePasar = false;
  if (itemAktifShorts) pasangVideoItemShorts(itemAktifShorts); // video lanjut diputar
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
    "justify-content:center;text-align:center;font-size:24px;font-weight:800;padding:24px;box-sizing:border-box;";

  // Samakan tinggi kotak cadangan dengan tinggi gambar aslinya.
  const tinggiGambar = img.getBoundingClientRect().height;
  if (tinggiGambar > 0) {
    kotak.style.height = Math.round(tinggiGambar) + "px";
  } else if (img.classList.contains("gambar-viral")) {
    kotak.style.height = "280px";
  } else if (img.classList.contains("kartu-gambar")) {
    kotak.style.height = "220px";
  } else if (img.classList.contains("foto-resep")) {
    kotak.style.height = "320px";
  } else {
    kotak.style.height = "220px";
  }

  kotak.textContent = "🍽️ " + nama;
  img.replaceWith(kotak);
}
