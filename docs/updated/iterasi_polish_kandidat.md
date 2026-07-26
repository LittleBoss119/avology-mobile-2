# Kandidat Iterasi Polish

Dokumen ini menampung **ide/keresahan yang muncul saat mengerjakan iterasi lain tapi
sengaja DITUNDA** ke Iterasi Polish, supaya tidak melebarkan scope changeset yang sedang
berjalan dan tidak hilang dari ingatan.

**Cara pakai:** setiap kali muncul "ini sebenarnya perlu dirapikan, tapi bukan sekarang",
catat di sini beserta alasan penundaannya. Bukan backlog fitur baru — ini daftar
perapian/utang tampilan yang dikerjakan **per-layar saat Iterasi Polish**, bukan sekaligus
global.

Simpan di `docs/` agar ikut versi kode.

---

## Redesign Dashboard Owner (kandidat Iterasi Polish, JANGAN kerjakan sekarang)

- **Keresahan:** dashboard owner sekarang terasa seperti daftar notifikasi (tumpukan kartu
  "ada X perlu ditindak"), bukan ringkasan visual kondisi kebun yang mudah dicerna.
- **Inkonsistensi penamaan:** tab bernama "Beranda", tapi secara konsep ini "Dashboard".
- **Masalah teknis terpisah:** bagian atas layar ikut loading saat masuk/refresh dashboard
  (perlu diperiksa — kemungkinan layout/loading state).
- **Arah yang diinginkan:** dashboard sebagai ringkasan visual (kondisi kebun, tren, angka
  kunci) dengan hierarki yang jelas, bukan sekadar kartu angka bertumpuk.
- **Ditunda karena:** redesign menyeluruh = scope besar, di luar Iterasi B; ditangani saat
  Iterasi Polish bersama rombak layar lain, per-layar, bukan sekaligus global.

---

## Ganti bottom sheet ke @gorhom/bottom-sheet (kandidat Iterasi Polish)

- Sheet "Catat aktivitas" sekarang pakai Modal bawaan (fungsional, styling sudah
  dirapikan). Untuk kualitas gesture/animasi lebih baik, kandidat migrasi ke
  @gorhom/bottom-sheet — TAPI butuh react-native-gesture-handler + reanimated +
  konfigurasi root (GestureHandlerRootView, babel reanimated plugin). Ditunda karena
  menyentuh fondasi app & berisiko; dikerjakan saat tidak dikejar deadline.
