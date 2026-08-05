import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { Icon, type IconName } from '../../src/components/icons';
import { BrandMark, Button, PageIntro, Screen } from '../../src/components/ui';
import { tokens } from '../../src/constants/theme';

// Ikon sengaja diambil dari set yang sama dengan navigasi tab (tree / list-check /
// file-text), supaya janji di layar depan memakai lambang yang persis sama dengan
// tempat tujuannya di dalam app.
const VALUE_PROPS: Array<{ icon: IconName; label: string }> = [
  { icon: 'tree', label: 'Pantau kondisi tiap pohon' },
  { icon: 'list-check', label: 'Atur tugas pekerja lapangan' },
  { icon: 'file-text', label: 'Laporan lapangan terpusat' },
];

export default function GetStartedScreen() {
  return (
    <Screen
      applyTopInset
      footer={
        <>
          <Button title="Buat akun baru" onPress={() => router.push('/register')} />
          <Button title="Masuk" variant="secondary" onPress={() => router.push('/login')} />
        </>
      }
    >
      {/* Satu-satunya anak Screen: flex:1 memakan seluruh ruang di atas footer dan
          justifyContent mendudukkan isinya sebagai SATU blok di tengah ruang itu.
          Hanya sumbu vertikal yang di-center; horizontal tetap rata kiri karena
          alignItems dibiarkan 'stretch' bawaan. gap xl (20) memisahkan brand,
          judul, dan daftar sebagai sub-grup — lebih longgar dari 12 antar baris
          daftar, jadi keduanya masih terbaca sebagai kelompok yang berbeda. */}
      <View style={{ flex: 1, gap: tokens.space.xl, justifyContent: 'center' }}>
        {/* Judul dipegang PageIntro, jadi BrandMark hanya menyumbang kotak logo. */}
        <BrandMark showWordmark={false} align="left" />
        <PageIntro title="Avology" subtitle="Kelola kebun alpukat dengan lebih rapi." />
        <View style={{ gap: tokens.space.md }}>
          {VALUE_PROPS.map((valueProp) => (
            <View
              key={valueProp.icon}
              style={{ alignItems: 'center', flexDirection: 'row', gap: tokens.space.md }}
            >
              <Icon name={valueProp.icon} size={tokens.icon.md} color={tokens.color.brand.base} />
              <Text
                selectable
                style={{
                  color: tokens.color.text.primary,
                  flex: 1,
                  fontSize: tokens.type.body.fontSize,
                  lineHeight: tokens.type.body.lineHeight,
                }}
              >
                {valueProp.label}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </Screen>
  );
}
