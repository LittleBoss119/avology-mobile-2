import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';

import { ConfirmDialog } from '../../../src/components/bottom-sheet';
import { MemberRow } from '../../../src/components/member-row';
import { useSnackbar } from '../../../src/components/snackbar';
import { Button, Card, ErrorBanner, LoadingState, Screen, TopAppBar } from '../../../src/components/ui';
import { colors, spacing, typography } from '../../../src/constants/theme';
import { useAuth } from '../../../src/context/auth-context';
import { getFarmDetail } from '../../../src/services/farmService';
import { getFarmActorDisplayProfiles, leaveCurrentFarm } from '../../../src/services/memberService';
import type { Farm, FarmActorDisplayProfile } from '../../../src/types/domain';

export default function WorkerFarmHubScreen() {
  const { currentFarm, refresh } = useAuth();
  const showSnackbar = useSnackbar();
  const [farm, setFarm] = React.useState<Farm | null>(currentFarm?.farm ?? null);
  const [actors, setActors] = React.useState<FarmActorDisplayProfile[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [confirmLeave, setConfirmLeave] = React.useState(false);

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

  async function handleLeaveFarm() {
    if (!farmId) {
      return;
    }

    setBusy(true);
    const result = await leaveCurrentFarm({ farmId });
    setBusy(false);

    if (result.error) {
      setConfirmLeave(false);
      showSnackbar(result.error.message);
      return;
    }

    setConfirmLeave(false);
    await refresh();
    router.replace('/removed-access');
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
    <Screen
      header={header}
      // stickyFooter, BUKAN tombol yang menempel di bawah daftar. Aksi ini
      // MENCABUT AKSES pekerja atas kebunnya sendiri, dan tombol yang ikut
      // menggulung bisa berada persis di bawah jempol saat daftar anggota
      // berhenti bergulir. Di sini ia selalu di tempat yang sama, di atas
      // navigasi bawah, dan tidak pernah lewat di bawah jari yang sedang
      // menggulung.
      //
      // Ini juga menjawab kekhawatiran "layarnya bisa lebih panjang dari satu
      // layar penuh": stickyFooter dipatok ke tepi bawah, jadi panjang daftar
      // anggota tidak mengubah letaknya sama sekali. Screen sendiri yang
      // menyediakan ruang bawah sebesar tinggi footer ini (stickyFooterReserve
      // di ui.tsx), jadi baris terakhir daftar tidak pernah tertutup.
      stickyFooter={
        <Button title="Keluar kebun" variant="danger" onPress={() => setConfirmLeave(true)} />
      }
    >
      <ErrorBanner message={error} />

      {/* Kartu identitas kebun — nama, lokasi, luas — PINDAH ke Beranda, tempat
          ia jadi judul halaman. Yang tersisa di sini orangnya: siapa saja yang
          ada di kebun ini, dan jalan keluar darinya. */}

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

      {/* Tombol "Keluar kebun" PINDAH ke stickyFooter Screen di atas. Ia dulu
          berdiri di sini sebagai teks merah yang bisa diketuk — tanpa bentuk
          tombol, dan ikut menggulung bersama daftar anggota. */}

      <ConfirmDialog
        cancelLabel="Batal"
        confirmLabel="Keluar"
        loading={busy}
        // DUA kata diganti, bukan kalimatnya ditulis ulang.
        //
        // "kode bergabung" -> "kode kebun": benda yang sama dinamai "kode kebun"
        // di delapan tempat lain, termasuk kartu yang memajangnya di layar
        // pemilik dan layar /removed-access yang dilihat pekerja ini PERSIS
        // sesudah keluar. Berkas inilah satu-satunya yang menyebutnya lain.
        //
        // "masuk lagi" -> "bergabung lagi": "masuk" sudah dipakai dialog Keluar
        // akun untuk arti LOGIN. Dua dialog keluar yang berdampingan tidak boleh
        // memakai satu kata untuk dua hal yang berbeda.
        message="Kamu perlu kode kebun untuk bergabung lagi."
        onCancel={() => {
          if (!busy) {
            setConfirmLeave(false);
          }
        }}
        onConfirm={() => void handleLeaveFarm()}
        title="Keluar dari kebun?"
        tone="danger"
        visible={confirmLeave}
      />
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

