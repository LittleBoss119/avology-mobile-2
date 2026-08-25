import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { tokens } from '../constants/theme';
import { useAuth } from '../context/auth-context';
import { setPendingAccessRoute } from '../lib/pendingAccessRoute';
import { getCurrentUserFarm } from '../services/farmService';
import { acknowledgeAccessNotice, cancelJoinRequest } from '../services/memberService';
import type { CurrentUserFarm } from '../types/domain';
import { ConfirmDialog } from './bottom-sheet';
import { Icon, type IconName } from './icons';
import { BrandMark, Button, Card, ChipButton, ErrorBanner, LoadingState, Screen, TopAppBar } from './ui';

// Layar ini melayani tiga state sekaligus: pending, rejected, removed.
//
// Versi lama menyampaikan status yang sama sampai TIGA kali — sebagai judul,
// sebagai chip, dan sebagai baris "Status" di dalam kartu — lalu menambah kotak
// biru berisi kalimat yang menerangkan cara kerja aplikasi. Sekarang statusnya
// dinyatakan sekali: satu ikon, satu judul, nama kebun, tanggal.
//
// Badge peran juga dihapus. User yang pengajuannya masih menunggu belum menjadi
// pekerja — melabelinya "Pekerja" itu tidak benar.

// Pengganti tombol "Cek Status" yang dihapus. Tombol itu menyuruh user
// mengerjakan tugas sistem, tapi menghapusnya begitu saja lebih buruk: satu-
// satunya pemicu tersisa adalah on-focus, padahal user di layar tunggu justru
// DIAM di layar itu — pengajuannya disetujui dan dia tidak pernah tahu.
// Sengaja tanpa indikator berputar: user cukup menunggu, layarnya berubah
// sendiri.
const POLL_INTERVAL_MS = 15000;

