import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { MemberRow } from '../../../src/components/member-row';
import {
  EmptyState,
  ErrorBanner,
  LoadingState,
  Screen,
  SectionLabel,
  TopAppBar,
} from '../../../src/components/ui';
import { tokens } from '../../../src/constants/theme';
import { useAuth } from '../../../src/context/auth-context';
import { getFarmActorDisplayProfiles } from '../../../src/services/memberService';
import type { FarmActorDisplayProfile } from '../../../src/types/domain';

// VERSI PEKERJA DARI LAYAR ANGGOTA — adendum §4.5.
//
// Spek §41 hanya merancang versi pemilik. Versi pekerja adalah DAFTAR ANGGOTA
// AKTIF TANPA AKSI APA PUN: tidak ada tombol setujui/tolak, tidak ada baris yang
// bisa ditekan, tidak ada dialog. Pekerja tidak boleh mengubah keanggotaan siapa
// pun, termasuk keanggotaannya sendiri dari layar ini.
//
// "Keluar dari kebun" TIDAK ADA DI SINI, dan tidak boleh dikembalikan (batch
// 4a). Ia pindah ke tab Profil pekerja, berdampingan dengan "Keluar dari akun".
// Alasannya bukan selera: dua jalan keluar yang berbeda akibatnya — satu
// mengakhiri sesi, satu mengakhiri keanggotaan — harus bisa dibandingkan
// berdampingan sebelum ditekan. Terpisah di dua layar, orang menekan yang
// pertama ditemukannya.
//
// getFarmDetail DICABUT di batch 7b. Ia dipanggil hanya untuk mengisi state
// `farm` yang satu-satunya gunanya adalah memutuskan merender daftar atau kartu
// "gagal dimuat" — pertanyaan yang sudah dijawab getFarmActorDisplayProfiles
// sendiri. Satu permintaan jaringan untuk sebuah if.
export default function WorkerFarmHubScreen() {
  const { currentFarm } = useAuth();
  const [actors, setActors] = React.useState<FarmActorDisplayProfile[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const farmId = currentFarm?.farmId;
  const currentUserId = currentFarm?.userId;

  // Pemilik lebih dulu, lalu pekerja. Urutan itu bukan hierarki yang dipajang:
  // pemilik satu-satunya orang di daftar ini yang perannya menentukan apa yang
  // bisa dimintakan kepadanya, jadi ia yang paling sering dicari.
  const activeMembers = actors
    .filter((actor) => actor.status === 'active')
    .sort((first, second) => roleOrder(first.role) - roleOrder(second.role));

  const load = React.useCallback(async () => {
    if (!farmId) {
      setError('Data kebun aktif tidak ditemukan.');
      setActors([]);
      return;
    }

    setError(null);

    const result = await getFarmActorDisplayProfiles(farmId);

    if (result.error) {
      setError(result.error.message);
      setActors([]);
      return;
    }

    setActors(result.data);
  }, [farmId]);

  useFocusEffect(
    React.useCallback(() => {
      setLoading(true);
      load().finally(() => setLoading(false));
    }, [load])
  );

  // TopAppBar ber-onBack, BUKAN MainTabHeader. Layar ini bukan tab root: ia
  // dibuka lewat push dari baris "Anggota" di seksi KEBUN tab Profil, dan
  // MainTabHeader tidak pernah merender tombol kembali.
  const header = <TopAppBar title="Anggota" onBack={() => router.back()} />;

  if (loading) {
    return <LoadingState header={header} message="Memuat anggota..." />;
  }

  return (
    <Screen header={header}>
      <ErrorBanner message={error} />

      <View style={{ gap: tokens.space.sm }}>
        {/* SectionLabel BERSAMA dari ui.tsx, menggantikan salinan lokal yang
            dulu berdiri di kaki berkas ini. Salinan itu merender judul 20/700
            sementara SectionLabel bersama memakai label huruf besar — dua
            bentuk untuk satu peran, di dua layar yang isinya sama persis.

            Jumlahnya masuk KE DALAM judulnya, bentuk yang sama dengan seksi
            "Pekerja aktif · N" di layar Anggota pemilik. */}
        <SectionLabel title={`Anggota kebun · ${activeMembers.length}`} />
        {activeMembers.length === 0 ? (
          <EmptyState title="Belum ada anggota" subtitle="Daftar anggota kebun akan muncul di sini." />
        ) : (
          <View>
            {activeMembers.map((actor, index) => (
              <View
                key={actor.userId}
                style={
                  index > 0
                    ? { borderTopColor: tokens.color.line.hairline, borderTopWidth: 1 }
                    : undefined
                }
              >
                {/* TANPA `onPress` dan TANPA `trailing`. Ketiadaan keduanya yang
                    membedakan layar ini dari versi pemilik, dan ia harus terbaca
                    tanpa dicoba: baris tanpa chevron adalah baris yang tidak
                    membuka apa pun. */}
                <MemberRow
                  meta={buildMemberMeta(actor, currentUserId)}
                  name={actor.fullName}
                  tone={actor.role === 'owner' ? 'accent' : 'neutral'}
                />
              </View>
            ))}
          </View>
        )}
      </View>
    </Screen>
  );
}

function roleOrder(role: FarmActorDisplayProfile['role']): number {
  return role === 'owner' ? 0 : 1;
}

function buildMemberMeta(actor: FarmActorDisplayProfile, currentUserId?: string): string {
  const roleLabel = actor.role === 'owner' ? 'Pemilik' : 'Pekerja';
  return actor.userId === currentUserId ? `${roleLabel} · kamu` : roleLabel;
}
