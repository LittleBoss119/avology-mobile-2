import { router } from 'expo-router';
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
// Pembeda kedua jalur sekarang ada di LABELNYA, bukan di bentuknya: "Buat kebun
// baru" versus "Gabung pakai kode". Masing-masing menyebut syarat jalurnya —
// kata "kode" dikenali orang yang memang dikirimi kode oleh pemiliknya. Baris
// daftar, ikon kotak, chevron, dan subjudul terpisah TIDAK dikembalikan; label
// itu sendiri yang memikul pembedaannya.

export default function OnboardingDecisionScreen() {
  const { error, profile } = useAuth();
  const firstName = getFirstName(profile?.fullName);

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
              dan itu bukan soal selera.

              emphasis="strong" mengikuti get-started.tsx dengan alasan yang sama
              persis: latar `secondary` (surface) di atas kanvas berkontras
              ~1,03:1, jadi batas tombol datang dari bordernya saja — dan border
              bawaannya terlalu pucat untuk layar yang kena silau di kebun. Di
              sini ia dipakai DUA KALI, sehingga keduanya sama-sama terbaca
              sebagai tombol tanpa satu pun yang lebih mengundang. */}
          <Button
            title="Buat kebun baru"
            variant="secondary"
            emphasis="strong"
            onPress={() => router.push('/create-farm')}
          />
          <Button
            title="Gabung pakai kode"
            variant="secondary"
            emphasis="strong"
            onPress={() => router.push('/join-farm')}
          />
        </>
      }
    >
      {/* Naik ke anak pertama, di atas blok sapaan. Dulu ia duduk di antara
          sapaan dan daftar pilihan; sekarang blok sapaan memakan seluruh ruang
          kosong, jadi spanduk galat yang ikut terpusat akan melayang di tengah
          layar jauh dari apa pun. Di puncak layar ia mengikuti kebiasaan setiap
          layar lain di app ini. */}
      <ErrorBanner message={error?.message} />

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
        <PageIntro align="center" title={`Halo, ${firstName}`} subtitle="Mulai dari mana?" />
      </View>
    </Screen>
  );
}

function getFirstName(fullName?: string | null): string {
  const firstWord = fullName?.trim().split(/\s+/)[0];
  return firstWord && firstWord.length > 0 ? firstWord : 'Pengguna';
}