// Tanpa prop: judul dan tanggalnya diturunkan dari status + removedReason, yang
// tidak diketahui pembungkusnya. Ketiga rute pembungkus (pending-approval,
// rejected, removed-access) memang cuma menentukan rute mana yang dipakai guard.
export function AccessStatusScreen() {
  const { currentFarm, error, profile, refresh } = useAuth();
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [confirmCancel, setConfirmCancel] = React.useState(false);
  const [joinedFarm, setJoinedFarm] = React.useState<{ name: string | null } | null>(null);

  const isPending = currentFarm?.status === 'pending';
  // Berhenti begitu modal muncul: relasinya sudah berubah, tidak ada lagi yang
  // perlu ditunggu.
  const shouldPoll = isPending && joinedFarm === null;

  useFocusEffect(
    React.useCallback(() => {
      // Hanya state pending yang bisa berubah sendiri dari sisi server. Rejected
      // dan removed menunggu aksi user, jadi tidak perlu dipoll.
      if (!shouldPoll) {
        return;
      }

      let cancelled = false;

      // Membaca relasi LANGSUNG, bukan lewat refresh() dari context. Kalau
      // context yang diperbarui, guard di _layout.tsx langsung menendang user ke
      // dashboard pekerja — antarmuka yang belum pernah dia lihat — tanpa satu
      // kalimat pun. Dengan membaca langsung, context tetap 'pending' sampai
      // user menekan "Mulai", jadi layar ini bertahan dan modalnya sempat
      // terlihat.
      const intervalId = setInterval(() => {
        void (async () => {
          const result = await getCurrentUserFarm();

          if (cancelled || result.error || !result.data) {
            return;
          }

          if (result.data.status === 'active') {
            setJoinedFarm({ name: result.data.farm?.name?.trim() ?? null });
            return;
          }

          // Ditolak atau dinonaktifkan tidak butuh modal: layar pemberitahuannya
          // sendiri yang menyampaikan, dan itu sudah bekerja sejak Fase 3.
          if (result.data.status === 'rejected' || result.data.status === 'removed') {
            void refresh();
          }
        })();
      }, POLL_INTERVAL_MS);

      return () => {
        cancelled = true;
        clearInterval(intervalId);
      };
    }, [refresh, shouldPoll])
  );

  // refresh() saat fokus SENGAJA tidak dipanggil di sini. Pemanggilnya tinggal
  // satu: useFocusEffect di app/(onboarding)/_layout.tsx — lihat catatan di
  // laporan Fase 3.

  if (!currentFarm) {
    return <LoadingState message="Memuat status akses..." />;
  }

  async function handleCancelRequest() {
    setBusy(true);
    setActionError(null);

    const result = await cancelJoinRequest();

    if (result.error) {
      setBusy(false);
      setConfirmCancel(false);
      setActionError(result.error.message);
      return;
    }

    // Cukup satu panggilan: sejak migration 038 cancel_join_request sekalian
    // menyapu baris stale, jadi acknowledgeAccessNotice TIDAK disusulkan.
    //
    // Tidak ada router.replace() di sini. Begitu relasinya null, guard di
    // _layout.tsx sendiri yang memindahkan ke layar pilih akses — itu memang
    // tujuan alaminya untuk user tanpa relasi.
    await refresh();
    setBusy(false);
    setConfirmCancel(false);
  }

  async function handleRecovery(target: '/create-farm' | '/join-farm') {
    setBusy(true);
    setActionError(null);

    const result = await acknowledgeAccessNotice();

    if (result.error) {
      setBusy(false);
      setActionError(result.error.message);
      return;
    }

    // MENYATAKAN tujuan, bukan menavigasi. Kalau layar ini memanggil
    // router.replace() sendiri, ia berlomba dengan guard di _layout.tsx yang
    // masih memegang relasi basi: guard memantulkan ke layar pemberitahuan,
    // lalu memantulkan sekali lagi ke pilih akses setelah relasinya null.
    // Dengan menyatakan tujuan, perpindahan baru terjadi di render yang benar-
    // benar sudah melihat relasi null — satu kali, ke tempat yang diminta.
    setPendingAccessRoute(target);
    await refresh();
    setBusy(false);
  }

  // Satu-satunya tempat relasi diperbarui setelah pengajuan disetujui. Sesudah
  // ini guard yang memindahkan ke dashboard pekerja — tanpa navigasi imperatif.
  async function handleStart() {
    setBusy(true);
    await refresh();
  }

  const view = resolveStatusView(currentFarm);
  const farmName = currentFarm.farm?.name?.trim();

  return (
    <Screen
      header={
        // Susunannya sama persis dengan layar pilih akses: baris merek di slot
        // judul, chip "Profil" berlabel di kanan. flexShrink 0 pada chip supaya
        // baris merek yang mengalah kalau ruangnya sempit.
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
      // "Batalkan pengajuan" TIDAK lagi di sini: ia aksi atas pengajuan yang
      // disebut kartu di atas, jadi tempatnya di dalam kartu itu. Yang tinggal di
      // footer cuma aksi yang membawa user KELUAR dari layar ini — dan itu hanya
      // ada saat pengajuannya sudah berakhir. Untuk pending, footer memang tidak
      // ada: `undefined`, bukan fragmen kosong, supaya Screen tidak menyisakan
      // pembungkus berpadding di dasar layar.
      footer={
        isPending ? undefined : (
          <>
            <Button
              title="Coba kode lain"
              loading={busy}
              onPress={() => void handleRecovery('/join-farm')}
            />
            <TextAction
              title="Buat kebun sendiri"
              disabled={busy}
              onPress={() => void handleRecovery('/create-farm')}
            />
          </>
        )
      }
    >
      <ErrorBanner message={actionError ?? (profile ? error?.message : undefined)} />

      <View style={{ alignItems: 'center', gap: tokens.space.lg, paddingTop: tokens.space.xxxl }}>
        <View
          style={{
            alignItems: 'center',
            backgroundColor: view.iconBackground,
            borderRadius: tokens.radius.pill,
            height: 88,
            justifyContent: 'center',
            width: 88,
          }}
        >
          <Icon name={view.icon} size={40} color={view.iconColor} />
        </View>

        <Text
          selectable
          style={{
            color: tokens.color.text.primary,
            fontSize: tokens.type.title.fontSize,
            fontWeight: tokens.type.title.fontWeight,
            lineHeight: tokens.type.title.lineHeight,
            textAlign: 'center',
          }}
        >
          {view.title}
        </Text>

        {farmName ? (
          <Text
            selectable
            style={{
              color: tokens.color.text.secondary,
              fontSize: tokens.type.body.fontSize,
              lineHeight: tokens.type.body.lineHeight,
              textAlign: 'center',
            }}
          >
            {farmName}
          </Text>
        ) : null}

        {/* Satu kalimat, bahasa sehari-hari. Layar ini sebelumnya hanya menyebut
            status tanpa pernah mengatakan apa yang sedang terjadi dan apa yang
            bisa dilakukan — dan bagi orang yang baru pertama memakai aplikasi,
            "Menunggu persetujuan" saja tidak menjelaskan siapa yang menyetujui. */}
        <Text
          selectable
          style={{
            color: tokens.color.text.secondary,
            fontSize: tokens.type.bodySmall.fontSize,
            lineHeight: tokens.type.bodySmall.lineHeight,
            textAlign: 'center',
          }}
        >
          {view.description}
        </Text>
      </View>

      {/* Tanggal naik dari baris teks lepas menjadi kartu. Sebagai baris lepas ia
          terbaca seperti keterangan gambar; sebagai kartu ia menjadi berkas
          pengajuannya sendiri — dan untuk pengajuan yang masih berjalan, tempat
          yang benar untuk membatalkannya. */}
      <Card>
        <View style={styles.cardRow}>
          <Text selectable style={styles.cardLabel}>
            {view.dateLabel}
          </Text>
          <Text selectable style={styles.cardValue}>
            {view.dateValue ?? '—'}
          </Text>
        </View>

        {isPending ? (
          <>
            <View style={styles.cardDivider} />
            <TextAction
              title="Batalkan pengajuan"
              tone="danger"
              disabled={busy}
              onPress={() => setConfirmCancel(true)}
            />
          </>
        ) : null}
      </Card>

      <JoinedFarmModal busy={busy} farmName={joinedFarm?.name ?? null} onStart={handleStart} visible={joinedFarm !== null} />

      <ConfirmDialog
        cancelLabel="Tetap tunggu"
        confirmLabel="Batalkan pengajuan"
        loading={busy}
        message="Kamu bisa mengajukan lagi kapan saja."
        onCancel={() => {
          if (!busy) {
            setConfirmCancel(false);
          }
        }}
        onConfirm={() => void handleCancelRequest()}
        title="Batalkan pengajuan?"
        tone="danger"
        visible={confirmCancel}
      />
    </Screen>
  );
}

// Penyambut, bukan syarat. Kalau user menutup aplikasi sebelum menekan "Mulai",
// saat dibuka lagi relasinya sudah aktif dan dia langsung mendarat di dashboard
// tanpa modal — itu perilaku yang diterima.
function JoinedFarmModal({
  busy,
  farmName,
  onStart,
  visible,
}: {
  busy: boolean;
  farmName: string | null;
  onStart: () => void;
  visible: boolean;
}) {
  return (
    <Modal
      animationType="fade"
      // Tanpa jalan keluar selain "Mulai": menutupnya hanya mengembalikan user ke
      // layar tunggu yang isinya sudah tidak berlaku.
      onRequestClose={() => undefined}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View
        style={{
          alignItems: 'center',
          backgroundColor: tokens.color.overlay.scrim,
          flex: 1,
          justifyContent: 'center',
          padding: tokens.space.xxl,
        }}
      >
        <View
          style={{
            backgroundColor: tokens.color.surface.card,
            borderCurve: 'continuous',
            borderRadius: tokens.radius.card,
            gap: tokens.space.lg,
            padding: tokens.space.xxl,
            width: '100%',
          }}
        >
          <View
            style={{
              alignItems: 'center',
              alignSelf: 'center',
              backgroundColor: tokens.color.brand.soft,
              borderRadius: tokens.radius.pill,
              height: 64,
              justifyContent: 'center',
              width: 64,
            }}
          >
            <Icon name="check" size={32} color={tokens.color.brand.base} />
          </View>

          <Text
            selectable
            style={{
              color: tokens.color.text.primary,
              fontSize: tokens.type.heading.fontSize,
              fontWeight: tokens.type.heading.fontWeight,
              lineHeight: tokens.type.heading.lineHeight,
              textAlign: 'center',
            }}
          >
            {farmName ? `Kamu bergabung ke ${farmName}` : 'Kamu bergabung ke kebun'}
          </Text>

          <Text
            selectable
            style={{
              color: tokens.color.text.secondary,
              fontSize: tokens.type.body.fontSize,
              lineHeight: tokens.type.body.lineHeight,
              textAlign: 'center',
            }}
          >
            Sekarang kamu bisa lihat tugas dan mencatat aktivitas pohon.
          </Text>

          <Button title="Mulai" loading={busy} onPress={onStart} />
        </View>
      </View>
    </Modal>
  );
}

// Tombol teks. <Button variant="ghost"> selalu memakai warna merek, sedangkan
// aksi membatalkan butuh warna bahaya tanpa blok berwarna. ui.tsx tidak boleh
// disentuh di fase ini, jadi versinya lokal.
function TextAction({
  disabled = false,
  onPress,
  title,
  tone = 'brand',
}: {
  disabled?: boolean;
  onPress: () => void;
  title: string;
  tone?: 'brand' | 'danger';
}) {
  const color = tone === 'danger' ? tokens.color.status.danger.text : tokens.color.brand.base;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: tokens.layout.tapTarget,
        opacity: pressed || disabled ? 0.5 : 1,
      })}
    >
      <Text selectable={false} style={{ color, fontSize: 16, fontWeight: '700' }}>
        {title}
      </Text>
    </Pressable>
  );
}

