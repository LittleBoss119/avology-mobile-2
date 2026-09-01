import { router } from 'expo-router';
import { View } from 'react-native';

import { BrandMark, Button, PageIntro, Screen } from '../../src/components/ui';
import { tokens } from '../../src/constants/theme';

export default function GetStartedScreen() {
  return (
    <Screen
      applyTopInset
      footer={
        <>
          <Button title="Buat akun baru" onPress={() => router.push('/register')} />
          {/* emphasis="strong" HANYA di sini. Latar secondary (#FFFFFF) di atas
              kanvas (#F7FAF3) berkontras ~1,03:1, jadi batas tombol datang dari
              bordernya saja — dan border bawaannya terlalu pucat untuk layar yang
              kena silau di kebun. */}
          <Button
            title="Masuk"
            variant="secondary"
            emphasis="strong"
            onPress={() => router.push('/login')}
          />
        </>
      }
    >
      {/* Satu-satunya anak Screen: flexGrow memakan seluruh ruang di atas footer dan
          justifyContent mendudukkan isinya sebagai SATU blok di tengah ruang itu.
          alignItems dibiarkan 'stretch' bawaan; pemusatan horizontal dikerjakan
          masing-masing anak (BrandMark lewat align, PageIntro lewat align), bukan
          dipaksakan dari sini — dengan begitu lebar keduanya tetap penuh dan hanya
          isinya yang terpusat.

          flexGrow: 1, JANGAN flex: 1 — sama seperti login.tsx, dan alasan lengkapnya
          ada di sana serta di ui.tsx ~:323-331. Layar ini tidak punya TextInput jadi
          keyboardOverlap selalu nol, tapi jebakannya tetap bisa menyala lewat jalan
          lain: pada layar pendek dengan skala font sistem Android yang dibesarkan,
          logo + judul + subjudul bisa melampaui ruang tersedia. Dengan flex: 1 anak
          akan menyusut di bawah tinggi isinya dan ScrollView tetap tidak menggulung,
          sehingga tombol di footer tidak terjangkau. Pengguna sasaran justru
          termasuk orang yang membesarkan font sistem.

          gap xl (20) memisahkan kotak logo dari blok judul. Daftar tiga fitur yang
          dulu jadi anak ketiga di sini SUDAH DICABUT — keputusan sadar, layar depan
          dibuat seminimal mungkin. */}
      <View style={{ flexGrow: 1, gap: tokens.space.xl, justifyContent: 'center' }}>
        {/* Judul dipegang PageIntro, jadi BrandMark hanya menyumbang kotak logo. */}
        <BrandMark showWordmark={false} align="center" />
        <PageIntro
          align="center"
          title="Avology"
          subtitle="Kelola kebun alpukat dengan lebih rapi."
        />
      </View>
    </Screen>
  );
}
