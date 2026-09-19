import { router } from 'expo-router';
import React from 'react';

import { Button, ErrorBanner, PageIntro, Screen } from '../../src/components/ui';
import { ConfirmDialog } from '../../src/components/bottom-sheet';
import { useAuth } from '../../src/context/auth-context';

// BOBOT TIDAK LAGI SETARA — DIUBAH SADAR SETELAH VERIFIKASI PERANGKAT.
// BACA SELURUHNYA SEBELUM MENYENTUH KEDUA TOMBOL DI BAWAH.
//
// BAHAYA YANG MASIH NYATA, dan ia tidak hilang oleh perubahan ini: pemilik
// kebun kosong TIDAK punya jalan keluar apa pun lewat aplikasi.
//   * leave_current_farm menyaring `role = 'worker'` (migrasi 051:266-277),
//     jadi pemilik yang memanggilnya ditolak dengan "Active worker membership
//     not found".
//   * Tidak ada RPC penghapus kebun. Tabel `farms` juga tidak punya policy
//     DELETE, dan grant-nya hanya select + update (migrasi 007:348).
//   * Tidak ada alih kepemilikan.
//   * farm_members_one_active_relation_idx (migrasi 036:150-152) memblokir
//     baris pending/active yang baru selama baris pemilik itu masih berdiri.
// Jadi satu ketukan keliru di layar ini mengunci akun itu untuk seterusnya.
//
// RIWAYATNYA. Versi paling awal memberi "Buat Kebun" tombol hijau solid dan
// "Gabung Kebun" tombol outline; pekerja yang tidak membaca menekan yang paling
// menonjol, membuat kebun sampah, lalu terjebak. Versi sesudahnya menutup jalur
// itu dengan menyamakan bobot keduanya, dan aturan itu bertahan lama.
//
// KENAPA DIUBAH SEKARANG. Dua tombol identik ternyata memindahkan bebannya,
// bukan menghapusnya: pengguna sasaran aplikasi ini termasuk orang berusia
// lanjut, dan dua tombol yang persis sama menuntut mereka MEMBACA keduanya
// sampai tuntas sebelum bisa bergerak. Yang terjadi di perangkat bukan
// pertimbangan yang cermat, melainkan keraguan.
//
// Yang membuat hierarki aman sekarang — dan tidak aman dulu — ada tiga:
//   1. Labelnya menjawab pertanyaan di judul ("Belum" versus "Sudah"), jadi
//      yang dipilih adalah jawaban, bukan perintah yang berdiri sendiri.
//   2. Setiap tombol membawa subjudul yang menyebut SIAPA yang memilihnya
//      ("Saya pemilik kebun" versus "Saya punya kode kebun"). Pekerja yang
//      salah tekan harus mengabaikan kalimat yang menyebut dirinya bukan itu.
//   3. Yang dijadikan utama adalah "buat kebun" — jalur yang bisa diselesaikan
//      TANPA bekal apa pun. "Gabung kebun" butuh kode yang mungkin belum
//      dipegang, dan menjadikannya tombol paling terang berarti mengundang
//      orang ke jalan buntu.
//
// Yang TETAP tidak boleh dikembalikan: subjudul terpisah di luar tombol, dan
// baris daftar berikon-berchevron. Subjudul di sini melekat DI DALAM tombol
// lewat prop `subtitle` milik Button.