// dateLine yang dulu satu string ("Diajukan 3 Maret") kini dipecah jadi label +
// nilai: kartunya menaruh label di kiri dan nilainya di kanan, jadi keduanya
// harus terpisah. Label untuk rejected/removed sengaja NETRAL ("Tanggal") — judul
// di atas sudah menyatakan peristiwanya, dan mengulangnya di label akan
// menghasilkan "Pengajuan ditolak" lalu "Ditolak · 3 Maret".
type StatusView = {
  dateLabel: string;
  dateValue: string | null;
  description: string;
  icon: IconName;
  iconBackground: string;
  iconColor: string;
  title: string;
};

function resolveStatusView(membership: CurrentUserFarm): StatusView {
  if (membership.status === 'pending') {
    // updated_at hanya terisi kalau baris ini pernah ditimpa oleh pengajuan
    // ulang (cabang on conflict di request_join_farm); pada pengajuan baru ia
    // null dan tanggalnya jatuh ke created_at.
    const requestedAt = formatDate(membership.updatedAt ?? membership.createdAt);

    return {
      dateLabel: 'Diajukan',
      dateValue: requestedAt,
      description: 'Pengajuanmu sudah dikirim ke kebun ini. Pemilik kebun sedang meninjaunya.',
      icon: 'clock',
      iconBackground: tokens.color.status.warning.bg,
      iconColor: tokens.color.status.warning.text,
      title: 'Menunggu persetujuan',
    };
  }

  const endedAt = formatDate(membership.removedAt ?? membership.updatedAt ?? membership.createdAt);

  return {
    dateLabel: 'Tanggal',
    dateValue: endedAt,
    description: resolveEndedDescription(membership),
    icon: 'x',
    iconBackground: tokens.color.status.danger.bg,
    iconColor: tokens.color.status.danger.text,
    title: resolveEndedTitle(membership),
  };
}

