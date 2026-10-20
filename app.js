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

const JUMLAH_KARTU_AWAL = 24; // kartu dirender bertahap supaya HP lansia tetap lancar
const JUMLAH_TAMBAHAN = 24;

const aplikasi = {
  semuaResep: [],
  kategoriAktif: "semua",
  kataCari: "",
  modePasar: false,
  resepAktif: null,
  batasTampil: JUMLAH_KARTU_AWAL
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
    gambarDaftarResep();
  });

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

function gambarDaftarResep() {
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
  tombolMuat.hidden = sisa <= 0;
  tombolMuat.textContent = "📜 TAMPILKAN LEBIH BANYAK (sisa " + sisa + " resep)";

  wadah.innerHTML = "";
  const frag = document.createDocumentFragment();
  for (let nomor = 0; nomor < tampil; nomor++) {
    frag.appendChild(buatKartuResep(daftar[nomor]));
  }
  wadah.appendChild(frag);
}

function buatKartuResep(resep) {
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
  return tombol;
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
    '<img class="foto-resep" src="' + amanTeks(resep.gambar_masakan || resep.gambar) + '" alt="' + amanTeks(resep.nama) + '" decoding="async" onerror="gagalGambar(this)" />' +
    '<h2 class="judul-resep">' + resep.ikon + " " + amanTeks(resep.nama) + "</h2>" +
    '<p class="asal-resep">📍 ' + amanTeks(resep.daerah) + "</p>" +
    '<p class="deskripsi-resep">' + amanTeks(resep.deskripsi) + "</p>" +
    '<div class="baris-info">' +
      '<span class="kotak-info">⏱️ Waktu: ' + resep.waktu + " menit</span>" +
      '<span class="kotak-info">👨‍👩‍👧 Porsi: ' + amanTeks(resep.porsi) + "</span>" +
      '<span class="kotak-info">🎯 Tingkat: ' + amanTeks(resep.tingkat) + "</span>" +
    "</div>" +
    tombolMenujuPasar(resep) +
    bagianDaftar("🧅 BAHAN UTAMA", resep.bahan || resep.bahanUtama || [], "judul-bagian", false) +
    bagianDaftar("🌶️ BUMBU-BUMBU", resep.bumbu || [], "judul-bagian judul-bagian-merah", false) +
    bagianDaftar("🍳 ALAT MASAK", resep.alat_masak || resep.alat || [], "judul-bagian judul-bagian-biru", true) +
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