export default function OnboardingDecisionScreen() {
  const { error, signOut } = useAuth();
  const [signingOut, setSigningOut] = React.useState(false);
  const [confirmSignOut, setConfirmSignOut] = React.useState(false);
  const [signOutError, setSignOutError] = React.useState<string | null>(null);

  // Mengikuti pola di profile-screen.tsx: signOut mengembalikan galat alih-alih
  // melempar, dan navigasinya eksplisit ke '/get-started' karena sesudah logout
  // tidak ada guard yang bisa menghitung tujuan dari relasi yang sudah hilang.
  async function handleSignOut() {
    setSigningOut(true);
    setSignOutError(null);

    const result = await signOut();

    if (result) {
      setSignOutError(result.message);
      setSigningOut(false);
      setConfirmSignOut(false);
      return;
    }

    setSigningOut(false);
    setConfirmSignOut(false);
    router.replace('/get-started');
  }

  return (
    <Screen
      // TANPA header sama sekali — baris merek dan chip "Profil" dicabut.
      //
      // Tiga alasan, dan ketiganya berdiri sendiri. Spek melarang aksi di
      // header. Chip "Profil" berlatar terang menambah satu bidang lagi ke
      // layar yang seharusnya cuma satu pertanyaan dan dua jawaban. Dan
      // pengguna di layar ini BELUM punya kebun, jadi hampir tidak ada yang
      // bisa diatur di Profil.
      //
      // Konsekuensi yang diterima sadar: selama belum masuk kebun, tidak ada
      // jalan ke Edit profil maupun Ubah password. Sempit, dan bisa ditinjau
      // ulang — tapi jalan keluar yang benar-benar dibutuhkan di sini adalah
      // "Keluar dari akun", dan itu sekarang berdiri sendiri di bar aksi.
      //
      // applyTopInset WAJIB menyala begitu header hilang: tanpa header, tidak
      // ada lagi yang menerapkan safe-area atas, dan judul akan menabrak
      // status bar.
      applyTopInset
      footer={
        <>
          {/* URUTAN BOBOT INI PUNYA ALASAN — baca catatan di puncak berkas
              sebelum menukarnya. Utama untuk "buat kebun" karena ia jalur yang
              bisa diselesaikan tanpa bekal apa pun; sekunder untuk "gabung
              kebun" karena ia butuh kode yang mungkin belum dipegang.

              Koma di "Belum, buat kebun" melanggar aturan bahasa §6 yang
              melarang koma pada tombol. Dipakai apa adanya karena Langkah 6
              menuliskannya begitu secara eksplisit, dan komanya memang bekerja:
              ia yang menyambungkan jawaban ke tindakannya. */}
          <Button
            title="Belum, buat kebun"
            subtitle="Saya pemilik kebun"
            onPress={() => router.push('/create-farm')}
          />
          <Button
            title="Sudah, gabung kebun"
            subtitle="Saya punya kode kebun"
            variant="secondary"
            emphasis="strong"
            onPress={() => router.push('/join-farm')}
          />
          {/* Jalan keluar WAJIB, dan sejak baris merek dicabut ia SATU-SATUNYA.
              Tanpa ini layar ini mengunci: dua tombol di atas adalah satu-
              satunya yang bisa ditekan, dan keduanya membuat relasi kebun yang
              tidak bisa dibatalkan sendiri oleh pemilik (lihat catatan panjang
              di puncak berkas).

              Baris teks NETRAL, bukan merusak: keluar dari akun tidak menghapus
              apa pun. Ia juga bukan jawaban atas pertanyaan di judul, jadi ia
              tidak berbentuk tombol berblok seperti dua tombol di atasnya. */}
          <Button
            title="Keluar dari akun"
            variant="neutral"
            loading={signingOut}
            loadingTitle="Keluar…"
            onPress={() => setConfirmSignOut(true)}
          />
        </>
      }
    >
      <ErrorBanner message={signOutError ?? error?.message} />

      {/* ISI MENEMPEL KE ATAS, tidak lagi terpusat vertikal.
          Pembungkus flexGrow:1 ber-justifyContent:'center' yang dulu ada di
          sini DICABUT. Ia mendudukkan judul di tengah ruang kosong, dan
          akibatnya pertanyaan melayang jauh dari jawaban-jawabannya di bar
          aksi — dua hal yang seharusnya dibaca berurutan dipisahkan ruang
          kosong sebesar setengah layar.

          Sekarang judul duduk di puncak seperti judul layar lain, dan ruang
          kosongnya jatuh di antara judul dan bar aksi. Tidak ada lagi jebakan
          flex:1 yang perlu dijaga di sini, karena tidak ada lagi pembungkus
          yang tumbuh. */}
      {/* SATU PERTANYAAN sebagai judul, menggantikan sapaan "Halo, {nama}" +
          "Mulai dari mana?".
          Sapaan itu ramah tapi tidak menolong: ia tidak memberi tahu apa yang
          sedang ditanyakan, sehingga dua tombol di bawahnya harus dibaca
          sebagai teka-teki. Pertanyaan yang lugas membuat kedua tombol jadi
          JAWABAN — dan sebuah jawaban jauh lebih mudah dipilih daripada dua
          perintah yang berdiri sendiri.

          RATA KIRI, bukan rata tengah. Sejak baris merek dicabut, pertanyaan
          ini adalah elemen paling atas layar — jadi ia judul layar, dan judul
          layar di aplikasi ini rata kiri. */}
      <PageIntro align="left" title="Kebunnya sudah ada di Avology?" />

      <ConfirmDialog
        cancelLabel="Batal"
        confirmLabel="Keluar dari akun"
        loading={signingOut}
        message="Kamu perlu masuk lagi untuk membuka aplikasi ini."
        onCancel={() => {
          if (!signingOut) {
            setConfirmSignOut(false);
          }
        }}
        onConfirm={() => void handleSignOut()}
        title="Keluar dari akun?"
        tone="danger"
        visible={confirmSignOut}
      />
    </Screen>
  );
}
