import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Icon, type IconName } from '../../src/components/icons';
import { BrandMark, ChipButton, ErrorBanner, PageIntro, Screen, TopAppBar } from '../../src/components/ui';
import { tokens } from '../../src/constants/theme';
import { useAuth } from '../../src/context/auth-context';

// Dua pilihan ini adalah PERCABANGAN PERAN, bukan aksi utama versus aksi
// sekunder. Versi lama memberi "Buat Kebun" tombol hijau solid dan "Gabung
// Kebun" tombol outline, sehingga pekerja yang tidak membaca menekan yang
// menonjol, membuat kebun sampah, lalu terjebak sebagai pemilik — dan aplikasi
// ini tidak punya fitur hapus kebun. Karena itu keduanya sekarang berbobot
// visual setara: baris polos, tanpa kartu, tanpa tombol berwarna.

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
    >
      <PageIntro title={`Halo, ${firstName}`} subtitle="Kamu belum terhubung ke kebun mana pun." />

      <ErrorBanner message={error?.message} />

      <View style={{ paddingTop: tokens.space.md }}>
        <ChoiceRow
          icon="plus"
          title="Buat kebun"
          subtitle="Kamu jadi pemilik"
          onPress={() => router.push('/create-farm')}
        />
        <View style={{ backgroundColor: tokens.color.line.hairline, height: 1 }} />
        <ChoiceRow
          icon="user"
          title="Gabung kebun"
          subtitle="Pakai kode dari pemilik"
          onPress={() => router.push('/join-farm')}
        />
      </View>
    </Screen>
  );
}

// Lokal di layar ini sesuai batasan Fase 3: ui.tsx tidak boleh disentuh.
// Penyatuannya dengan baris sejenis di layar lain adalah urusan Fase 6.
function ChoiceRow({
  icon,
  onPress,
  subtitle,
  title,
}: {
  icon: IconName;
  onPress: () => void;
  subtitle: string;
  title: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: 'center',
        flexDirection: 'row',
        gap: tokens.space.lg,
        opacity: pressed ? 0.6 : 1,
        paddingVertical: tokens.space.xl,
      })}
    >
      <View
        style={{
          alignItems: 'center',
          backgroundColor: tokens.color.brand.soft,
          borderCurve: 'continuous',
          borderRadius: tokens.radius.cardInner,
          height: 48,
          justifyContent: 'center',
          width: 48,
        }}
      >
        <Icon name={icon} size={24} color={tokens.color.brand.base} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          selectable={false}
          style={{
            color: tokens.color.text.primary,
            fontSize: tokens.type.heading.fontSize,
            fontWeight: tokens.type.heading.fontWeight,
            lineHeight: tokens.type.heading.lineHeight,
          }}
        >
          {title}
        </Text>
        <Text
          selectable={false}
          style={{
            color: tokens.color.text.secondary,
            fontSize: tokens.type.bodySmall.fontSize,
            lineHeight: tokens.type.bodySmall.lineHeight,
          }}
        >
          {subtitle}
        </Text>
      </View>
      <Icon name="chevron-right" size={20} color={tokens.color.text.tertiary} />
    </Pressable>
  );
}

function getFirstName(fullName?: string | null): string {
  const firstWord = fullName?.trim().split(/\s+/)[0];
  return firstWord && firstWord.length > 0 ? firstWord : 'Pengguna';
}
