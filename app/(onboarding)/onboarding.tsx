import { router } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import {
  BrandMark,
  Button,
  ChipButton,
  ErrorBanner,
  PageIntro,
  Screen,
  TopAppBar,
} from '../../src/components/ui';
import { useAuth } from '../../src/context/auth-context';

// BOBOT SETARA — DIPULIHKAN. BACA INI SEBELUM MEMBALIKNYA LAGI.
//
// Versi paling awal layar ini memberi "Buat Kebun" tombol hijau solid dan
// "Gabung Kebun" tombol outline. Akibatnya pekerja yang tidak membaca menekan
// yang paling menonjol, membuat kebun sampah, lalu terjebak sebagai pemilik.
// Versi sesudahnya menutup jalur itu dengan menyamakan bobot keduanya.
//
// Redesain sempat mengembalikan pasangan utama/sekunder itu. Keputusan tersebut
// DIBATALKAN setelah jalur pemulihannya diaudit, dan hasilnya: pemilik kebun
// kosong benar-benar tidak punya jalan keluar apa pun lewat aplikasi.
//   * leave_current_farm menyaring `role = 'worker'` (migrasi 051:266-277),
//     jadi pemilik yang memanggilnya ditolak dengan "Active worker membership
//     not found".
//   * Tidak ada RPC penghapus kebun. Tabel `farms` juga tidak punya policy
//     DELETE, dan grant-nya hanya select + update (migrasi 007:348).
//   * Tidak ada alih kepemilikan.
//   * farm_members_one_active_relation_idx (migrasi 036:150-152) memblokir
//     baris pending/active yang baru selama baris pemilik itu masih berdiri.
// Jadi satu ketukan keliru di layar ini mengunci akun itu untuk seterusnya —
// dan pesan yang diterimanya kemudian, "Keluar dari kebun itu dulu sebelum
// mengajukan gabung", menyuruh sesuatu yang tidak ada tombolnya.
//
// Karena itu kedua tombol memakai varian yang SAMA PERSIS. Tidak ada yang lebih
// menonjol, sehingga tidak ada yang bisa tertekan hanya karena ia menonjol.
//
// Pembeda kedua jalur ada di KATA-KATANYA, bukan di bentuknya: keduanya
// menjawab satu pertanyaan di judul ("Belum" versus "Sudah") lalu menyebut siapa
// yang memilihnya ("Saya pemilik kebun" versus "Saya punya kode kebun").
//
// Subjudul itu bukan hiasan dan bukan pembalikan keputusan di atas: ia melekat
// DI DALAM tombol lewat prop `subtitle` milik Button, jadi kedua tombol tetap
// berbentuk identik dan sama-sama membawa dua baris. Yang dulu ditolak adalah
// subjudul TERPISAH di luar tombol dan baris daftar berikon-berchevron, dan
// keduanya tetap tidak dikembalikan.