// Kalimatnya menyebut jalan keluarnya, karena dua tombol di dasar layar itulah
// yang harus dipahami: user di sini sedang menunggu diberi tahu apa yang bisa dia
// lakukan sekarang.
function resolveEndedDescription(membership: CurrentUserFarm): string {
  if (membership.status === 'rejected') {
    return 'Pemilik kebun tidak menyetujui pengajuanmu. Kamu bisa mencoba kode kebun lain, atau membuat kebun sendiri.';
  }

  return 'Kamu sudah tidak punya akses ke kebun ini. Kamu bisa bergabung ke kebun lain, atau membuat kebun sendiri.';
}

function resolveEndedTitle(membership: CurrentUserFarm): string {
  if (membership.status === 'rejected') {
    return 'Pengajuan ditolak';
  }

  // Keluar sendiri dan dinonaktifkan pemilik adalah dua peristiwa berbeda yang
  // selama ini tampil sama (temuan R-12). removed_reason sudah tersedia sejak
  // migration 020; nilai null berarti data warisan yang tidak pernah dicatat,
  // dan untuk itu kalimat netral lebih jujur daripada menebak.
  if (membership.removedReason === 'left_by_worker') {
    return 'Kamu sudah keluar dari kebun ini';
  }

  return 'Akses kebun dinonaktifkan';
}

function formatDate(value?: string | null): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

const styles = StyleSheet.create({
  cardRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: tokens.space.md,
    justifyContent: 'space-between',
  },
  cardLabel: { ...tokens.type.body, color: tokens.color.text.secondary },
  cardValue: { ...tokens.type.bodyStrong, color: tokens.color.text.primary },
  cardDivider: {
    backgroundColor: tokens.color.line.hairline,
    height: StyleSheet.hairlineWidth,
  },
});
