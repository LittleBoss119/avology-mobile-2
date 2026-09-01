import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import { tokens } from '../constants/theme';
import { useAuth } from '../context/auth-context';
import { setPendingAccessRoute } from '../lib/pendingAccessRoute';
import { getCurrentUserFarm } from '../services/farmService';
import { acknowledgeAccessNotice, cancelJoinRequest } from '../services/memberService';
import type { CurrentUserFarm } from '../types/domain';
import { ConfirmDialog } from './bottom-sheet';
import { Icon, type IconName } from './icons';
import { BrandMark, Button, ChipButton, ErrorBanner, LoadingState, Screen, TopAppBar } from './ui';

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

  // Susunannya sama persis dengan layar pilih akses: baris merek di slot judul,
  // chip "Profil" berlabel di kanan. flexShrink 0 pada chip supaya baris merek
  // yang mengalah kalau ruangnya sempit.
  //
  // Diangkat ke SATU tempat dan dipakai dua kali — oleh LoadingState di bawah
  // dan oleh Screen di akhir — supaya app bar tidak menghilang lalu muncul lagi
  // saat pemuatan selesai. Satu sumber, bukan dua salinan yang bisa berselisih.
  // Isinya tidak bergantung pada relasi yang sedang dimuat, jadi ia sudah utuh
  // sebelum currentFarm terbaca.
  const header = (
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
  );

  if (!currentFarm) {
    return <LoadingState header={header} message="Memuat status akses..." />;
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
      header={header}
      // SETIAP keadaan punya isi footer sekarang — tidak ada lagi cabang
      // `undefined`. "Batalkan pengajuan" pindah ke sini dari dalam kartu: ia
      // mengubah keadaan, dan aksi yang mengubah keadaan tidak boleh duduk di
      // dalam wadah yang isinya bacaan. Sebelum ini, keadaan menunggu sama
      // sekali tidak punya aksi di dasar layar dan satu-satunya jalan keluarnya
      // adalah chip Profil di app bar.
      footer={
        isPending ? (
          // Tombol teks bernada bahaya, bentuk yang sudah dipakai aksi merusak
          // di layar ini dan di layar lain (owner/farm.tsx, worker/farm.tsx).
          // SENGAJA bukan tombol berblok: membatalkan pengajuan adalah jalan
          // mundur, bukan aksi utama layar ini — yang utama justru menunggu.
          <TextAction
            title="Batalkan pengajuan"
            tone="danger"
            disabled={busy}
            onPress={() => setConfirmCancel(true)}
          />
        ) : (
          <>
            {/* Bobot SETARA, alasannya sama persis dengan layar pilih akses:
                tidak ada jalur pemulihan bagi pemilik kebun kosong, jadi jalur
                "buat kebun" tidak boleh terlihat lebih mengundang daripada
                jalur "gabung". Dulu tombol pertama berblok hijau penuh dan yang
                kedua cuma teks — persis ketimpangan yang dilarang itu.

                `disabled={busy}` di KEDUANYA, tanpa pemintal. Keduanya memanggil
                handleRecovery yang sama dan `busy` tidak tahu tombol mana yang
                ditekan; menaruh pemintal di salah satunya akan mengabarkan hal
                yang belum tentu benar. */}
            <Button
              title="Coba kode lain"
              variant="secondary"
              emphasis="strong"
              disabled={busy}
              onPress={() => void handleRecovery('/join-farm')}
            />
            <Button
              title="Buat kebun baru"
              variant="secondary"
              emphasis="strong"
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

        {/* Tanggal turun lagi jadi baris keterangan biasa, di bawah kalimat
            penjelas. Sebagai kartu berbingkai ia menjanjikan sebuah berkas lalu
            hanya berisi satu baris — bingkai yang tidak membawa apa-apa, dan
            bingkai itu ikut menyeret aksinya ke dalam wadah bacaan.

            Tanpa tanggal, barisnya HILANG. Tidak ada tanda hubung dan tidak ada
            teks pengganti: '—' menuntut pembaca menerjemahkan sebuah simbol
            hanya untuk sampai pada kesimpulan bahwa tidak ada yang perlu
            dibaca. */}
        {view.dateValue ? (
          <Text
            selectable
            style={{
              color: tokens.color.text.tertiary,
              fontSize: tokens.type.meta.fontSize,
              lineHeight: tokens.type.meta.lineHeight,
              textAlign: 'center',
            }}
          >
            {`${view.dateLabel} ${view.dateValue}`}
          </Text>
        ) : null}
      </View>

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
    // BENTUK ikon membedakan keadaan, bukan cuma warnanya. Sebelum ini
    // 'rejected' dan 'removed' sama-sama memakai 'x' di atas lingkaran merah
    // yang sama, sehingga satu-satunya pembedanya adalah judul — dan pada layar
    // yang dibaca sekilas di bawah matahari, itu berarti tidak ada pembeda.
    //
    // 'lock' untuk removed: gemboknya menyatakan kebun itu kini TERTUTUP untuk
    // dia, dan itu benar untuk kedua cabangnya — baik dinonaktifkan pemilik
    // maupun keluar atas kemauan sendiri. 'logout' sempat jadi kandidat tapi
    // ditolak: pintu dengan panah keluar berarti "kamu pergi", dan itu menuduh
    // salah untuk pekerja yang justru dikeluarkan. Siluet gembok juga tidak bisa
    // tertukar dengan silang maupun jam pada ukuran kecil.
    icon: membership.status === 'rejected' ? 'x' : 'lock',
    iconBackground: tokens.color.status.danger.bg,
    iconColor: tokens.color.status.danger.text,
    title: resolveEndedTitle(membership),
  };
}

// Kalimatnya TIDAK lagi menyebutkan jalan keluarnya. Dulu ia menutup dengan
// "Kamu bisa mencoba kode kebun lain, atau membuat kebun sendiri" — dan sejak
// kedua aksi itu berdiri sebagai tombol berlabel "Coba kode lain" dan "Buat
// kebun baru" tepat di bawahnya, kalimat itu cuma membacakan ulang tombolnya.
//
// Yang menggantikannya adalah hal yang TIDAK terlihat dari layar: bahwa
// keadaannya tidak mengunci apa-apa. Baris rejected/removed tidak diblokir
// farm_members_one_active_relation_idx — indeks itu hanya menghitung status
// 'pending' dan 'active' (migrasi 036:150-152) — jadi pengajuan ke kebun lain
// memang sudah terbuka sekarang juga, sebelum tombol mana pun ditekan. Itu
// kabar, bukan deskripsi.
//
// Percabangan removed mengikuti percabangan di resolveEndedTitle. Tanpa itu,
// cabang 'left_by_worker' membaca judul "Kamu sudah keluar dari kebun ini" lalu
// kalimat "Kamu sudah tidak punya akses ke kebun ini" — hal yang sama dua kali.
function resolveEndedDescription(membership: CurrentUserFarm): string {
  if (membership.status === 'rejected') {
    return 'Pemilik kebun tidak menyetujui pengajuanmu. Kamu bebas mengajukan ke kebun lain sekarang.';
  }

  // Keluar atas kemauan sendiri: kalimat keduanya menyebut SYARAT untuk
  // kembali, bukan kebebasan pindah. Orang yang keluar sendiri lebih mungkin
  // ingin masuk lagi ke kebun yang sama, dan untuk itu ia butuh kodenya lagi —
  // sama persis dengan peringatan di dialog keluar milik layar Kebun pekerja.
  if (membership.removedReason === 'left_by_worker') {
    return 'Catatan dan tugas kebun itu sudah tidak bisa kamu buka. Kalau mau kembali, kamu perlu kode kebun itu lagi.';
  }

  return 'Catatan dan tugas kebun itu sudah tidak bisa kamu buka. Kamu bebas bergabung ke kebun lain sekarang.';
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