export default function OnboardingDecisionScreen() {
  const { error, signOut } = useAuth();
  const [signingOut, setSigningOut] = React.useState(false);
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
      return;
    }

    setSigningOut(false);
    router.replace('/get-started');
  }

  return (
    <Screen
      header={
        // Slot judul diisi baris merek — layar ini titik masuk pertama sesudah
        // akun dibuat, dan app bar tanpa judul maupun logo terbaca seperti layar
        // yang belum jadi. Di kanan, chip BERLABEL menggantikan ikon profil
        // telanjang: "Profil" bisa dibaca, sedangkan ikon orang harus ditebak.
        //
        // flexShrink 0 pada chip: kalau ruangnya sempit, baris merek di slot
        // judul yang mengalah — nama aplikasi masih terbaca dari logonya,
        // sedangkan chip yang gepeng kehilangan labelnya sama sekali.
        <TopAppBar
          variant="main"
          titleContent={<BrandMark inline />}
          right={
            <View style={{ flexShrink: 0 }}>
              <ChipButton
                active={false}
                icon="user"
                label="Profil"
                onPress={() => router.push('/profile')}
              />
            </View>
          }
        />
      }
      // Jarak antar kedua tombol TIDAK disetel di sini: slot footer milik Screen
      // sudah membungkus anaknya dengan gap spacing.md (ui.tsx ~:333). Itu jarak
      // yang sama dengan pasangan tombol bertumpuk di get-started.tsx dan di
      // layar status akses, jadi tidak ada angka baru yang dikarang di layar ini.
      footer={
        <>
          {/* Kedua tombol WAJIB identik variannya — alasannya di puncak file,
              dan itu bukan soal selera. Keduanya memakai varian dan emphasis
              yang sama persis, sehingga tidak ada yang bisa tertekan hanya
              karena ia lebih menonjol.

              Label kini MENJAWAB pertanyaan di judul ("Belum" / "Sudah"), dan
              subjudulnya menyebut SIAPA yang memilih jalur itu. Dua penanda
              untuk satu pilihan yang tidak bisa dibatalkan.

              Koma di "Belum, buat kebun" melanggar aturan bahasa §6 yang
              melarang koma pada tombol. Dipakai apa adanya karena Langkah 6
              menuliskannya begitu secara eksplisit, dan komanya memang bekerja:
              ia yang menyambungkan jawaban ke tindakannya. */}
          <Button
            title="Belum, buat kebun"
            subtitle="Saya pemilik kebun"
            variant="secondary"
            emphasis="strong"
            onPress={() => router.push('/create-farm')}
          />
          <Button
            title="Sudah, gabung kebun"
            subtitle="Saya punya kode kebun"
            variant="secondary"
            emphasis="strong"
            onPress={() => router.push('/join-farm')}
          />
          {/* Jalan keluar WAJIB. Tanpa ini layar ini mengunci: dua tombol di
              atas adalah satu-satunya yang bisa ditekan, dan keduanya membuat
              relasi kebun yang tidak bisa dibatalkan sendiri oleh pemilik
              (lihat catatan panjang di puncak berkas). Chip "Profil" di app bar
              memang memuat logout, tapi ia harus ditemukan dulu — dan tidak ada
              yang menduga tombol keluar bersembunyi di balik ikon profil.

              Baris merusak, bukan tombol berblok: keluar dari akun bukan
              jawaban atas pertanyaan di judul. */}
          <Button
            title="Keluar dari akun"
            variant="danger"
            loading={signingOut}
            loadingTitle="Keluar…"
            onPress={handleSignOut}
          />
        </>
      }
    >
      {/* Naik ke anak pertama, di atas blok sapaan. Dulu ia duduk di antara
          sapaan dan daftar pilihan; sekarang blok sapaan memakan seluruh ruang
          kosong, jadi spanduk galat yang ikut terpusat akan melayang di tengah
          layar jauh dari apa pun. Di puncak layar ia mengikuti kebiasaan setiap
          layar lain di app ini. */}
      <ErrorBanner message={signOutError ?? error?.message} />

      {/* Blok sapaan duduk di tengah ruang antara header dan tombol.
          flexGrow: 1, JANGAN flex: 1 — `flex: 1` berarti flexBasis 0, sehingga
          pembungkus ini tidak menyumbang tinggi apa pun dan konten tidak pernah
          bisa melampaui viewport, jadi ScrollView tidak punya apa pun untuk
          digulung. Alasan lengkapnya di get-started.tsx dan ui.tsx ~:323-331.
          Relevan di sini karena pengguna sasaran termasuk orang yang membesarkan
          font sistem.

          TANPA ilustrasi, ikon besar, atau logo: BrandMark sudah berdiri di app
          bar, dan mengulangnya di badan layar berarti merek dua kali di satu
          layar. */}
      <View style={{ flexGrow: 1, justifyContent: 'center' }}>
        {/* SATU PERTANYAAN sebagai judul, menggantikan sapaan "Halo, {nama}" +
            "Mulai dari mana?".
            Sapaan itu ramah tapi tidak menolong: ia tidak memberi tahu apa yang
            sedang ditanyakan, sehingga dua tombol di bawahnya harus dibaca
            sebagai teka-teki. Pertanyaan yang lugas membuat kedua tombol jadi
            JAWABAN — dan sebuah jawaban jauh lebih mudah dipilih daripada dua
            perintah yang berdiri sendiri.

            Nama depan tidak lagi dipakai di sini; getFirstName di bawah ikut
            dicabut karena ia tidak punya pemanggil lain. */}
        <PageIntro align="center" title="Kebunnya sudah ada di Avology?" />
      </View>
    </Screen>
  );
}
