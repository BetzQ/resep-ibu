# 🍲 Buku Resep Ibu-Ibu

Web aplikasi resep masakan interaktif yang **sangat mudah dibaca dan dipakai oleh ibu-ibu**.
Tampilan sederhana, huruf besar, tombol besar, tanpa menu tersembunyi.

## ✨ Fitur

- **🔥 Section “LAGI RAME DI OMONGIN ORANG!”** di paling atas halaman utama: barisan kartu geser-ke-samping dengan foto besar, judul besar, dan badge merah **“VIRAL!”**. Berisi **5 resep viral permanen** (Gohyong Cikini, Cromboloni, Seblak Coet Rafael, Mochi Bites, Ayam Chili Oil) yang selalu tampil, **plus berita kuliner terbaru otomatis** dari RSS Detik Food (tanpa API key) lewat proxy gratis `rss2json`, difilter kata kunci “Resep”, “Viral”, “Cara Membuat”. Jika internet lambat atau RSS error, 5 resep viral permanen tetap muncul.
- **28 resep lengkap** — 23 masakan Nusantara (Rendang, Soto Ayam, Rawon, Pempek, Papeda, Ayam Betutu, Gudeg, Coto Makassar, dll) + 5 masakan dunia (Spaghetti Bolognese, Sushi, Tom Yum, Pizza Margherita, Kari Ayam).
- **Foto masakan besar** di setiap halaman resep.
- **Bahan Utama, Bumbu, dan Alat Masak** dipisah jadi bagian terpisah. Setiap item punya **ikon kecil** + nama besar + takaran, supaya mudah dikenali.
- **Mode Pasar (Daftar Belanja)** — tekan tombol hijau **“🛒 Bawa ke Pasar”**, halaman berubah jadi checklist interaktif. Centangan otomatis **tersimpan di `localStorage`** sehingga tidak hilang walaupun browser ditutup atau di-refresh. Ada progres “X dari Y barang sudah dibeli”.
- **Langkah memasak** bernomor besar dengan kalimat pendek.
- **Pencarian + filter kategori** (Semua / Nusantara / Dunia).
- **Tombol “⬅️ KEMBALI” besar** di setiap halaman.
- Kontras tinggi (teks gelap di atas latar krem/putih), font dasar 20px, judul 28–34px, ramah untuk mata yang sudah tua.

## 📁 Struktur Folder

```
index.html   — halaman utama (termasuk section viral di bagian atas)
style.css    — gaya tampilan huruf besar & kontras tinggi
app.js       — logika aplikasi, pencarian, checklist pasar, pengambil RSS viral
data.json    — seluruh data resep (termasuk 5 resep viral permanen)
```

## 🚀 Cara Menjalankan

Halaman ini memuat `data.json`, jadi harus dibuka lewat server web (bukan klik dua kali `index.html`).

**Cara paling mudah:** buka alamat GitHub Pages-nya di browser.

**Cara lokal (di komputer):**

```bash
# pakai Python
python -m http.server 8000
# lalu buka http://localhost:8000

# atau pakai Node
npx serve .
```

## 🖼️ Sumber Foto

Seluruh foto masakan diambil dari **Wikimedia Commons** (lisensi bebas) melalui API resminya,
lalu ditampilkan dalam ukuran besar. Jika sebuah foto gagal dimuat, halaman otomatis menampilkan
kotak besar berisi nama masakan agar tetap jelas.

## 🗃️ Menyimpan Centangan Pasar

Centangan belanja disimpan di `localStorage` browser dengan kunci `pasar_v1_<id-resep>`.
Tekan tombol merah **“❌ KOSONGKAN CENTANGAN”** bila ingin memulai dari awal.
