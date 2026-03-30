# Perbaikan Website SID GMIM Smirna
### Changelog - 30 Maret 2026

---

## File yang Diperbaiki
- `app.js` — Logic utama aplikasi
- `index.html` — Halaman utama (meta tags + CSS)
- `robots.txt` — Konfigurasi crawler

---

## ✅ Fix 1: Berita Detail Menampilkan Berita yang Salah
**Masalah:** `sbFetch()` hanya mendukung filter hardcoded (`aktif=eq.true`, order/limit tertentu). Ketika `openBeritaDetail(id)` memanggil `sbFetch('berita', 'id=eq.5&limit=1')`, parameter `id=eq.5` tidak pernah diproses → selalu mengembalikan semua data, bukan berita yang diklik.

**Solusi:** Menulis ulang `sbFetch()` dengan dynamic filter parser menggunakan regex `matchAll` untuk semua parameter `eq`, termasuk auto type conversion (boolean/integer/string).

---

## ✅ Fix 2 & 3: Pengumuman Sistem Tampil di Halaman Publik
**Masalah:** Entry sistem (`_emailjs_config`, `_email_notif`, `_sosmed`) muncul di daftar pengumuman publik.

**Solusi:** Filter di `loadPubPengumuman()` dan `loadPubPengumumanRingkasan()` untuk menyembunyikan pengumuman yang judulnya diawali `_`.

---

## ✅ Fix 4: Editor Berita Tidak Bisa Upload Foto
**Masalah:** Toolbar Quill tanpa tombol `image`.

**Solusi:** Tombol `image` + `align` di toolbar, custom handler upload ke Supabase Storage (`foto` bucket, folder `berita/`).

---

## ✅ Fix 5: Visitor Counter Kosong
**Masalah:** `sessionStorage` direset tiap tab, `.catch()` salah penempatan, tidak ada default value.

**Solusi:** `localStorage` + auto-cleanup + `Promise.all` + default "0".

---

## ✅ Fix 6: robots.txt Domain Salah
Diubah ke `https://smirnamalalayangdua.org/sitemap.xml`

---

## ✅ Fix 7: Open Graph Meta Tags
Ditambahkan `og:type`, `og:url`, `og:title`, `og:description`, `og:image`, `og:locale`, Twitter Card.

---

## ✅ Fix 8: CSS Gambar dalam Berita
CSS responsif untuk gambar di konten berita dan editor.

---

## ⚠️ Masalah Keamanan (Butuh Perubahan Arsitektur)
1. **Supabase Service Key terekspos** — Pindahkan ke Edge/Serverless Functions
2. **Password plaintext** — Gunakan Supabase Auth atau bcrypt
3. **Data jemaat publik** — Aktifkan Row Level Security (RLS)

---

## Deploy
Ganti 3 file (`app.js`, `index.html`, `robots.txt`) di repository, lalu deploy ulang ke Netlify.
