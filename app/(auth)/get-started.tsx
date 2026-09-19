import { router } from 'expo-router';
import { View } from 'react-native';

import { BrandMark, Button, Screen } from '../../src/components/ui';
import { tokens } from '../../src/constants/theme';

export default function GetStartedScreen() {
  return (
    <Screen
      applyTopInset
      footer={
        <>
          {/* Masuk UTAMA, Daftar sekunder — dan urutannya dibalik dari
              sebelumnya, ketika "Buat akun baru" berdiri di atas.

              Alasannya bukan selera: layar ini dilihat berkali-kali oleh orang
              yang SUDAH punya akun dan hanya sekali oleh orang yang belum.
              Tombol utama milik tindakan yang paling sering dilakukan.
              Mendaftar tidak jadi lebih sulit — ia tetap tombol penuh tepat di
              bawahnya, bukan tautan kecil. */}
          <Button title="Masuk" onPress={() => router.push('/login')} />
          <Button title="Daftar" variant="secondary" onPress={() => router.push('/register')} />
        </>
      }
    >
      {/* Satu anak tunggal: flexGrow memakan seluruh ruang di atas bar aksi dan
          justifyContent mendudukkan isinya sebagai SATU blok di tengah ruang itu.

          flexGrow: 1, JANGAN flex: 1 — sama seperti login.tsx, dan alasan
          lengkapnya ada di sana serta di ui.tsx. Layar ini tidak punya TextInput
          jadi keyboardOverlap selalu nol, tapi jebakannya tetap bisa menyala
          lewat jalan lain: pada layar pendek dengan skala font sistem Android
          yang dibesarkan, logo 76 + kata "Avology" 46 + subjudul bisa melampaui
          ruang tersedia. Dengan flex: 1 anak akan menyusut di bawah tinggi
          isinya dan ScrollView tetap tidak menggulung, sehingga tombol di bar
          aksi tidak terjangkau. Pengguna sasaran justru termasuk orang yang
          membesarkan font sistem.

          Daftar tiga fitur yang dulu jadi anak ketiga di sini SUDAH DICABUT —
          keputusan sadar, layar depan dibuat seminimal mungkin. */}
      <View style={{ flexGrow: 1, gap: tokens.space.xl, justifyContent: 'center' }}>
        {/* SATU komponen untuk seluruh blok merek, bukan BrandMark ditumpuk
            PageIntro seperti sebelumnya. Dulu logonya datang dari BrandMark dan
            kata "Avology" dari PageIntro — dua komponen yang tidak tahu satu
            sama lain memikul satu tanda merek, sehingga jarak antara logo dan
            namanya ditentukan gap layar ini, bukan oleh merek itu sendiri.

            Ini satu-satunya layar selain splash yang menampilkan hijau, dan
            hijaunya ada DI DALAM BrandMark. Jangan membawa brandGreen ke layar
            mana pun yang lain. */}
        <BrandMark align="center" tagline="Kelola kebun alpukat dengan lebih rapi." />
      </View>
    </Screen>
  );
}
