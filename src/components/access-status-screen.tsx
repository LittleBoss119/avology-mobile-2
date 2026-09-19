import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import { tokens } from '../constants/theme';
import { colors as palette, fonts } from '../theme/tokens';
import { useAuth } from '../context/auth-context';
// setPendingAccessRoute TIDAK lagi diimpor: satu-satunya pemanggilnya adalah
// handleRecovery, dan sejak batch 2 ia tidak menyatakan tujuan apa pun.
// Modulnya sendiri dibiarkan berdiri — guard di (onboarding)/_layout.tsx masih
// membaca dan membersihkannya, dan membuang ekspor dilarang batasan keras.
// Selama tidak ada yang menyetelnya, peekPendingAccessRoute() selalu null dan
// guard jatuh ke perhitungan tujuan yang normal.
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
  const { currentFarm, error, profile, refresh, signOut } = useAuth();
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [checkingStatus, setCheckingStatus] = React.useState(false);
  const [signingOut, setSigningOut] = React.useState(false);
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

  // TANPA argumen tujuan sejak batch 2. Dulu ia menerima '/create-farm' atau
  // '/join-farm' dan menyatakannya lewat setPendingAccessRoute; sekarang
  // pilihannya diambil di layar Pilih jalur, bukan di sini.
  //
  // Tidak menyatakan tujuan berarti tujuannya jatuh ke perhitungan alami guard
  // di _layout.tsx: pengguna tanpa relasi mendarat di layar pilih akses. Jalur
  // itu bukan hal baru — handleCancelRequest di atas sudah mengandalkannya.
  //
  // Alasan lama tetap berlaku dan itu sebabnya tidak ada router.replace() di
  // sini: kalau layar ini menavigasi sendiri, ia berlomba dengan guard yang
  // masih memegang relasi basi, dan penggunanya dipantulkan dua kali.
  async function handleRecovery() {
    setBusy(true);
    setActionError(null);

    const result = await acknowledgeAccessNotice();

    if (result.error) {
      setBusy(false);
      setActionError(result.error.message);
      return;
    }

    await refresh();
    setBusy(false);
  }

  // Memakai refresh() yang SAMA dengan yang dipakai polling di efek atas —
  // tidak ada panggilan data baru. Yang ditambahkannya cuma keadaan tertekan
  // yang terlihat, supaya orang yang menunggu punya sesuatu untuk dilakukan
  // selain menutup dan membuka ulang aplikasi.
  async function handleCheckStatus() {
    setCheckingStatus(true);
    setActionError(null);
    await refresh();
    setCheckingStatus(false);
  }

  async function handleSignOut() {
    setSigningOut(true);
    setActionError(null);

    const result = await signOut();

    if (result) {
      setActionError(result.message);
      setSigningOut(false);
      return;
    }

    setSigningOut(false);
    router.replace('/get-started');
  }

  // Satu-satunya tempat relasi diperbarui setelah pengajuan disetujui. Sesudah
  // ini guard yang memindahkan ke dashboard pekerja — tanpa navigasi imperatif.
  async function handleStart() {
    setBusy(true);
    await refresh();
  }

  const farmName = currentFarm.farm?.name?.trim();
  const view = resolveStatusView(currentFarm, farmName);
  // Nama kebun dan tanggal jadi SATU baris. Keduanya keterangan sekunder dengan
  // bobot yang sama; memisahnya jadi dua baris memberi nama kebun bobot judul
  // yang tidak ia minta.
  //
  // Pada keadaan ditolak/dicabut nama kebun SUDAH masuk ke judul ("Akses ke X
  // sudah ditutup"), jadi ia dibuang dari baris ini supaya tidak disebut dua
  // kali dalam satu layar.
  const metaLine = [
    view.showFarmNameInMeta ? farmName : undefined,
    view.dateValue ? `${view.dateLabel} ${view.dateValue}` : undefined,
  ]
    .filter((part): part is string => Boolean(part))
    .join(' · ');

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
          <>
            {/* "Periksa status" sebagai aksi UTAMA. Layar ini sudah memantau
                sendiri lewat polling, tapi pemantauan yang tidak terlihat sama
                saja dengan tidak ada bagi orang yang menunggu — dan yang ia
                lakukan tanpa tombol ini adalah menutup lalu membuka ulang
                aplikasi. Tombolnya memanggil refresh() yang sama dengan yang
                dipakai polling; tidak ada panggilan data baru. */}
            <Button
              title="Periksa status"
              loading={checkingStatus}
              loadingTitle="Memeriksa…"
              onPress={() => void handleCheckStatus()}
            />
            {/* TIGA aksi, sementara spek Langkah 9 menyebut dua.
                Yang ditambahkan adalah "Batalkan pengajuan", dan ia TIDAK boleh
                dibuang: ini satu-satunya tempat di seluruh aplikasi yang bisa
                menarik kembali pengajuan gabung. Membuangnya demi mencocokkan
                daftar dua baris berarti menghapus fungsi, bukan menata ulang.

                TextAction lokal diganti Button varian merusak: bentuknya sudah
                sama sejak batch 1a (teks tanpa latar), dan dua jalur untuk satu
                bentuk cuma bisa melenceng. */}
            <Button
              title="Batalkan pengajuan"
              variant="danger"
              disabled={busy || checkingStatus}
              onPress={() => setConfirmCancel(true)}
            />
            <Button
              title="Keluar dari akun"
              variant="danger"
              disabled={busy || checkingStatus}
              loading={signingOut}
              loadingTitle="Keluar…"
              onPress={() => void handleSignOut()}
            />
          </>
        ) : (
          <>
            {/* SATU aksi pemulihan, menggantikan pasangan "Coba kode lain" +
                "Buat kebun baru".
                Keduanya dulu dipasang berbobot setara supaya tidak ada yang
                tertekan hanya karena menonjol — kekhawatiran yang sah dan tidak
                hilang. Yang berubah: pilihannya tidak lagi diambil DI SINI.
                "Pilih ulang" mengembalikan orang ke layar Pilih jalur, tempat
                pertanyaan itu memang diajukan lengkap dengan subjudul yang
                menyebut siapa memilih apa. Satu tombol di sini berarti tidak ada
                lagi pasangan yang bisa timpang.

                Tanpa argumen tujuan: begitu acknowledgeAccessNotice() membuat
                relasinya null, guard di _layout.tsx sendiri yang memindahkan ke
                layar pilih akses — itu memang tujuan alaminya untuk pengguna
                tanpa relasi, dan jalur itu sudah dipakai handleCancelRequest. */}
            <Button
              title="Pilih ulang"
              loading={busy}
              loadingTitle="Menyiapkan…"
              onPress={() => void handleRecovery()}
            />
            <Button
              title="Keluar dari akun"
              variant="danger"
              disabled={busy}
              loading={signingOut}
              loadingTitle="Keluar…"
              onPress={() => void handleSignOut()}
            />
          </>
        )
      }
    >
      <ErrorBanner message={actionError ?? (profile ? error?.message : undefined)} />

      <View style={{ alignItems: 'center', gap: tokens.space.lg, paddingTop: tokens.space.xxxl }}>
        {/* Ikon GARIS 44, tanpa lingkaran berlatar 88.
            Lingkaran penuh berwarna status membuat keadaan menunggu terbaca
            sekeras keadaan ditolak — bidang warna sebesar itu adalah alarm, dan
            menunggu bukan alarm. Yang membedakan ketiga keadaan sekarang adalah
            BENTUK ikonnya (jam, silang, gembok) plus warna goresannya, sejalan
            dengan penanda bentuk pada badge di batch 1a.

            strokeWidth 1,5, alasan sama dengan EmptyState varian 'plain':
            goresan diukur dalam satuan viewBox 24, jadi pada 44px goresan 2
            menjadi ~3,7 piksel dan ikonnya terbaca gempal. */}
        <Icon name={view.icon} size={44} strokeWidth={1.5} color={view.iconColor} />

        <Text
          selectable
          style={{
            color: palette.textPrimary,
            // Serif, sejajar dengan judul EmptyState varian 'plain'. Judul di
            // sini menamai SEBUAH KEADAAN yang dibaca sekali lalu ditinggalkan,
            // bukan label antarmuka yang dipindai berulang kali.
            fontFamily: fonts.serif,
            fontSize: 30,
            lineHeight: 38,
            textAlign: 'center',
          }}
        >
          {view.title}
        </Text>

        {/* Satu kalimat, bahasa sehari-hari. Layar ini sebelumnya hanya menyebut
            status tanpa pernah mengatakan apa yang sedang terjadi dan apa yang
            bisa dilakukan — dan bagi orang yang baru pertama memakai aplikasi,
            "Menunggu persetujuan" saja tidak menjelaskan siapa yang menyetujui. */}
        <Text
          selectable
          style={{
            color: palette.textMuted,
            fontFamily: fonts.sans,
            fontSize: 16,
            lineHeight: 22,
            textAlign: 'center',
          }}
        >
          {view.description}
        </Text>

        {/* SATU baris meta, menggabungkan nama kebun dan tanggal dengan pemisah
            ' · ' — konvensi yang sama dengan buildFarmMetaLine (farmFormat.ts).
            Dulu keduanya dua baris terpisah, dan nama kebun yang berdiri sendiri
            sebagai baris 16 di bawah judul terbaca seperti judul kedua.

            Bagian yang kosong HILANG alih-alih jadi placeholder, jadi tidak ada
            pemisah yang menggantung; kalau keduanya kosong, barisnya tidak
            dirender sama sekali. Tidak ada tanda hubung dan tidak ada teks
            pengganti: '—' menuntut pembaca menerjemahkan sebuah simbol hanya
            untuk sampai pada kesimpulan bahwa tidak ada yang perlu dibaca. */}
        {metaLine ? (
          <Text
            selectable
            style={{
              color: palette.textMuted,
              fontFamily: fonts.sans,
              fontSize: 14,
              lineHeight: 20,
              textAlign: 'center',
            }}
          >
            {metaLine}
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

// TextAction DICABUT di batch 2.
//
// Ia dulu ada karena <Button variant="ghost"> selalu memakai warna merek
// sedangkan aksi membatalkan butuh warna bahaya tanpa blok berwarna — dan
// ui.tsx tidak boleh disentuh saat itu. Sejak batch 1a, <Button variant="danger">
// PERSIS berbentuk itu: teks statusBurukInk tanpa latar dan tanpa garis. Tidak
// ada lagi yang perlu ditiru secara lokal.

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
  // Nama kebun ikut ke baris meta HANYA kalau judulnya belum menyebutnya.
  showFarmNameInMeta: boolean;
  title: string;
};

function resolveStatusView(membership: CurrentUserFarm, farmName?: string): StatusView {
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
      iconColor: palette.statusPerhatian,
      showFarmNameInMeta: true,
      // TANPA NAMA PEMILIK, dan itu bukan kelalaian.
      //
      // Spek redesign menulis "Menunggu persetujuan Abah" — "Abah" adalah nama
      // pemilik pada studi kasus, bukan kata yang berlaku umum. Nama pemilik
      // yang sebenarnya TIDAK tersedia di layar ini: get_current_user_access
      // hanya mengembalikan nama kebun, dan tipe Farm (types/domain.ts) tidak
      // punya kolom pemilik sama sekali. Menambahkannya berarti panggilan data
      // baru, yang dilarang batch 2.
      //
      // Jadi judulnya berhenti di "Menunggu persetujuan", dan yang menyebut
      // siapa penyetujunya adalah kalimat di bawahnya ("Pemilik kebun sedang
      // meninjaunya") — peran, bukan nama.
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
    iconColor: palette.statusBuruk,
    // Nama kebun sudah masuk ke judul di bawah, jadi tidak diulang di meta.
    showFarmNameInMeta: false,
    title: resolveEndedTitle(membership, farmName),
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

// Judul menyebut NAMA KEBUNNYA. Seorang pekerja bisa saja pernah mengajukan ke
// beberapa kebun; "Pengajuan ditolak" tanpa nama tidak memberi tahu yang mana.
//
// Nama kebun dipakai HANYA kalau ada. Untuk relasi non-aktif, RPC-nya memang
// masih mengembalikan nama kebun — tapi kalau suatu saat tidak, judul berhenti
// di bentuk tanpa nama alih-alih berbunyi "Akses ke  sudah ditutup".
function resolveEndedTitle(membership: CurrentUserFarm, farmName?: string): string {
  if (farmName) {
    return `Akses ke ${farmName} sudah ditutup`;
  }

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
