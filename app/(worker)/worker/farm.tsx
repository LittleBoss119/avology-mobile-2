import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';

import { MemberRow } from '../../../src/components/member-row';
import { Button, Card, ErrorBanner, LoadingState, Screen, TopAppBar } from '../../../src/components/ui';
import { colors, spacing, typography } from '../../../src/constants/theme';
import { useAuth } from '../../../src/context/auth-context';
import { getFarmDetail } from '../../../src/services/farmService';
import { getFarmActorDisplayProfiles } from '../../../src/services/memberService';
import type { Farm, FarmActorDisplayProfile } from '../../../src/types/domain';

// "Keluar dari kebun" TIDAK ADA LAGI DI LAYAR INI (batch 4a).
//
// Ia pindah ke tab Profil pekerja, berdampingan dengan "Keluar dari akun".
// Adendum sebelumnya menaruhnya di sini; briefing menaruhnya di Profil, dan
// briefing yang berlaku. Alasannya bukan selera: dua jalan keluar yang
// berbeda-akibatnya — satu mengakhiri sesi, satu mengakhiri keanggotaan —
// harus bisa dibandingkan berdampingan sebelum ditekan. Terpisah di dua layar,
// orang menekan yang pertama ditemukannya.
//
// Konsekuensinya layar ini murni BACA. Tidak ada lagi aksi tulis, tidak ada
// ConfirmDialog, tidak ada snackbar, dan tidak ada stickyFooter.
export default function WorkerFarmHubScreen() {
  const { currentFarm } = useAuth();
  const [farm, setFarm] = React.useState<Farm | null>(currentFarm?.farm ?? null);
  const [actors, setActors] = React.useState<FarmActorDisplayProfile[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const farmId = currentFarm?.farmId;
  const currentUserId = currentFarm?.userId;

  const activeMembers = actors
    .filter((actor) => actor.status === 'active')
    .sort((first, second) => roleOrder(first.role) - roleOrder(second.role));

  const load = React.useCallback(async () => {
    if (!farmId) {
      setError('Data kebun aktif tidak ditemukan.');
      setFarm(null);
      setActors([]);
      return;
    }

    setError(null);

    const [farmResult, actorsResult] = await Promise.all([
      getFarmDetail(farmId),
      getFarmActorDisplayProfiles(farmId),
    ]);

    if (farmResult.error) {
      setError(farmResult.error.message);
      setFarm(null);
      setActors([]);
      return;
    }

    setFarm(farmResult.data);

    if (actorsResult.error) {
      setError(actorsResult.error.message);
      setActors([]);
      return;
    }

    setActors(actorsResult.data);
  }, [farmId]);

  useFocusEffect(
    React.useCallback(() => {
      setLoading(true);
      load().finally(() => setLoading(false));
    }, [load])
  );

  function handleRetry() {
    setLoading(true);
    load().finally(() => setLoading(false));
  }

  // TopAppBar ber-onBack, BUKAN MainTabHeader. Layar ini bukan tab root: ia
  // dibuka lewat push dari baris "Anggota" di Beranda, dan MainTabHeader tidak
  // pernah merender tombol kembali (TopAppBar hanya merendernya kalau `onBack`
  // dikirim, dan MainTabHeader tidak mengirimnya). Sebelum ini layar tersebut
  // sama sekali tidak punya afordans mundur di layarnya sendiri.
  //
  // Judulnya "Anggota", sama dengan label baris di Beranda yang mengantar ke
  // sini.
  const header = <TopAppBar title="Anggota" onBack={() => router.back()} />;

  if (loading) {
    return <LoadingState message="Memuat kebun..." />;
  }

  if (!farm) {
    return (
      <Screen header={header}>
        <ErrorBanner message={error} />
        <Card>
          <Text style={{ color: colors.textMuted, lineHeight: 21 }}>Data kebun gagal dimuat.</Text>
          <Button title="Coba lagi" onPress={handleRetry} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen header={header}>
      <ErrorBanner message={error} />

      {/* Kartu identitas kebun — nama, lokasi, luas — sudah lama pindah ke
          Beranda, lalu ke tab Profil. Yang tersisa di sini orangnya saja:
          siapa yang ada di kebun ini. Jalan keluarnya pindah ke Profil di
          batch 4a. */}

      <SectionLabel
        title="Anggota"
        trailing={<Text style={{ color: colors.textMuted, fontSize: 14 }}>{activeMembers.length} orang</Text>}
      />
      <Card>
        <View>
          {activeMembers.map((actor, index) => (
            <View
              key={actor.userId}
              style={index > 0 ? { borderTopColor: colors.divider, borderTopWidth: 1 } : undefined}
            >
              <MemberRow
                name={actor.fullName}
                meta={buildMemberMeta(actor, currentUserId)}
                tone={actor.role === 'owner' ? 'accent' : 'neutral'}
              />
            </View>
          ))}
        </View>
      </Card>
    </Screen>
  );
}

function SectionLabel({ title, trailing }: { title: string; trailing?: React.ReactNode }) {
  return (
    <View
      style={{
        alignItems: 'center',
        flexDirection: 'row',
        gap: spacing.md,
        justifyContent: 'space-between',
        paddingTop: spacing.xs,
      }}
    >
      <Text
        style={{
          color: colors.text,
          fontSize: typography.h3.fontSize,
          fontWeight: '700',
          lineHeight: typography.h3.lineHeight,
        }}
      >
        {title}
      </Text>
      {trailing}
    </View>
  );
}

function roleOrder(role: FarmActorDisplayProfile['role']): number {
  return role === 'owner' ? 0 : 1;
}

function buildMemberMeta(actor: FarmActorDisplayProfile, currentUserId?: string): string {
  const roleLabel = actor.role === 'owner' ? 'Pemilik' : 'Pekerja';
  return actor.userId === currentUserId ? `${roleLabel} · kamu` : roleLabel;
}

