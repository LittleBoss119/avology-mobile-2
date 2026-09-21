import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { ConfirmDialog } from '../../../src/components/bottom-sheet';
import { MemberRow } from '../../../src/components/member-row';
import { useSnackbar } from '../../../src/components/snackbar';
import {
  Button,
  EmptyState,
  ErrorBanner,
  LoadingState,
  Screen,
  SectionLabel,
  TopAppBar,
} from '../../../src/components/ui';
import { tokens } from '../../../src/constants/theme';
import { useAuth } from '../../../src/context/auth-context';
import { getFarmActorDisplayProfiles, leaveCurrentFarm } from '../../../src/services/memberService';
import type { FarmActorDisplayProfile } from '../../../src/types/domain';

// VERSI PEKERJA DARI LAYAR ANGGOTA — adendum §4.5.
//
// Spek §41 hanya merancang versi pemilik. Versi pekerja adalah DAFTAR ANGGOTA
// AKTIF TANPA AKSI TERHADAP ORANG LAIN: tidak ada tombol setujui/tolak dan tidak
// ada baris anggota yang bisa ditekan. Pekerja tidak boleh mengubah keanggotaan
// siapa pun selain dirinya sendiri.
//
// "KELUAR DARI KEBUN" KEMBALI KE SINI (pasca-batch 7), sebagai baris merusak di
// kaki layar dengan konfirmasi — tempat yang sejak awal ditetapkan adendum
// §4.5. Ini MEMBATALKAN keputusan batch 4a yang memindahkannya ke Profil.
//
// Alasannya CAKUPAN, bukan tata letak. Keluar dari akun adalah urusan akun;
// keluar dari kebun adalah urusan kebun, dan layar inilah layar kebunnya. Di
// Profil keduanya duduk berdampingan sebagai dua tombol bergaris yang nyaris
// identik — dua jalan keluar yang sulit ditarik kembali, dibedakan satu kata.
// Argumen batch 4a ("keduanya harus bisa dibandingkan berdampingan") benar
// tentang perbandingannya tapi salah tentang akibatnya: yang berdampingan itu
// justru yang tertukar.
//
// getFarmDetail DICABUT di batch 7b. Ia dipanggil hanya untuk mengisi state
// `farm` yang satu-satunya gunanya adalah memutuskan merender daftar atau kartu
// "gagal dimuat" — pertanyaan yang sudah dijawab getFarmActorDisplayProfiles
// sendiri. Satu permintaan jaringan untuk sebuah if.
export default function WorkerFarmHubScreen() {
  const { currentFarm, refresh } = useAuth();
  const showSnackbar = useSnackbar();
  const [actors, setActors] = React.useState<FarmActorDisplayProfile[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = React.useState(false);
  const [leaving, setLeaving] = React.useState(false);

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

  async function handleLeaveFarm() {
    const farmId = currentFarm?.farmId;

    if (!farmId) {
      return;
    }

    setLeaving(true);

    const result = await leaveCurrentFarm({ farmId });

    if (result.error) {
      setLeaving(false);
      setConfirmLeave(false);
      showSnackbar(result.error.message);
      return;
    }

    // refresh() WAJIB mendahului navigasi: /removed-access membaca keanggotaan
    // dari auth-context, dan tanpa penyegaran ini ia masih melihat pekerja yang
    // baru saja keluar sebagai anggota aktif lalu memantulkannya kembali.
    await refresh();
    setLeaving(false);
    setConfirmLeave(false);
    router.replace('/removed-access');
  }

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

      {/* Ruang kosong fleksibel: mendorong tombol keluar ke kaki layar saat
          daftar anggotanya pendek, dan menyusut jadi nol saat daftarnya
          panjang atau font sistem dibesarkan. */}
      <View style={{ flexGrow: 1 }} />

      {/* TOMBOL MERUSAK, bukan baris. Button varian danger: bergaris
          borderStrong, tanpa latar, rata tengah, tanpa ikon — rupa yang sama
          persis dengan "Keluar dari akun" di Profil.

          ATURANNYA, supaya tidak ditinjau ulang:
            * BARIS merusak (<MenuRow danger>) dipakai bila aksinya duduk DI
              DALAM DAFTAR, di antara baris-baris lain. "Batalkan jadwal" dan
              "Pohon sudah tidak ada" tetap baris karena keduanya begitu.
            * TOMBOL merusak (<Button variant="danger">) dipakai bila aksinya
              BERDIRI SENDIRI di kaki layar. "Keluar dari kebun" begitu, dan
              begitu pula "Keluar dari akun".
          Yang menentukan bentuknya adalah TEMPAT aksinya berdiri, bukan seberapa
          merusak aksinya.

          Rupanya sama dengan "Keluar dari akun", tapi keduanya TIDAK lagi
          berdampingan: yang satu di Profil (urusan akun), yang ini di Anggota
          (urusan kebun). Keserupaan bentuk tidak lagi berbahaya begitu
          keduanya tidak bisa tertukar dalam satu tarikan mata.

          Hanya untuk pekerja AKTIF. Layar ini memang hanya terbuka untuk
          keanggotaan aktif, tapi syaratnya ditulis eksplisit: tombol yang
          mencabut keanggotaan tidak boleh bergantung pada penjaga di tempat
          lain. */}
      {currentFarm?.status === 'active' && currentFarm.role === 'worker' ? (
        <Button title="Keluar dari kebun" variant="danger" onPress={() => setConfirmLeave(true)} />
      ) : null}

      {/* Kata-katanya dipindah APA ADANYA dari Profil — termasuk "kode kebun"
          (bukan "kode bergabung") dan "bergabung lagi" (bukan "masuk lagi"),
          dua pilihan kata yang sudah diperbaiki dan tidak boleh hilang dalam
          pemindahan ini. */}
      <ConfirmDialog
        cancelLabel="Batal"
        confirmLabel="Keluar"
        loading={leaving}
        message="Kamu perlu kode kebun untuk bergabung lagi."
        onCancel={() => {
          if (!leaving) {
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

function roleOrder(role: FarmActorDisplayProfile['role']): number {
  return role === 'owner' ? 0 : 1;
}

function buildMemberMeta(actor: FarmActorDisplayProfile, currentUserId?: string): string {
  const roleLabel = actor.role === 'owner' ? 'Pemilik' : 'Pekerja';
  return actor.userId === currentUserId ? `${roleLabel} · kamu` : roleLabel;
}
