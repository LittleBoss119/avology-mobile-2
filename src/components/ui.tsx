import React from 'react';
import DateTimePicker, {
  type DateTimePickerChangeEvent,
} from '@react-native-community/datetimepicker';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type KeyboardEvent,
  type KeyboardTypeOptions,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  colors as designColors,
  radius,
  spacing,
  statusColors,
  theme,
  tokens,
  typography,
  type StatusTone,
} from '../constants/theme';
// Keempat komponen batch 1a (Button, Field, Badge, MenuRow) membaca bentuk dan
// ukurannya dari SINI, bukan dari ekspor `tokens` di constants/theme.ts.
// Lapisan alih itu tetap melayani 53 berkas lain; yang dibentuk ulang batch ini
// mengambil langsung dari sumbernya.
import {
  colors as palette,
  fonts,
  radius as shapeRadius,
  touch,
} from '../theme/tokens';
import { sanitizeDisplayValue, sanitizeUserFacingMessage } from '../utils/displayFormat';
import { Icon, type IconName } from './icons';
import { PhotoSourceSheet } from './bottom-sheet';
import { StatusMarker, type StatusMarkerShape } from './status-marker';
import { SkeletonBlock, SkeletonList, SlowLoadNotice } from './skeleton';

// Diekspor ulang dengan alasan yang sama seperti StatusMarker: satu jalur impor
// untuk pemanggil. Batch 2-7 memakainya untuk meniru bentuk isi tiap layar.
export { SkeletonBlock, SkeletonList, SlowLoadNotice } from './skeleton';

// Diekspor ulang supaya pemanggil punya SATU jalur impor: apa pun yang dipakai
// bersama <Badge> datang dari './ui', tidak setengah dari sini dan setengah
// dari './status-marker'. Definisinya tetap di berkasnya sendiri.
export { StatusMarker, CONDITION_BADGE, type StatusMarkerShape } from './status-marker';

const colors = {
  ...designColors,
  background: designColors.bg,
  backgroundDeep: designColors.surfaceMuted,
  muted: designColors.textMuted,
  primaryPressed: designColors.primaryDark,
  successSurface: designColors.successBg,
  dangerSurface: designColors.dangerBg,
  warningSurface: designColors.warningBg,
};

export const appTheme = {
  ...theme.colors,
  background: designColors.bg,
  backgroundDeep: designColors.surfaceMuted,
  muted: designColors.textMuted,
  primaryPressed: designColors.primaryDark,
  successSurface: designColors.successBg,
  dangerSurface: designColors.dangerBg,
  warningSurface: designColors.warningBg,
};

// Disediakan HANYA oleh Screen yang opt-in lewat autoScrollOnFocus. Nilai null
// (bawaan, dan yang dikirim Screen non-opt-in) berarti Field tidak melakukan
// apa pun saat difokus — persis seperti sebelum mekanisme ini ada.
type AutoScrollContextValue = {
  requestScrollIntoView: (node: React.ComponentRef<typeof View> | null) => void;
};

const AutoScrollContext = React.createContext<AutoScrollContextValue | null>(null);

// Padding bar aksi: 14 atas, 20 samping, 18 bawah. Sisi samping mengikuti
// padding tepi layar supaya tombol di dalam bar sejajar dengan isi di atasnya.
const ACTION_BAR_PADDING_TOP = 14;
const ACTION_BAR_PADDING_BOTTOM = 18;

// Perkiraan ruang bawah yang dipakai HANYA pada frame pertama, sebelum bar
// sempat diukur onLayout. Bukan angka ajaib: satu tombol utama setinggi 56 +
// padding atas-bawah bar + satu jarak.
const ACTION_BAR_FALLBACK_RESERVE =
  tokens.layout.controlHeight + ACTION_BAR_PADDING_TOP + ACTION_BAR_PADDING_BOTTOM + tokens.space.lg;

// Mengubah token warna heksadesimal jadi rgba beralfa.
//
// Dipakai untuk ujung ATAS gradasi footer. Sengaja TIDAK memakai literal
// 'transparent': di iOS 'transparent' ditafsirkan sebagai hitam-alfa-nol,
// sehingga gradasinya melewati abu-abu dan memunculkan pita kotor di tengah.
// Warna latar yang sama dengan alfa 0 membuat kedua ujung gradasi berada di
// hue yang sama, jadi yang berubah hanya opasitasnya.
//
// Hanya menerima heksadesimal 6 digit — itu bentuk semua token warna di
// theme.ts. Kalau kelak ada token 3 digit atau rgba, fungsi ini harus ikut
// disesuaikan.
/**
 * NOL PEMAKAIAN sejak batch 1b — satu-satunya pemanggilnya adalah pita gradasi
 * di atas bar aksi, yang dicabut bersama gradasinya.
 *
 * Sengaja tidak dihapus: ia ekspor publik, dan membuang ekspor dilarang
 * batasan keras batch ini. Fungsinya juga masih benar dan murah.
 */
export function withAlpha(hexColor: string, alpha: number): string {
  const normalized = hexColor.replace('#', '');
  const red = parseInt(normalized.slice(0, 2), 16);
  const green = parseInt(normalized.slice(2, 4), 16);
  const blue = parseInt(normalized.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export function Screen({
  applyTopInset = false,
  autoScrollOnFocus = false,
  children,
  floatingAction,
  floatingActionBottom = 24,
  footer,
  header,
  contentStyle,
  scrollRef,
  variant = 'default',
  stickyFooter,
}: {
  // Safe-area atas normalnya diterapkan TopAppBar, bukan Screen (lihat komentar
  // pada slot `header` di bawah). Layar yang TIDAK punya TopAppBar sama sekali —
  // baik lewat slot `header` maupun sebagai children — jadi tidak punya siapa pun
  // yang menerapkannya, dan konten paling atasnya menabrak status bar. Prop ini
  // untuk kasus itu.
  //
  // SENGAJA opt-in, default false. Kalau otomatis menyala saat `header` kosong,
  // layar yang menaruh TopAppBar sebagai children akan kena inset DUA KALI —
  // sekali dari sini, sekali dari TopAppBar-nya sendiri.
  applyTopInset?: boolean;
  // Saat true, Screen menyediakan AutoScrollContext sehingga Field yang difokus
  // digulung ke dalam pandangan kalau tertutup keyboard. SENGAJA opt-in: default
  // false berarti context bernilai null dan Field tidak berubah perilakunya.
  autoScrollOnFocus?: boolean;
  children: React.ReactNode;
  floatingAction?: React.ReactNode;
  floatingActionBottom?: number;
  footer?: React.ReactNode;
  header?: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  scrollRef?: React.RefObject<ScrollView | null>;
  variant?: 'default' | 'soft' | 'surface';
  stickyFooter?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  // SATU bar aksi, dua nama prop. `footer` dulu dirender sebagai anak TERAKHIR
  // di dalam ScrollView sehingga ia ikut menggulir, sementara `stickyFooter`
  // menempel di dasar layar — dua mekanisme untuk satu hal, dan akibatnya
  // posisi bar aksi berpindah-pindah antarlayar. Sejak batch 1b keduanya
  // melewati jalur yang sama dan menempel.
  //
  // Kedua nama dipertahankan: 9 layar memanggil `footer`, 17 memanggil
  // `stickyFooter`, dan mengganti nama prop dilarang batasan keras. Tidak ada
  // satu pun berkas yang mengirim keduanya, jadi `??` tidak pernah menyembunyikan
  // apa pun; kalau kelak ada, `footer` yang menang.
  const actionBar = footer ?? stickyFooter;
  const hasActionBar = Boolean(actionBar);
  const keyboard = useKeyboardMetrics();
  const backgroundColor =
    variant === 'surface' ? colors.surface : variant === 'soft' ? colors.backgroundDeep : colors.background;
  // Tinggi bar aksi diukur, bukan ditebak. 0 berarti belum sempat diukur.
  const [actionBarHeight, setActionBarHeight] = React.useState(0);

  // Window tidak menyusut saat keyboard naik (adjustResize tidak berlaku di Android
  // edge-to-edge), jadi stickyFooter yang position:absolute harus diangkat manual.
  //
  // Dipakai `screenY`, BUKAN `height`. Di ReactRootView.java (checkForKeyboardEvents,
  // API >= 30) `height = imeInsets.bottom - barInsets.bottom` — RN sudah mengurangi
  // system bar, jadi angkanya lebih kecil dari keyboard yang digambar. `screenY`
  // (= mVisibleViewArea.bottom, koordinat display) tidak kena pengurangan itu, maka
  // pasangannya tinggi 'screen', bukan 'window' yang juga memotong system bar.
  //
  // ASUMSI: sisi bawah root view berimpit dengan sisi bawah display. Berlaku di
  // edge-to-edge. UJI ULANG saat pertama kali pindah dari Expo Go ke dev build atau
  // APK rilis: kalau ternyata berjalan tanpa edge-to-edge, root berhenti di atas nav
  // bar dan rumus lama (ime - navBar, yaitu `height`) yang benar.
  const screenHeight = Dimensions.get('screen').height;
  const keyboardVisible = keyboard.height > 0;
  // screenY 0/absen berarti data tidak bisa dipakai — jangan menebak, kembali ke
  // perilaku lama apa adanya.
  const screenYBasisActive = keyboardVisible && keyboard.screenY > 0;
  // Satu-satunya rumus pengukuran overlap keyboard, dipakai bersama oleh jalur
  // stickyFooter dan jalur non-sticky. SENGAJA tidak ada cara pengukuran kedua.
  const keyboardOverlap = screenYBasisActive
    ? Math.max(0, screenHeight - keyboard.screenY)
    : keyboardVisible
      ? Math.max(0, keyboard.height - insets.bottom)
      : 0;
  // Hanya bar aksi yang perlu DIANGKAT (position:absolute).
  const keyboardLift = hasActionBar ? keyboardOverlap : 0;
  // Overlap sudah dihitung sampai dasar display, jadi insets.bottom TIDAK dikurangi
  // lagi di sini — nav bar tertutup keyboard, ruang untuknya tidak relevan. Saat
  // keyboard tertutup padding kembali ke ruang aman perangkat, minimal 18.
  //
  // 18 bawah vs 14 atas (ACTION_BAR_PADDING_TOP): asimetris dan disengaja. Sisi
  // bawah bar berbatasan dengan tepi layar atau nav bar, sisi atasnya dengan
  // garis pemisah — tepi butuh ruang lebih banyak daripada garis supaya tombol
  // tidak terbaca menempel ke dasar perangkat.
  const actionBarPaddingBottom = screenYBasisActive
    ? ACTION_BAR_PADDING_BOTTOM
    : Math.max(insets.bottom, ACTION_BAR_PADDING_BOTTOM);
  // Ruang bawah yang harus dikosongkan konten scroll supaya isi TERAKHIR tidak
  // tertutup bar aksi yang menempel di atasnya.
  //
  // Tidak ada lagi pita gradasi yang ikut dihitung: bar kini buram dan bergaris
  // atas, jadi batasnya tegas dan konten tinggal berhenti tepat di atasnya.
  const actionBarReserve =
    actionBarHeight > 0 ? actionBarHeight + tokens.space.lg : ACTION_BAR_FALLBACK_RESERVE + insets.bottom;

  // keyboardOverlap, bukan keyboardLift: layar tanpa bar aksi juga perlu ruang
  // bawah supaya field yang tertutup keyboard bisa digulung naik.
  const overlayBottomPadding =
    (hasActionBar ? actionBarReserve : floatingAction ? 132 : tokens.space.xxxl) + keyboardOverlap;

  // Ref internal dipakai kalau pemanggil tidak mengoper scrollRef sendiri, supaya
  // auto-scroll tetap punya pegangan ke ScrollView. Untuk layar yang mengoper
  // scrollRef, objeknya sama persis seperti sebelumnya.
  const internalScrollRef = React.useRef<ScrollView | null>(null);
  const resolvedScrollRef = scrollRef ?? internalScrollRef;
  const scrollOffsetRef = React.useRef(0);
  const focusedNodeRef = React.useRef<React.ComponentRef<typeof View> | null>(null);

  const scrollFocusedNodeIntoView = React.useCallback(() => {
    const node = focusedNodeRef.current;
    const scrollView = resolvedScrollRef.current;

    if (!node || !scrollView || keyboardOverlap <= 0) {
      return;
    }

    node.measureInWindow((_x, y, _width, height) => {
      const keyboardTop = screenHeight - keyboardOverlap;
      const hiddenAmount = y + height - keyboardTop;

      // Field sudah terlihat penuh → JANGAN bergerak sama sekali. Penjaga ini
      // wajib, bukan optimasi: di dev build window bisa benar-benar menyusut
      // dan auto-scroll bawaan ReactScrollView ikut menyala. Tanpa penjaga,
      // dua mekanisme menggulung layar yang sama dan hasilnya loncat dobel.
      if (hiddenAmount <= 0) {
        return;
      }

      scrollView.scrollTo({
        animated: true,
        y: scrollOffsetRef.current + hiddenAmount + tokens.space.lg,
      });
    });
  }, [keyboardOverlap, resolvedScrollRef, screenHeight]);

  // requestAnimationFrame, bukan setTimeout dengan angka tebakan: paddingBottom
  // baru saja tumbuh sebesar keyboardOverlap, jadi mengukur di frame yang sama
  // masih membaca layout lama. Satu frame adalah penundaan terkecil yang cukup.
  React.useEffect(() => {
    if (!autoScrollOnFocus || keyboardOverlap <= 0) {
      return;
    }

    const frame = requestAnimationFrame(scrollFocusedNodeIntoView);

    return () => cancelAnimationFrame(frame);
  }, [autoScrollOnFocus, keyboardOverlap, scrollFocusedNodeIntoView]);

  const autoScrollValue = React.useMemo<AutoScrollContextValue>(
    () => ({
      requestScrollIntoView: (node) => {
        focusedNodeRef.current = node;
        // Fokus saat keyboard SUDAH terbuka tidak memicu effect di atas
        // (keyboardOverlap tidak berubah), jadi percobaan langsung tetap perlu.
        requestAnimationFrame(scrollFocusedNodeIntoView);
      },
    }),
    [scrollFocusedNodeIntoView]
  );

  const screenBody = (
    <View style={{ flex: 1, backgroundColor }}>
      {header ? (
        // Header fixed (tidak menggulung): sibling di atas ScrollView, di dalam
        // View flex:1 terluar. Duduk di background variant yang sama (0.3) supaya
        // tak belang; tanpa shadow, tanpa onScroll. Inset atas TIDAK diterapkan
        // di sini — TopAppBar di dalam `header` yang menerapkannya (ui.tsx
        // TopAppBar), agar tidak dobel (0.1/safe-area).
        //
        // TANPA garis pemisah bawah. Latar header dan latar konten memang warna
        // yang sama, jadi hairline itulah satu-satunya hal yang memotong layar
        // jadi dua bidang — padahal judul layar bagian dari halaman, bukan chrome
        // yang berdiri sendiri di atasnya. Padding dan tinggi header tidak
        // berubah: yang hilang hanya garisnya, di semua layar tanpa kecuali.
        <View
          style={{
            backgroundColor,
            paddingHorizontal: spacing.screenHorizontal,
          }}
        >
          {header}
        </View>
      ) : null}
      <ScrollView
        ref={resolvedScrollRef}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        // onScroll hanya dipasang untuk layar opt-in; layar lain tetap tanpa
        // handler scroll sama sekali, seperti sebelumnya.
        onScroll={
          autoScrollOnFocus
            ? (event) => {
                scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
              }
            : undefined
        }
        scrollEventThrottle={autoScrollOnFocus ? 16 : undefined}
        style={{ flex: 1, backgroundColor }}
        contentContainerStyle={[
          {
            flexGrow: 1,
            paddingHorizontal: spacing.screenHorizontal,
            // insets.top mentah, bukan Math.max(...): saat inset 0 hasilnya kembali
            // persis ke nilai lama, jadi prop ini tidak pernah menggeser apa pun
            // di perangkat tanpa status bar yang mengintip.
            paddingTop: spacing.xl + (applyTopInset ? insets.top : 0),
            gap: spacing.sectionGap,
            paddingBottom: overlayBottomPadding,
          },
          contentStyle,
        ]}
      >
        {/* flexGrow, BUKAN flex. `flex: 1` di RN berarti flexBasis: 0, sehingga
            pembungkus ini menyumbang NOL ke tinggi natural content container dan
            tingginya selalu jadi sisa ruang — konten tidak pernah bisa melampaui
            viewport, jadi ScrollView tidak punya apa pun untuk digulung. Yoga juga
            tidak punya `min-height: auto` seperti browser, jadi tidak ada jaring
            pengaman yang memaksa overflow. Dengan flexGrow: 1 (flexBasis auto
            bawaan) pembungkus tetap memenuhi layar saat konten pendek — itu yang
            menjaga justifyContent 'center' tetap bekerja — tapi boleh tumbuh
            melewati viewport saat konten panjang, dan barulah bisa di-scroll. */}
        {/* `footer` TIDAK lagi dirender di sini. Ia dulu anak terakhir di dalam
            ScrollView, sehingga ikut menggulir dan baru terlihat setelah
            pengguna menggulung sampai dasar. Sekarang ia keluar sebagai saudara
            ScrollView, di bawah. */}
        <View style={{ flexGrow: 1, gap: spacing.sectionGap }}>{children}</View>
      </ScrollView>
      {hasActionBar ? (
        // Bar aksi. Menempel di dasar layar sebagai SAUDARA ScrollView, bukan
        // anak di dalamnya — posisinya karena itu sama di semua layar, apa pun
        // panjang isinya.
        //
        // Pita gradasi yang dulu ada di sini DICABUT. Ia memudarkan konten ke
        // warna latar supaya batas bar terbaca tanpa garis; sekarang bar punya
        // latar buram sendiri dan garis atas 1px, jadi batasnya sudah tegas dan
        // gradasinya tinggal menghabiskan 56px ruang tanpa menambah apa pun.
        //
        // `bottom: keyboardLift` dipertahankan apa adanya. Jangan diutak-atik:
        // rumusnya memakai `screenY`, bukan `height`, dan itu sudah dibetulkan
        // dengan susah payah (lihat catatan panjang di atas).
        <View
          onLayout={(event) => setActionBarHeight(event.nativeEvent.layout.height)}
          style={{
            backgroundColor: palette.surfaceRaised,
            // Garis ATAS saja. Bar duduk di tepi bawah layar, jadi tiga sisinya
            // yang lain tidak berbatasan dengan apa pun yang perlu dipisahkan.
            borderTopColor: palette.border,
            borderTopWidth: 1,
            bottom: keyboardLift,
            left: 0,
            paddingBottom: actionBarPaddingBottom,
            paddingHorizontal: spacing.screenHorizontal,
            paddingTop: ACTION_BAR_PADDING_TOP,
            position: 'absolute',
            right: 0,
          }}
        >
          {actionBar}
        </View>
      ) : null}
      {floatingAction ? (
        <View style={{ bottom: floatingActionBottom, position: 'absolute', right: spacing.screenHorizontal }}>
          {floatingAction}
        </View>
      ) : null}
    </View>
  );

  // Layar non-opt-in tidak dibungkus provider sama sekali, jadi Field di
  // dalamnya membaca context bawaan (null) dan tidak berperilaku beda sedikit
  // pun. Provider sendiri tidak merender host view, jadi tata letak yang opt-in
  // juga tidak bergeser.
  return autoScrollOnFocus ? (
    <AutoScrollContext.Provider value={autoScrollValue}>{screenBody}</AutoScrollContext.Provider>
  ) : (
    screenBody
  );
}

type KeyboardMetrics = {
  height: number;
  screenY: number;
};

const CLOSED_KEYBOARD: KeyboardMetrics = { height: 0, screenY: 0 };

// Tinggi keyboard dari React Native core (tanpa dependensi tambahan, aman di
// Expo Go). Android hanya mengirim pasangan did-show/did-hide — will-* tidak
// pernah dikirim di sana. iOS memakai will-show/will-hide supaya pergeseran
// footer berjalan bersamaan dengan animasi keyboard, bukan setelahnya.
//
// Listener dipasang untuk SEMUA layar, bukan hanya yang punya stickyFooter:
// jalur non-sticky juga butuh angkanya untuk mencadangkan ruang bawah. Ongkosnya
// satu render ulang per Screen saat keyboard buka/tutup — layar tanpa TextInput
// membayarnya percuma, tapi itu jauh lebih murah daripada menebak-nebak layar
// mana yang butuh dan salah menebak.
function useKeyboardMetrics(): KeyboardMetrics {
  const [metrics, setMetrics] = React.useState<KeyboardMetrics>(CLOSED_KEYBOARD);

  React.useEffect(() => {
    function handleShow(event: KeyboardEvent) {
      setMetrics({
        height: event.endCoordinates?.height ?? 0,
        screenY: event.endCoordinates?.screenY ?? 0,
      });
    }

    function handleHide() {
      setMetrics(CLOSED_KEYBOARD);
    }

    const subscriptions =
      Platform.OS === 'ios'
        ? [
            Keyboard.addListener('keyboardWillShow', handleShow),
            Keyboard.addListener('keyboardWillHide', handleHide),
          ]
        : [
            Keyboard.addListener('keyboardDidShow', handleShow),
            Keyboard.addListener('keyboardDidHide', handleHide),
          ];

    return () => {
      subscriptions.forEach((subscription) => subscription.remove());
    };
  }, []);

  return metrics;
}

export function PageIntro({
  align = 'left',
  title,
  subtitle,
}: {
  // Default 'left' = perilaku lama PERSIS. Saat 'left', alignItems dan textAlign
  // dibiarkan undefined, bukan disetel ke nilai kiri yang eksplisit — undefined
  // membuat Yoga memakai bawaannya ('stretch' dan awal-baris), yaitu keadaan
  // sebelum prop ini ada. Layar non-auth yang memakai PageIntro tanpa prop ini
  // (onboarding, tasks, growth-monitoring) karena itu tidak bergeser sedikit pun.
  //
  // 'center' butuh KEDUANYA: alignItems memusatkan kotak Text yang menyusut ke
  // lebar isinya, textAlign memusatkan barisnya saat judul atau subjudul pecah
  // jadi dua baris. Salah satu saja meninggalkan kasus yang tidak terpusat.
  align?: 'left' | 'center';
  title: string;
  subtitle?: string;
}) {
  const centered = align === 'center';
  const textAlign = centered ? ('center' as const) : undefined;

  return (
    <View
      style={{
        alignItems: centered ? 'center' : undefined,
        gap: spacing.sm,
        paddingTop: spacing.xs,
      }}
    >
      <Text
        selectable
        style={{
          color: colors.text,
          // Berat dibawa keluarga huruf. Android tidak mensintesis berat untuk
          // font kustom, jadi `fontWeight` di sebelah `fontFamily` tidak berguna
          // dan pada sebagian perangkat memicu fallback ke muka huruf yang salah.
          // typography.h1.fontWeight ('700') sengaja tidak diganti fonts kustom
          // berbobot 700 — yang dimuat hanya 400 dan 600, dan 600 itulah yang
          // dipakai di sini lewat fonts.sansSemiBold.
          fontFamily: fonts.sansSemiBold,
          fontSize: typography.h1.fontSize,
          letterSpacing: 0,
          lineHeight: typography.h1.lineHeight,
          textAlign,
        }}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text
          selectable
          style={{
            color: colors.muted,
            fontFamily: fonts.sans,
            fontSize: typography.body.fontSize,
            lineHeight: 24,
            textAlign,
          }}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

// Lebar slot kiri dan kanan pada header "layar lain". Keduanya WAJIB sama:
// slot kanan dibiarkan kosong justru supaya judul di antara keduanya benar-benar
// berada di tengah layar, bukan di tengah sisa ruang setelah tombol kembali.
// Begitu keduanya berbeda, judul bergeser sebesar selisihnya.
const BACK_SLOT_SIZE = 48;

export function TopAppBar({
  right,
  subtitle,
  title,
  titleContent,
  onBack,
  variant,
}: {
  right?: React.ReactNode;
  subtitle?: string;
  // Mengisi SLOT judul dengan elemen, bukan teks — dipakai layar pra-kebun yang
  // menaruh baris merek di sana alih-alih judul layar. Kalau diisi, `title`
  // diabaikan; kalau tidak, tidak ada satu pun perilaku lama yang bergeser.
  titleContent?: React.ReactNode;
  // Opsional supaya layar bisa memakai bar ini murni sebagai baris tombol back,
  // dengan judul ditangani PageIntro di badan layar (pola layar auth). Tinggi bar
  // TIDAK bergantung pada judul — baris di bawah sudah punya minHeight 56 eksplisit
  // yang selalu lebih besar dari lineHeight judul (26) maupun tombol back (32) —
  // jadi menghilangkan judul tidak membuat bar menyusut.
  title?: string;
  onBack?: () => void;
  variant?: 'main' | 'detail' | 'plain';
}) {
  const insets = useSafeAreaInsets();
  const resolvedVariant = variant ?? (onBack ? 'detail' : 'plain');
  const isMain = resolvedVariant === 'main';
  // SELURUH varian kini rata tengah, termasuk 'main'. Lihat catatan panjang di
  // atas MainTabHeader untuk alasannya.
  const titleAlign = 'center';
  // Lebar slot kanan, DIUKUR bukan ditebak. Ini yang membedakan varian 'main'
  // dari dua varian lain: 'detail' dan 'plain' hanya pernah menaruh benda
  // berukuran tetap 32x32 di kedua sisi, jadi penyeimbangnya boleh ditulis
  // sebagai angka. Slot kanan 'main' berisi apa pun yang dikirim pemanggil —
  // hari ini sebuah ChipButton "Tambah" yang lebarnya mengikuti panjang
  // labelnya — dan penyeimbang bernilai tebakan akan menggeser judul sebanyak
  // selisihnya. Ongkosnya satu render ulang saat pemasangan, dan hanya pada
  // layar yang benar-benar mengirim `right`.
  const [rightSlotWidth, setRightSlotWidth] = React.useState(0);

  return (
    <View style={{ gap: subtitle ? spacing.sm : 0, paddingTop: Math.max(insets.top, spacing.sm) }}>
      <View
        style={{
          alignItems: 'center',
          flexDirection: 'row',
          gap: spacing.sm,
          justifyContent: 'space-between',
          minHeight: 56,
        }}
      >
        {onBack ? (
          // Label WAJIB ditulis: isinya hanya ikon panah tanpa teks, jadi
          // tanpa ini TalkBack membacakannya sebagai elemen tanpa nama. Mengikuti
          // ProfileIconButton dan toggle PasswordField yang sudah benar.
          //
          // KOTAK BERGARIS DICABUT di batch 1b. Tombol kembali bukan tombol
          // yang perlu menonjol — ia afordans navigasi yang sudah dikenal, dan
          // membingkainya dengan kotak 32x32 bergaris membuatnya menuntut
          // perhatian yang sama besar dengan aksi utama layar. Yang tersisa
          // ikonnya saja, di dalam slot 48 yang tetap memenuhi target sentuh.
          <Pressable
            accessibilityLabel="Kembali"
            accessibilityRole="button"
            onPress={onBack}
            style={({ pressed }) => ({
              alignItems: 'center',
              height: BACK_SLOT_SIZE,
              justifyContent: 'center',
              // Digeser ke kiri sebesar selisih slot dan ikon, supaya ikonnya
              // sejajar dengan tepi kiri konten layar. Tanpa ini slot 48 yang
              // menengahkan ikon 24 membuat panah menjorok 12px ke dalam,
              // sementara seluruh isi layar di bawahnya rata di tepi 20.
              marginLeft: -((BACK_SLOT_SIZE - tokens.icon.lg) / 2),
              opacity: pressed ? 0.6 : 1,
              width: BACK_SLOT_SIZE,
            })}
          >
            {/* Panah, bukan chevron. Pengguna Android mengharapkan panah untuk
                "kembali"; chevron adalah kosakata iOS. Mengganti afordans
                navigasi bukan pekerjaan redesign visual. */}
            <Icon name="arrow-left" size={tokens.icon.lg} color={palette.textPrimary} />
          </Pressable>
        ) : isMain ? (
          // Penyeimbang kiri selebar slot kanan. Saat `right` tidak dikirim
          // lebarnya 0, dan judul yang flex:1 di antara dua tepi nol tetap duduk
          // persis di tengah — jadi cabang ini benar untuk kedua keadaan tanpa
          // syarat tambahan.
          <View style={{ height: BACK_SLOT_SIZE, width: rightSlotWidth }} />
        ) : (
          <View style={{ height: BACK_SLOT_SIZE, width: BACK_SLOT_SIZE }} />
        )}
        <View
          style={{
            alignItems: 'center',
            flex: 1,
            minWidth: 0,
          }}
        >
          {/* Satu jalur judul saja. Slot `badge` dicabut bersama nama kebun di
              MainTabHeader — ia satu-satunya pengirimnya, jadi cabang kedua di
              sini tidak akan pernah menyala lagi. */}
          {titleContent ?? (title === undefined ? null : (
            <Text
              selectable
              numberOfLines={1}
              style={{
                color: palette.textPrimary,
                // 17 rata tengah untuk SEMUA varian, turun dari 20/screenTitle.
                // Judul di sini menamai tempat, bukan membuka halaman — ia tidak
                // perlu sebesar judul layar root tab (26) yang memang jadi elemen
                // teratas halamannya.
                //
                // Berat dibawa keluarga huruf; fontWeight dicabut.
                fontFamily: fonts.sansSemiBold,
                fontSize: 17,
                lineHeight: 23,
                textAlign: titleAlign,
              }}
            >
              {title}
            </Text>
          ))}
        </View>
        {right ? (
          // Pembungkus HANYA untuk mengukur. Ia tidak menetapkan lebar maupun
          // flex, jadi isinya tetap selebar dirinya sendiri persis seperti
          // sebelum pembungkus ini ada.
          <View onLayout={(event) => setRightSlotWidth(event.nativeEvent.layout.width)}>{right}</View>
        ) : (
          // Slot kanan kosong selebar slot kembali. Ia TIDAK punya isi dan itu
          // memang tugasnya: ia penyeimbang, satu-satunya yang membuat judul
          // duduk di tengah layar dan bukan di tengah sisa ruang.
          <View style={{ height: BACK_SLOT_SIZE, width: isMain ? 0 : BACK_SLOT_SIZE }} />
        )}
      </View>
      {subtitle ? (
        <Text
          selectable
          style={{
            color: colors.muted,
            fontSize: 15,
            lineHeight: 22,
            textAlign: titleAlign,
          }}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

export function ProfileIconButton({
  label = 'Profil Akun',
  onPress,
}: {
  label?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      hitSlop={{ bottom: 8, left: 8, right: 8, top: 8 }}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: 'center',
        backgroundColor: pressed ? colors.primarySoft : colors.surface,
        borderColor: colors.border,
        borderCurve: 'continuous',
        borderRadius: 11,
        borderWidth: 1,
        height: 32,
        justifyContent: 'center',
        width: 32,
      })}
    >
      <Icon name="user" size={20} color={colors.primary} />
    </Pressable>
  );
}

// Header layar utama: judul layar, RATA TENGAH, titik. Tidak ada tombol profil
// (Profil punya itemnya sendiri di bottom nav), tidak ada badge peran (peran
// tidak berubah sepanjang sesi), dan tidak lagi ada nama kebun.
//
// RATA TENGAH, BUKAN RATA KIRI — dan ini pembalikan aturan, jadi ditulis di
// sini sekali untuk kelima destinasi yang memakainya.
//
// Aturan lama berbunyi: judul rata tengah membuat sebuah tab terlihat seperti
// layar turunan, karena rata tengah dipakai varian 'detail' yang selalu
// berpasangan dengan chevron kembali. Yang membuat sebuah layar terbaca sebagai
// turunan ternyata CHEVRON-nya, bukan perataannya — dan chevron itu memang tidak
// pernah ada di sini. Tanpa chevron, judul rata tengah terbaca sebagai judul
// halaman, sama seperti di hampir setiap aplikasi bertab.
//
// Yang menahannya benar-benar di tengah adalah penyeimbang kiri selebar slot
// kanan, DIUKUR di TopAppBar. Tanpa itu, satu-satunya layar yang mengisi slot
// kanan (Perawatan sisi pemilik, dengan chip "Tambah") akan punya judul yang
// meleset ke kiri sebanyak lebar chipnya — dan empat destinasi lain tidak,
// sehingga judulnya berpindah tempat saat berganti tab.
//
// `right` diteruskan APA ADANYA ke slot kanan TopAppBar — tanpa style tambahan.
// Layar yang mengisinya bertanggung jawab atas ukuran dan flexShrink isinya,
// karena hanya layar itu yang tahu seberapa penting isinya dibanding judulnya
// sendiri. Satu-satunya yang ditambahkan TopAppBar adalah pembungkus tanpa gaya
// untuk mengukur lebarnya.
//
// Slot ini menggantikan FAB di layar yang punya satu aksi "tambah": FAB melayang
// di atas daftar dan menutupi baris terakhir, sementara di sini aksinya duduk
// sebaris dengan judul, di tempat yang tetap.
export function MainTabHeader({ right, title }: { right?: React.ReactNode; title: string }) {
  return <TopAppBar right={right} title={title} variant="main" />;
}

// showWordmark=false menyisakan kotak logo saja. Dipakai layar yang judulnya
// sudah ditangani <PageIntro> di badan layar, supaya "Avology" tidak tercetak
// dua kali dengan dua tagline berbeda. Default true — bentuk lama utuh.
// `align` sengaja TIDAK punya nilai default sendiri: kalau tidak diisi, perataan
// jatuh kembali ke aturan lama (compact = kiri, selain itu tengah), jadi arti
// `compact` yang sudah ada tidak bergeser. Mengisi `align` memisahkan perataan
// dari ukuran, sehingga bisa dapat kotak ukuran penuh yang rata kiri.
// `inline` adalah ukuran KETIGA, di bawah compact (52) dan default (72): logo 28
// berdampingan mendatar dengan wordmark kecil, tanpa tagline. Ia dipakai sebagai
// baris merek di dalam app bar layar pra-kebun — di sana merek harus hadir
// sebagai penanda "aplikasi apa ini", bukan sebagai blok sambutan.
//
// Dikerjakan lewat cabang keluar lebih awal, bukan dengan menyisipkan syarat ke
// dalam susunan yang sudah ada: dengan begitu jalur compact dan default di bawah
// sama sekali tidak tersentuh, termasuk perhitungan `align` dan `showWordmark`.
export function BrandMark({
  align,
  compact = false,
  inline = false,
  showWordmark = true,
}: {
  align?: 'left' | 'center';
  compact?: boolean;
  inline?: boolean;
  showWordmark?: boolean;
}) {
  if (inline) {
    return <InlineBrandMark />;
  }

  const alignItems = (align ?? (compact ? 'left' : 'center')) === 'left' ? 'flex-start' : 'center';

  return (
    <View style={{ alignItems, gap: spacing.md }}>
      <View
        style={{
          alignItems: 'center',
          backgroundColor: palette.accent,
          borderColor: colors.primaryBorder,
          borderCurve: 'continuous',
          borderRadius: compact ? radius.lg : radius['2xl'],
          borderWidth: 1,
          height: compact ? 52 : 72,
          justifyContent: 'center',
          width: compact ? 52 : 72,
        }}
      >
        <Image
          // icon.png sudah membawa latar hijaunya sendiri, jadi backgroundColor
          // kotak di atas tinggal berfungsi sebagai fallback kalau aset gagal
          // dimuat — dalam keadaan normal ia tertutup penuh oleh gambar.
          source={require('../../assets/icon.png')}
          style={{
            borderRadius: compact ? radius.lg : radius['2xl'],
            height: '100%',
            width: '100%',
          }}
        />
      </View>
      {showWordmark ? (
        <View style={{ alignItems, gap: spacing.xs }}>
          <Text selectable style={{ color: colors.text, fontSize: compact ? 20 : 24, fontWeight: '700' }}>
            Avology
          </Text>
          <Text selectable style={{ color: colors.muted, fontSize: 13, fontWeight: '700' }}>
            Operasional kebun alpukat
          </Text>
        </View>
      ) : null}
    </View>
  );
}

// Tanpa tagline: di app bar hanya ada ruang untuk menyebut nama, dan tagline yang
// dipadatkan ke satu baris bersama logo akan terbaca sebagai judul layar.
const INLINE_BRAND_LOGO = 28;

function InlineBrandMark() {
  return (
    <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.sm }}>
      <View
        style={{
          alignItems: 'center',
          backgroundColor: palette.accent,
          borderColor: colors.primaryBorder,
          borderCurve: 'continuous',
          borderRadius: radius.sm,
          borderWidth: 1,
          height: INLINE_BRAND_LOGO,
          justifyContent: 'center',
          width: INLINE_BRAND_LOGO,
        }}
      >
        <Image
          source={require('../../assets/icon.png')}
          style={{ borderRadius: radius.sm, height: '100%', width: '100%' }}
        />
      </View>
      <Text selectable style={{ color: colors.text, fontSize: typography.body.fontSize, fontWeight: '700' }}>
        Avology
      </Text>
    </View>
  );
}

export function SectionHeader({
  actionLabel,
  children,
  description,
  onActionPress,
  subtitle,
  title,
}: {
  actionLabel?: string;
  children?: React.ReactNode;
  description?: string;
  onActionPress?: () => void;
  subtitle?: string;
  title: string;
}) {
  const helperText = description ?? subtitle;

  return (
    <View style={{ gap: spacing.xs, paddingTop: spacing.xs }}>
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.md, justifyContent: 'space-between' }}>
        <Text
          selectable
          style={{
            color: colors.text,
            flex: 1,
            // Tanpa fontWeight — berat dibawa keluarga huruf.
            fontFamily: fonts.sansSemiBold,
            fontSize: typography.h3.fontSize,
            lineHeight: typography.h3.lineHeight,
          }}
        >
          {title}
        </Text>
        {actionLabel && onActionPress ? (
          <Pressable onPress={onActionPress} style={{ paddingHorizontal: spacing.xs, paddingVertical: spacing.xs }}>
            <Text selectable style={{ color: colors.primary, fontSize: 13, fontWeight: '700' }}>
              {actionLabel}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {helperText ? (
        <Text selectable style={{ color: colors.muted, lineHeight: typography.small.lineHeight }}>
          {helperText}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

export function Card({
  children,
  padding = spacing.cardPadding,
  style,
  variant = 'default',
}: {
  children: React.ReactNode;
  padding?: number;
  style?: StyleProp<ViewStyle>;
  variant?: 'default' | 'highlight' | 'softGreen' | 'heroGreen' | 'warning' | 'danger' | 'info';
}) {
  const cardStyle = getCardVariantStyle(variant);

  return (
    <View
      style={[
        {
          ...cardStyle,
          borderCurve: 'continuous',
          borderRadius: tokens.radius.card,
          borderWidth: 1,
          gap: spacing.md,
          padding,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export type BadgeTone = 'danger' | 'info' | 'muted' | 'neutral' | 'pending' | 'success' | 'warning';

export const badgeColors: Record<BadgeTone, { background: string; border: string; text: string }> = {
  danger: {
    background: statusColors.danger.background,
    border: statusColors.danger.border,
    text: statusColors.danger.text,
  },
  info: {
    background: statusColors.info.background,
    border: statusColors.info.border,
    text: statusColors.info.text,
  },
  muted: {
    background: statusColors.neutral.background,
    border: statusColors.neutral.border,
    text: statusColors.neutral.text,
  },
  neutral: {
    background: statusColors.neutral.background,
    border: statusColors.neutral.border,
    text: statusColors.neutral.text,
  },
  pending: {
    background: statusColors.pending.background,
    border: statusColors.pending.border,
    text: statusColors.pending.text,
  },
  success: {
    background: statusColors.success.background,
    border: statusColors.success.border,
    text: statusColors.success.text,
  },
  warning: {
    background: statusColors.warning.background,
    border: statusColors.warning.border,
    text: statusColors.warning.text,
  },
};

// `size` default 'sm' — nilainya SAMA PERSIS dengan angka yang dulu ditulis
// langsung di sini, jadi seluruh badge yang sudah ada tidak bergeser satu piksel
// pun. 'md' hanya untuk badge yang harus mengimbangi teks yang lebih besar di
// sebelahnya, seperti kode pohon di baris daftar.
/**
 * Tampilan eksplisit yang menimpa pemetaan `tone`. `border: null` berarti chip
 * tanpa garis sama sekali, bukan garis berwarna latar.
 */
export type BadgeAppearance = {
  background: string;
  border: string | null;
  text: string;
};

export function Badge({
  appearance,
  label,
  marker,
  markerColor,
  maxWidth = 128,
  size = 'sm',
  status,
  tone = 'muted',
}: {
  /**
   * Menimpa latar, garis, dan warna teks yang biasanya datang dari `tone`.
   *
   * ADA KARENA `tone` tidak sanggup menyatakan tabel kondisi pohon: enam
   * kondisi memetakan ke hanya tiga BadgeTone (success/warning/danger/muted),
   * sehingga Hama, Sakit, dan Rusak menjadi chip yang identik. Memperlebar
   * BadgeTone akan mengubah arti tone bagi 20 pemanggil lain yang tidak ada
   * urusannya dengan pohon.
   *
   * Tanpa nilai, jalur `tone`/`status` berjalan persis seperti sebelumnya.
   */
  appearance?: BadgeAppearance;
  label?: string;
  /**
   * Penanda bentuk di sisi kiri label. Tanpa nilai, badge tetap chip polos —
   * itu keadaan setiap pemanggil yang ada sekarang, jadi tidak satu pun
   * bergeser sampai ada yang mengisinya.
   *
   * HANYA untuk badge yang membawa STATUS: kondisi pohon dan status tugas.
   * Chip informasi — interval pengulangan, grade, varietas, nama fase — tetap
   * polos. Penanda bentuk adalah kosakata yang harus dipelajari sekali lalu
   * berlaku seterusnya; memasangnya pada chip yang tidak menyatakan status
   * membuat kosakata itu berarti "ini sebuah chip", yang tidak berguna.
   */
  marker?: StatusMarkerShape;
  /** Bawaan: warna teks badge. Lihat catatan warna pada CONDITION_BADGE. */
  markerColor?: string;
  maxWidth?: number;
  size?: 'sm' | 'md';
  status?: string;
  tone?: BadgeTone;
}) {
  const displayLabel = label ?? status;

  if (!displayLabel) {
    return null;
  }

  const badge = appearance ?? badgeColors[status ? getStatusTone(status) : tone];
  const isMedium = size === 'md';

  return (
    <View
      style={{
        alignItems: 'center',
        alignSelf: 'flex-start',
        backgroundColor: badge.background,
        borderColor: badge.border ?? undefined,
        borderRadius: shapeRadius.pill,
        // `border: null` berarti tanpa garis. Chip berlatar warna tidak butuh
        // garis — latarnya sudah menjadi batasnya, dan garis di atasnya
        // menambah tepi kedua yang tidak menyampaikan apa pun.
        borderWidth: badge.border === null ? 0 : 1,
        flexDirection: 'row',
        // 7, bukan spasi penuh: penanda harus terbaca MENEMPEL pada labelnya,
        // bukan berdiri sebagai elemen ketiga di dalam chip.
        gap: 7,
        maxWidth,
        // 11 horizontal, 5 vertikal. Angka ganjil dan itu disengaja — chip
        // radius 999 membutuhkan padding sisi yang lebih besar daripada chip
        // bersudut untuk terlihat sama lapang, karena lengkungnya memakan
        // ruang di kedua ujung.
        paddingHorizontal: isMedium ? spacing.md : 11,
        paddingVertical: isMedium ? 6 : 5,
      }}
    >
      {marker ? <StatusMarker color={markerColor ?? badge.text} shape={marker} /> : null}
      <Text
        selectable={false}
        numberOfLines={1}
        style={{
          color: badge.text,
          // Berat dibawa keluarga font, bukan fontWeight.
          fontFamily: fonts.sansSemiBold,
          // 13, naik dari caption 12. Badge kondisi pohon adalah salah satu
          // teks terkecil yang membawa arti sungguhan di aplikasi ini, dan ia
          // dibaca di kebun, bukan di meja.
          fontSize: isMedium ? typography.meta.fontSize : 13,
          lineHeight: isMedium ? typography.meta.lineHeight : 18,
          // flexShrink supaya label panjang yang terpotong ellipsis tidak
          // mendorong penanda keluar dari chip.
          flexShrink: 1,
        }}
      >
        {displayLabel}
      </Text>
    </View>
  );
}

export function MetricCard({
  label,
  tone = 'muted',
  value,
}: {
  label: string;
  tone?: 'danger' | 'info' | 'muted' | 'primary' | 'success' | 'warning';
  value: number | string;
}) {
  const textColor =
    tone === 'danger'
      ? colors.danger
      : tone === 'info'
        ? colors.info
      : tone === 'warning'
        ? colors.warning
        : tone === 'success' || tone === 'primary'
          ? colors.primary
          : colors.muted;

  return (
    <View style={{ flexBasis: '30%', flexGrow: 1, minWidth: 96 }}>
      <Card>
        <View style={{ gap: spacing.xs, minHeight: 62, justifyContent: 'space-between' }}>
          <Text
            selectable
            numberOfLines={2}
            style={{ color: colors.muted, fontSize: 12, fontWeight: '700', lineHeight: 17 }}
          >
            {label}
          </Text>
          <Text selectable style={{ color: textColor, fontSize: 25, fontVariant: ['tabular-nums'], fontWeight: '700' }}>
            {value}
          </Text>
        </View>
      </Card>
    </View>
  );
}

// `icon` opsional dan default TIDAK ADA, jadi seluruh chip filter yang sudah ada
// tetap berbentuk sama persis. Ia ditambahkan untuk chip aksi di sisi kanan
// judul (mis. "Tambah" di layar Pohon dan Perawatan), tempat ikon plus yang
// menandai "membuat sesuatu" perlu ikut terbaca — bukan untuk chip penyaring,
// yang justru harus tetap polos supaya deretnya terbaca sebagai satu sumbu.
export function ChipButton({
  active,
  count,
  icon,
  label,
  onPress,
}: {
  active: boolean;
  count?: number;
  icon?: IconName;
  label: string;
  onPress: () => void;
}) {
  const contentColor = active ? colors.white : colors.text;
  // Terpilih ditandai CENTANG, bukan cuma latar hijau. Aturan proyek: warna
  // tidak boleh jadi satu-satunya penanda keadaan — dan chip inilah hal pertama
  // yang disentuh orang di daftar pohon, di layar ponsel yang mungkin terbaca
  // di bawah cahaya matahari.
  //
  // Lewat prop `icon` yang SUDAH ADA, bukan jalur baru. Chip yang mengirim
  // ikonnya sendiri tetap memakai ikon itu; centang hanya mengisi chip yang
  // tidak punya ikon dan sedang terpilih.
  const resolvedIcon = icon ?? (active ? 'check' : undefined);

  return (
    <Pressable
      onPress={onPress}
      style={{
        alignItems: 'center',
        backgroundColor: active ? palette.accent : colors.surface,
        borderColor: active ? palette.accent : colors.border,
        borderRadius: radius.round,
        borderWidth: 1,
        flexDirection: 'row',
        gap: spacing.xs,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm + 1,
      }}
    >
      {resolvedIcon ? (
        <Icon name={resolvedIcon} size={tokens.icon.sm} color={active ? contentColor : colors.primary} />
      ) : null}
      <Text selectable style={{ color: contentColor, fontSize: 14, fontWeight: '700' }}>
        {count === undefined ? label : `${label} · ${count}`}
      </Text>
    </Pressable>
  );
}

export type FilterChipOption = {
  active?: boolean;
  disabled?: boolean;
  key: string;
  label: string;
  onPress: () => void;
  valueLabel?: string;
};

export function FilterChip({
  active = false,
  disabled = false,
  label,
  onPress,
  valueLabel,
}: Omit<FilterChipOption, 'key'>) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: 'center',
        backgroundColor: active ? colors.primarySoft : colors.surface,
        borderColor: active ? palette.accent : colors.border,
        borderCurve: 'continuous',
        borderRadius: radius.chip,
        borderWidth: 1,
        flexDirection: 'row',
        gap: spacing.xs,
        minHeight: 38,
        opacity: disabled ? 0.5 : pressed ? 0.82 : 1,
        paddingHorizontal: spacing.md,
      })}
    >
      <Text
        selectable={false}
        numberOfLines={1}
        style={{
          color: active ? colors.primary : colors.text,
          fontSize: 13,
          fontWeight: '700',
          lineHeight: 18,
        }}
      >
        {valueLabel ? `${label}: ${valueLabel}` : label}
      </Text>
      <Icon name="chevron-down" size={14} color={active ? colors.primary : colors.textSoft} />
    </Pressable>
  );
}

export function FilterChipsRow({
  chips,
  children,
  clearLabel = 'Reset',
  hasActiveFilters,
  onClear,
  style,
}: {
  chips?: FilterChipOption[];
  children?: React.ReactNode;
  clearLabel?: string;
  hasActiveFilters?: boolean;
  onClear?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const shouldShowClear = Boolean(onClear && hasActiveFilters);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[{ flexGrow: 0 }, style]}
      contentContainerStyle={{
        alignItems: 'center',
        gap: spacing.sm,
        paddingRight: spacing.screenHorizontal,
      }}
    >
      {chips?.map((chip) => (
        <FilterChip
          key={chip.key}
          active={chip.active}
          disabled={chip.disabled}
          label={chip.label}
          valueLabel={chip.valueLabel}
          onPress={chip.onPress}
        />
      ))}
      {children}
      {shouldShowClear ? (
        <Pressable
          accessibilityRole="button"
          onPress={onClear}
          style={({ pressed }) => ({
            borderRadius: radius.chip,
            opacity: pressed ? 0.72 : 1,
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.sm,
          })}
        >
          <Text selectable={false} style={{ color: colors.primary, fontSize: 13, fontWeight: '700' }}>
            {clearLabel}
          </Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

export type SegmentedControlOption = {
  key: string;
  label: string;
};

// Dua sampai tiga tampilan atas SATU isi — bukan navigasi, bukan filter.
//
// KEADAAN AKTIF DIBAWA TIGA SALURAN, bukan hanya latar. Aturan proyek melarang
// warna jadi satu-satunya penanda, dan pada kontrol sesempit ini pelanggarannya
// paling mudah terjadi:
//
//   BENTUK  — segmen aktif punya kotak sendiri (latar kartu + border) di atas
//             alur yang datar; yang tidak aktif tidak punya kotak sama sekali.
//   TEBAL   — 700 lawan 500. Saluran non-warna yang terbaca bahkan saat
//             layarnya kena silau matahari.
//   WARNA   — brand lawan teks sekunder, sebagai penegas, bukan pembawa pesan.
//
// 'transparent' bukan warna literal yang menghindari token — ia ketiadaan warna,
// pola yang sama dengan role-bottom-navigation dan farm-map-screen.
export function SegmentedControl({
  onChange,
  options,
  value,
}: {
  onChange: (key: string) => void;
  options: SegmentedControlOption[];
  value: string;
}) {
  return (
    <View
      style={{
        backgroundColor: tokens.color.surface.subtle,
        borderColor: tokens.color.line.card,
        borderCurve: 'continuous',
        borderRadius: tokens.radius.control,
        borderWidth: 1,
        flexDirection: 'row',
        gap: tokens.space.xs,
        padding: tokens.space.xs,
      }}
    >
      {options.map((option) => {
        const active = option.key === value;

        return (
          <Pressable
            key={option.key}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option.key)}
            style={({ pressed }) => ({
              alignItems: 'center',
              backgroundColor: active ? tokens.color.surface.card : 'transparent',
              borderColor: active ? tokens.color.brand.border : 'transparent',
              borderCurve: 'continuous',
              borderRadius: tokens.radius.tile,
              borderWidth: 1,
              flex: 1,
              justifyContent: 'center',
              minHeight: tokens.layout.tapTarget - tokens.space.sm,
              opacity: pressed ? 0.82 : 1,
              paddingHorizontal: tokens.space.sm,
            })}
          >
            <Text
              selectable={false}
              numberOfLines={1}
              style={{
                color: active ? tokens.color.brand.base : tokens.color.text.secondary,
                fontSize: tokens.type.label.fontSize,
                fontWeight: active ? '700' : '500',
                lineHeight: tokens.type.label.lineHeight,
              }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function SectionTitle({ subtitle, title }: { subtitle?: string; title: string }) {
  return (
    <View style={{ gap: 4, paddingTop: 4 }}>
      <Text selectable style={{ color: colors.text, fontSize: 19, fontWeight: '700' }}>
        {title}
      </Text>
      {subtitle ? (
        <Text selectable style={{ color: colors.muted, lineHeight: 21 }}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

// Tinggi minimum area teks multiline. Satu sumber untuk kedua jalur render di
// bawah; nilainya sengaja dipertahankan dari versi lama Field. Belum ada token
// yang sepadan (tokens.layout hanya punya fieldHeight/rowMinHeight/controlHeight).
const FIELD_MULTILINE_MIN_HEIGHT = 96;

type FieldBaseProps = {
  autoCapitalize?: TextInputProps['autoCapitalize'];
  // autoComplete & textContentType sengaja hanya diteruskan, tanpa nilai default:
  // dibiarkan undefined, TextInput berperilaku persis seperti sebelum prop ini ada,
  // jadi pemakaian Field yang sudah ada tidak berubah sama sekali. Keduanya dipakai
  // layar auth supaya password manager & saran email keyboard mau menyala.
  autoComplete?: TextInputProps['autoComplete'];
  error?: string;
  helperText?: string;
  label: string;
  value: string;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
  numberOfLines?: number;
  textContentType?: TextInputProps['textContentType'];
  trailing?: React.ReactNode;

  // ——— Tiga prop opsional batch 1a. Ketiganya bernilai bawaan yang
  // mempertahankan perilaku sekarang PERSIS, jadi 29 pemakaian Field yang ada
  // tidak bergeser satu piksel pun sampai ada yang mengisinya. ———

  /**
   * Satuan yang ditulis DI DALAM kolom di sisi kanan: 'kg', 'm²', 'buah'.
   *
   * Sengaja di dalam kolom, bukan diimbuhkan ke label. Satuan adalah bagian
   * dari nilai yang sedang diketik, bukan bagian dari pertanyaannya — menaruhnya
   * di label ("Berat (kg)") memaksa mata bolak-balik antara label dan kolom
   * untuk memastikan angka yang barusan diketik satuannya benar.
   *
   * Tidak berlaku bersama `trailing`: keduanya memperebutkan sisi kanan yang
   * sama. Kalau keduanya diisi, `trailing` menang — ia bisa ditekan, satuan
   * tidak, dan membuang kontrol yang bisa ditekan lebih merugikan.
   */
  unit?: string;

  /**
   * Menambahkan imbuhan ' (boleh kosong)' pada label, berwarna textMuted.
   *
   * Sengaja menandai yang OPSIONAL, bukan memberi tanda bintang pada yang
   * wajib. Di formulir ini mayoritas kolom wajib, jadi menandai yang wajib
   * berarti membubuhi hampir semua baris dengan simbol yang harus dipelajari
   * dulu artinya. Menandai minoritasnya, dengan kata-kata, tidak menuntut apa
   * pun dari pembacanya.
   */
  optional?: boolean;

  /**
   * Garis jadi `accent` 1,5px — untuk layar bermode tampil-lalu-edit, supaya
   * kolom yang sedang bisa diubah terlihat berbeda dari kolom yang hanya
   * ditampilkan.
   *
   * BUKAN keadaan fokus. Fokus diurus sistem dan berumur pendek; ini menyatakan
   * "layar sedang dalam mode edit" dan bertahan selama modenya menyala.
   */
  editing?: boolean;
};

// onChangeText ditegakkan tipe, bukan konvensi: hanya field terkunci yang boleh
// tidak punya handler (nilainya memang tidak bisa berubah). Field biasa yang
// lupa mengoper handler gagal saat kompilasi, tidak diam-diam jadi read-only.
export type FieldProps =
  | (FieldBaseProps & { locked: true; onChangeText?: (value: string) => void })
  | (FieldBaseProps & { locked?: false; onChangeText: (value: string) => void });

export function Field({
  autoCapitalize = 'none',
  autoComplete,
  editing = false,
  error,
  helperText,
  label,
  locked = false,
  optional = false,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  multiline,
  numberOfLines,
  textContentType,
  trailing,
  unit,
}: FieldProps) {
  // Dua jalur render yang sengaja dipisah. Jalur "polos" (di bawah, cabang
  // else) menggambar border pada TextInput itu sendiri. Jalur "baris" aktif
  // kalau `locked`, `trailing`, atau `unit` diisi — border pindah ke container
  // supaya ikon gembok, tombol mata, atau teks satuan bisa duduk di dalam
  // border yang sama.
  //
  // Kedua jalur sekarang memakai tinggi, radius, latar, dan warna garis yang
  // SAMA; pemisahannya tinggal soal siapa yang menggambar bordernya.
  const useRowLayout = locked || Boolean(trailing) || Boolean(unit);

  // `trailing` menang atas `unit` — keduanya menempati sisi kanan yang sama,
  // dan yang bisa ditekan tidak boleh kalah oleh yang tidak.
  const unitLabel = trailing ? undefined : unit;
  // Error mengalahkan helperText; keduanya tidak pernah tampil bersamaan.
  const helperMessage = error ? null : helperText;
  // null di layar yang tidak opt-in. Saat null, handleFocus ikut undefined dan
  // TextInput tidak menerima prop onFocus sama sekali — identik dengan sebelumnya.
  const autoScroll = React.use(AutoScrollContext);
  const containerRef = React.useRef<React.ComponentRef<typeof View> | null>(null);
  const handleFocus = autoScroll
    ? () => autoScroll.requestScrollIntoView(containerRef.current)
    : undefined;
  // Urutan menang: galat, lalu terkunci, lalu sedang-diedit, lalu bawaan.
  // Galat di atas segalanya — kolom yang sedang diedit DAN salah isi harus
  // membaca sebagai salah, bukan sebagai sedang diedit.
  const borderColor = error
    ? palette.statusBuruk
    : locked
      ? palette.border
      : editing
        ? palette.accent
        : palette.borderStrong;
  const borderWidth = !error && !locked && editing ? 1.5 : 1;

  return (
    <View ref={containerRef} style={{ gap: spacing.sm }}>
      <Text
        selectable
        style={{
          color: colors.text,
          // Berat dibawa keluarga font, bukan fontWeight — Android tidak
          // mensintesis berat untuk font kustom.
          fontFamily: fonts.sansSemiBold,
          fontSize: 14,
        }}
      >
        {label}
        {optional ? (
          // Bagian dari <Text> yang sama, bukan elemen di sebelahnya: imbuhan
          // ini harus ikut membungkus bersama labelnya saat font sistem
          // dibesarkan, bukan terpisah ke barisnya sendiri.
          <Text style={{ color: palette.textMuted, fontFamily: fonts.sans }}> (boleh kosong)</Text>
        ) : null}
      </Text>
      {useRowLayout ? (
        <View
          style={{
            alignItems: multiline ? 'flex-start' : 'center',
            backgroundColor: locked ? palette.surfaceSunken : palette.surfaceRaised,
            borderColor,
            borderCurve: 'continuous',
            borderRadius: shapeRadius.control,
            borderWidth,
            flexDirection: 'row',
            gap: tokens.space.sm,
            minHeight: multiline ? FIELD_MULTILINE_MIN_HEIGHT : touch.field,
            paddingLeft: tokens.space.lg,
            // Sisi kanan dirapatkan saat ada trailing supaya slot 44 tidak
            // mendorong ikon terlalu jauh ke dalam.
            paddingRight: trailing ? tokens.space.xs : tokens.space.lg,
            paddingVertical: multiline ? tokens.space.md : 0,
          }}
        >
          {locked ? (
            <Icon name="lock" size={tokens.icon.sm} color={tokens.color.text.tertiary} />
          ) : null}
          <TextInput
            autoCapitalize={autoCapitalize}
            autoComplete={autoComplete}
            autoCorrect={false}
            editable={!locked}
            keyboardType={keyboardType}
            multiline={multiline}
            numberOfLines={multiline ? numberOfLines ?? 4 : undefined}
            onChangeText={onChangeText}
            onFocus={handleFocus}
            placeholder={placeholder}
            placeholderTextColor={palette.textMuted}
            secureTextEntry={secureTextEntry}
            style={{
              // Terkunci dibedakan lewat warna teks sekunder + permukaan redup +
              // gembok, bukan lewat opacity: targetnya terbaca "memang tidak bisa
              // diubah", bukan "sedang dinonaktifkan sementara".
              color: locked ? palette.textMuted : palette.textPrimary,
              flex: 1,
              // 16 minimum, tanpa pengecualian. Di bawah itu Android memicu
              // zoom otomatis pada sebagian peramban/WebView dan, lebih penting,
              // angka hasil panen yang diketik di bawah sinar matahari tidak
              // terbaca ulang untuk diperiksa.
              fontFamily: fonts.sans,
              fontSize: 16,
              minHeight: multiline ? FIELD_MULTILINE_MIN_HEIGHT - tokens.space.md * 2 : undefined,
              paddingVertical: 0,
            }}
            textAlignVertical={multiline ? 'top' : undefined}
            textContentType={textContentType}
            value={value}
          />
          {unitLabel ? (
            // Satuan duduk DI DALAM border, rapat ke tepi kanan. Tidak bisa
            // ditekan dan tidak menyusut: flexShrink 0 supaya nilai yang panjang
            // mendorong dirinya sendiri, bukan memotong satuannya.
            <Text
              selectable={false}
              style={{
                color: palette.textMuted,
                flexShrink: 0,
                fontFamily: fonts.sans,
                fontSize: 16,
              }}
            >
              {unitLabel}
            </Text>
          ) : null}
          {trailing ? (
            // Slot sentuh 44x44 (tokens.layout.tapTarget). Kontraknya: elemen yang
            // dititipkan pemanggil HARUS Pressable yang meregang mengisi slot ini.
            // Sengaja BUKAN hitSlop — hitSlop akan meluber ke atas TextInput di
            // sebelahnya dan mencuri tap yang seharusnya menaruh kursor di teks.
            <View
              style={{
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: tokens.layout.tapTarget,
                minWidth: tokens.layout.tapTarget,
              }}
            >
              {trailing}
            </View>
          ) : null}
        </View>
      ) : (
        <TextInput
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          autoCorrect={false}
          keyboardType={keyboardType}
          multiline={multiline}
          numberOfLines={multiline ? numberOfLines ?? 4 : undefined}
          onChangeText={onChangeText}
          onFocus={handleFocus}
          placeholder={placeholder}
          placeholderTextColor={palette.textMuted}
          secureTextEntry={secureTextEntry}
          style={{
            backgroundColor: palette.surfaceRaised,
            borderColor,
            borderCurve: 'continuous',
            borderRadius: shapeRadius.control,
            borderWidth,
            color: palette.textPrimary,
            fontFamily: fonts.sans,
            fontSize: 16,
            minHeight: touch.field,
            paddingHorizontal: spacing.lg,
            ...(multiline
              ? {
                  minHeight: FIELD_MULTILINE_MIN_HEIGHT,
                  paddingVertical: tokens.space.md,
                }
              : null),
          }}
          textAlignVertical={multiline ? 'top' : undefined}
          textContentType={textContentType}
          value={value}
        />
      )}
      {error ? (
        <Text
          selectable
          style={{
            color: tokens.color.status.danger.text,
            fontSize: tokens.type.meta.fontSize,
            lineHeight: tokens.type.meta.lineHeight,
          }}
        >
          {error}
        </Text>
      ) : null}
      {helperMessage ? (
        <Text
          selectable
          style={{
            color: tokens.color.text.tertiary,
            fontSize: tokens.type.meta.fontSize,
            lineHeight: tokens.type.meta.lineHeight,
          }}
        >
          {helperMessage}
        </Text>
      ) : null}
    </View>
  );
}

// Password + tombol mata, dibangun di atas <Field> lewat slot `trailing` — bukan
// menggambar border sendiri, supaya tingginya, radiusnya, dan tampilan error-nya
// otomatis ikut Field dan tidak bisa melenceng sendiri.
//
// Diangkat dari definisi lokal di account-password-screen.tsx; definisi lokal di
// sana SENGAJA dibiarkan utuh untuk sementara agar layar "Edit password" tidak
// ikut bergerak di batch ini.
//
// Tiap instance memegang state show/hide-nya sendiri — membuka satu field tidak
// ikut membuka field password lain di layar yang sama.
export function PasswordField({
  autoComplete,
  error,
  helperText,
  label,
  onChangeText,
  placeholder,
  textContentType,
  value,
}: {
  // Diteruskan apa adanya ke Field, TANPA default. Dibiarkan undefined,
  // TextInput berperilaku persis seperti sebelum prop ini ada, jadi pemakaian
  // PasswordField yang tidak mengisinya tidak bergeser sedikit pun.
  //
  // KENAPA IA ADA. textContentType adalah prop iOS. Di Android yang dibaca
  // kerangka autofill adalah autoComplete, dan tanpa prop ini tidak ada satu
  // pun jalan bagi pemanggil untuk mengirimkannya — akibatnya password manager
  // di Android tidak bisa menyimpan maupun mengisi password sama sekali.
  autoComplete?: TextInputProps['autoComplete'];
  error?: string;
  helperText?: string;
  label: string;
  onChangeText: (value: string) => void;
  // Diteruskan apa adanya ke Field, tanpa default — dibiarkan undefined,
  // TextInput tidak merender placeholder sama sekali, persis seperti sebelum
  // prop ini ada.
  placeholder?: string;
  textContentType?: TextInputProps['textContentType'];
  value: string;
}) {
  const [visible, setVisible] = React.useState(false);

  return (
    <Field
      autoComplete={autoComplete}
      error={error}
      helperText={helperText}
      label={label}
      placeholder={placeholder}
      secureTextEntry={!visible}
      textContentType={textContentType}
      value={value}
      onChangeText={onChangeText}
      trailing={
        <Pressable
          accessibilityLabel={
            visible ? `Sembunyikan ${label.toLowerCase()}` : `Tampilkan ${label.toLowerCase()}`
          }
          accessibilityRole="button"
          accessibilityState={{ selected: visible }}
          onPress={() => setVisible((previous) => !previous)}
          // Meregang mengisi slot milik Field, bukan sekadar seukuran ikon dan
          // bukan hitSlop — hitSlop akan meluber ke TextInput di sebelahnya
          // dan mencuri tap yang seharusnya menaruh kursor di teks.
          //
          // 48, BUKAN tokens.layout.tapTarget (44). 44 adalah minimum iOS;
          // pedoman Android 48dp, dan seluruh pengguna app ini Android — memakai
          // HP di kebun dengan tangan basah atau berdebu. Angkanya ditulis lokal
          // dan tokennya SENGAJA dibiarkan 44: tapTarget dipakai enam tempat lain
          // (farm.tsx, access-status-screen, account-password-screen,
          // tree-planting-sheets, slot trailing Field, OptionChip), dan menaikkan
          // tokennya akan menggeser keenamnya tanpa verifikasi visual.
          //
          // Slot pembungkus di Field memakai minWidth (bukan lebar tetap), jadi
          // ia ikut melebar ke 48 dan TextInput di sebelahnya menyempit 4dp.
          style={({ pressed }) => ({
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 48,
            minWidth: 48,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Icon
            name={visible ? 'eye-off' : 'eye'}
            size={tokens.icon.md}
            color={tokens.color.text.tertiary}
          />
        </Pressable>
      }
    />
  );
}

// Tautan silang antar layar auth: "Belum punya akun? Daftar". Diangkat dari
// definisi lokal yang tersalin identik di login.tsx dan register.tsx; kedua
// salinan itu dibersihkan saat layarnya dirombak, bukan di sini.
export function InlineAuthLink({
  actionLabel,
  onPress,
  prefix,
}: {
  actionLabel: string;
  onPress: () => void;
  prefix: string;
}) {
  return (
    <View
      style={{
        alignItems: 'center',
        flexDirection: 'row',
        gap: tokens.space.xs,
        justifyContent: 'center',
      }}
    >
      <Text selectable style={{ color: tokens.color.text.tertiary }}>
        {prefix}
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => ({
          opacity: pressed ? 0.6 : 1,
          paddingVertical: tokens.space.sm,
        })}
      >
        <Text selectable={false} style={{ color: tokens.color.brand.base, fontWeight: '700' }}>
          {actionLabel}
        </Text>
      </Pressable>
    </View>
  );
}

export type OptionItem = { value: string; label: string; disabled?: boolean };

export function OptionChip({
  label,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const backgroundColor = disabled
    ? tokens.color.surface.canvas
    : selected
      ? tokens.color.brand.soft
      : tokens.color.surface.card;
  const borderColor = disabled
    ? tokens.color.line.hairline
    : selected
      ? tokens.color.brand.base
      : tokens.color.line.card;
  const textColor = disabled
    ? tokens.color.text.tertiary
    : selected
      ? tokens.color.brand.base
      : tokens.color.text.secondary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled), selected: Boolean(selected) }}
      disabled={disabled}
      onPress={onPress}
      style={{
        alignItems: 'center',
        backgroundColor,
        borderColor,
        borderCurve: 'continuous',
        borderRadius: tokens.radius.pill,
        borderWidth: 1,
        justifyContent: 'center',
        minHeight: tokens.layout.tapTarget,
        paddingHorizontal: tokens.space.md,
      }}
    >
      <Text
        selectable={false}
        style={{
          color: textColor,
          fontSize: tokens.type.label.fontSize,
          fontWeight: tokens.type.label.fontWeight,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function OptionGroup({
  label,
  options,
  value,
  onChange,
  error,
}: {
  label?: string;
  options: OptionItem[];
  value?: string | null;
  onChange: (value: string) => void;
  error?: string;
}) {
  return (
    <View style={{ gap: tokens.space.sm }}>
      {label ? (
        <Text selectable style={{ color: tokens.color.text.primary, ...tokens.type.label }}>
          {label}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space.sm }}>
        {options.map((option) => (
          <OptionChip
            key={option.value}
            disabled={option.disabled}
            label={option.label}
            onPress={() => onChange(option.value)}
            selected={value === option.value}
          />
        ))}
      </View>
      {error ? (
        <Text
          selectable
          style={{
            color: tokens.color.status.danger.text,
            fontSize: tokens.type.meta.fontSize,
            lineHeight: tokens.type.meta.lineHeight,
          }}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export function DateField({
  error,
  label,
  onChangeDate,
  placeholder = 'Pilih tanggal',
  value,
}: {
  error?: string;
  label: string;
  onChangeDate: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  const [showPicker, setShowPicker] = React.useState(false);
  const selectedDate = parseIsoDate(value) ?? new Date();

  function handleValueChange(_event: DateTimePickerChangeEvent, date: Date) {
    if (Platform.OS !== 'ios') {
      setShowPicker(false);
    }

    onChangeDate(formatIsoDate(date));
  }

  function handleDismiss() {
    setShowPicker(false);
  }

  return (
    <View style={{ gap: spacing.sm }}>
      <Text
        selectable
        style={{ color: palette.textPrimary, fontFamily: fonts.sansSemiBold, fontSize: 14 }}
      >
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => setShowPicker(true)}
        style={{
          alignItems: 'center',
          backgroundColor: palette.surfaceRaised,
          borderColor: error ? palette.statusBuruk : palette.borderStrong,
          borderCurve: 'continuous',
          borderRadius: shapeRadius.control,
          borderWidth: 1,
          flexDirection: 'row',
          gap: spacing.md,
          justifyContent: 'center',
          minHeight: touch.field,
          paddingHorizontal: spacing.lg,
        }}
      >
          <Icon name="calendar" size={20} color={colors.primary} />
          <Text
            selectable
            style={{ color: palette.textPrimary, fontFamily: fonts.sansSemiBold, fontSize: 16 }}
          >
            {formatFriendlyDate(value, placeholder)}
          </Text>
        </Pressable>
      {error ? (
        <Text
          selectable
          style={{
            color: tokens.color.status.danger.text,
            fontSize: tokens.type.meta.fontSize,
            lineHeight: tokens.type.meta.lineHeight,
          }}
        >
          {error}
        </Text>
      ) : null}
      {showPicker ? (
        <DateTimePicker
          display="default"
          mode="date"
          onDismiss={handleDismiss}
          onNeutralButtonPress={handleDismiss}
          onValueChange={handleValueChange}
          value={selectedDate}
        />
      ) : null}
    </View>
  );
}

export function CompactMetaItem({
  icon,
  label,
}: {
  icon: 'calendar' | 'target' | 'user';
  label: string;
}) {
  return (
    <View style={{ alignItems: 'center', flexDirection: 'row', flexShrink: 1, gap: 5 }}>
      <Icon name={icon} size={14} color={colors.muted} />
      <Text
        selectable
        ellipsizeMode="tail"
        numberOfLines={1}
        style={{ color: colors.muted, flexShrink: 1, fontSize: 13, lineHeight: 18 }}
      >
        {label}
      </Text>
    </View>
  );
}

// Spek batch 1a menetapkan EMPAT varian: utama, sekunder, nonaktif (keadaan,
// bukan nilai varian), dan merusak. Tiga nilai sisanya — 'ghost', 'quiet',
// 'icon' — ditandai usang, BUKAN dihapus: `ButtonVariant` dan `Button` dipakai
// 78 kali di 41 berkas, dan membuang nilai varian adalah penghapusan yang
// dilarang batasan keras batch ini.
//
// Ketiganya tidak ikut dibentuk ulang dan tampil persis seperti sebelum batch
// ini. Pencabutannya butuh keputusan per titik pakai, bukan penghapusan massal.
export type ButtonVariant =
  | 'danger'
  /** @deprecated Spek batch 1a tidak mengenal varian ini. Akan dipetakan ke 'secondary' atau ke baris daftar; belum diputuskan per titik pakai. */
  | 'ghost'
  /** @deprecated Tidak ada tombol ikon-saja untuk aksi utama. Nol pemakaian — kandidat cabut paling aman. */
  | 'icon'
  | 'primary'
  /** @deprecated Spek batch 1a tidak mengenal varian ini. Akan dipetakan ke 'secondary' atau ke baris daftar; belum diputuskan per titik pakai. */
  | 'quiet'
  | 'secondary';

export function Button({
  accessibilityLabel,
  disabled,
  emphasis = 'quiet',
  icon,
  loading,
  loadingTitle,
  onPress,
  size = 'regular',
  title = '',
  variant = 'primary',
}: {
  accessibilityLabel?: string;
  disabled?: boolean;
  // Menegaskan BATAS tombol, bukan variannya. Lingkupnya sempit dan disengaja:
  // ia hanya menimpa warna dan tebal border, tidak menyentuh latar, warna label,
  // tinggi, radius, maupun perilaku tekan. Default 'quiet' = keadaan sekarang
  // persis, jadi tidak satu pun dari pemanggil Button yang ada bergeser.
  //
  // KENAPA IA ADA. Varian `secondary` berlatar colors.surface (#FFFFFF) di atas
  // kanvas #F7FAF3 — kontrasnya ~1,03:1, praktis tak terlihat — dan bordernya
  // colors.border (#DDE8D8) terlalu pucat untuk menggantikan batas itu. Di luar
  // ruangan dengan layar kena silau, tombolnya hilang. 'strong' meminjam
  // brand.border yang sudah ada di token, bukan warna baru.
  //
  // SENGAJA bukan varian baru dan bukan perubahan pada `secondary` itu sendiri:
  // secondary dipakai di banyak layar, dan menegaskannya di semua tempat adalah
  // keputusan desain yang belum diambil.
  emphasis?: 'quiet' | 'strong';
  icon?: React.ReactNode;
  loading?: boolean;
  // Label pengganti selama `loading`. Kalau DIISI, tombol menampilkannya sebagai
  // teks biasa dan ActivityIndicator TIDAK dirender. Kalau kosong (bawaan, dan
  // itu keadaan setiap pemanggil yang ada sekarang), cabang loading berperilaku
  // persis seperti sebelum prop ini ada: pemintal menggantikan label.
  //
  // SENGAJA opt-in per tombol, bukan perubahan global. Button dipakai di hampir
  // seluruh app; mengubah cabang loading-nya langsung akan menghapus pemintal
  // dari setiap tombol simpan di setiap layar catatan, jadwal, dan pohon.
  loadingTitle?: string;
  onPress: () => void;
  size?: 'regular' | 'small';
  title?: string;
  variant?: ButtonVariant;
}) {
  const isPrimary = variant === 'primary';
  const isDanger = variant === 'danger';
  const isGhost = variant === 'ghost' || variant === 'quiet';
  const isIcon = variant === 'icon';
  const isSmall = size === 'small';
  // Ketiga varian usang mempertahankan tampilannya apa adanya; hanya utama,
  // sekunder, dan merusak yang dibentuk ulang oleh spek batch 1a.
  const isLegacyVariant = isGhost || isIcon;

  // TAMPILAN nonaktif, dan sengaja BUKAN `disabled || loading`.
  //
  // Selama memproses, tombol tetap memakai warna variannya sendiri. Spek
  // mengunci tombol selama proses (lihat `disabled` pada Pressable di bawah)
  // tapi memerintahkan labelnya tetap terbaca — dan tombol utama yang berubah
  // jadi balok abu begitu ditekan membaca seperti "gagal", bukan "sedang
  // jalan". Yang menandai prosesnya adalah pemintal di sisi kiri label.
  const isDisabledLook = Boolean(disabled) && !loading;

  // KOREKSI keluhan yang tercatat. Sebelum batch ini, `loading` tanpa
  // `loadingTitle` membuat pemintal MENGGANTIKAN label — tombol berubah jadi
  // lingkaran berputar tanpa kata, dan tidak ada lagi yang memberi tahu aksi
  // apa yang sedang berjalan. Sekarang pemintal selalu mendampingi label, tidak
  // pernah menggantikannya.
  //
  // `loadingTitle` TETAP berfungsi seperti dulu sebagai pengganti teks
  // ("Menghapus…" menggantikan "Hapus"); yang berubah hanya: ia kini ikut
  // ditemani pemintal. Tidak ada pemanggil yang perlu disentuh.
  const showSpinner = Boolean(loading);
  const resolvedTitle = loading && loadingTitle ? loadingTitle : title;

  // Penegasan hanya berlaku untuk tombol yang MEMANG punya border. Varian ghost
  // dan quiet digambar tanpa border sama sekali (borderWidth 0 di bawah), jadi
  // 'strong' di sana tidak boleh diam-diam memunculkan garis yang sebelumnya
  // tidak ada — bentuk tombolnya akan berubah, bukan sekadar menegas.
  //
  // Varian merusak ikut dikecualikan sejak batch 1a: ia kini teks tanpa latar
  // DAN tanpa garis, jadi 'strong' di sana akan menggambar kotak yang justru
  // baru saja dibuang.
  const isStrong = emphasis === 'strong' && !isGhost && !isDanger;

  // Tinggi: 56 untuk aksi utama, 52 untuk sekunder dan merusak. Dua angka, dan
  // bedanya membawa arti — tombol utama satu-satunya yang lebih tinggi di
  // layarnya, jadi ia terbaca lebih dulu tanpa perlu warna tambahan.
  // Nonaktif mengikuti tinggi varian asalnya, jadi tidak ada baris tersendiri.
  const buttonHeight = isSmall
    ? 40
    : isPrimary
      ? touch.primaryButton
      : isDanger || variant === 'secondary'
        ? touch.secondaryButton
        : tokens.layout.controlHeight;

  const contentColor = isDisabledLook
    ? palette.textMuted
    : isPrimary
      ? palette.textOnAccent
      : isDanger
        ? palette.statusBurukInk
        : isLegacyVariant
          ? colors.primary
          : palette.textPrimary;

  // 18 untuk utama, 17 untuk sekunder dan merusak. Varian usang tetap 16.
  const labelFontSize = isSmall ? 14 : isLegacyVariant ? 16 : isPrimary ? 18 : 17;

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: 'center',
        // Selebar kolom konten, kecuali ukuran kecil dan varian ikon.
        alignSelf: isSmall || isIcon ? 'flex-start' : 'stretch',
        // Nonaktif berlatar surfaceSunken — KECUALI varian merusak, yang tetap
        // tanpa latar. Aksi merusak adalah baris TEKS; memberinya bidang saat
        // dinonaktifkan membuat tombol teks mendadak tumbuh kotak, lalu kotak
        // itu lenyap lagi begitu aktif. Nonaktifnya cukup ditandai warna teks
        // (textMuted lewat contentColor) dan ketidakmampuannya ditekan.
        backgroundColor: isDisabledLook
          ? isDanger
            ? 'transparent'
            : palette.surfaceSunken
          : getButtonBackground(variant, pressed),
        borderColor: isStrong ? palette.borderStrong : getButtonBorderColor(variant),
        borderCurve: 'continuous',
        borderRadius: isIcon ? radius.round : shapeRadius.control,
        // Merusak tanpa garis, dan nonaktif tanpa garis. Sisanya seperti dulu.
        borderWidth: isGhost || isDanger || isDisabledLook ? 0 : isStrong ? 1.5 : 1,
        flexDirection: 'row',
        gap: spacing.sm,
        height: isIcon ? (isSmall ? 40 : 48) : undefined,
        justifyContent: 'center',
        minHeight: isIcon ? undefined : buttonHeight,
        minWidth: isIcon ? (isSmall ? 40 : 48) : undefined,
        // Peredupan DICABUT untuk keadaan nonaktif: warnanya sudah dibedakan
        // sendiri (surfaceSunken + textMuted), dan menumpuknya dengan opacity
        // 0,6 membuat labelnya jatuh di bawah ambang kontras AA.
        //
        // Tetap berlaku untuk `loading`, di mana warna variannya sengaja
        // dipertahankan sehingga peredupan adalah satu-satunya isyarat pasif
        // yang tersisa — pemintal di kiri label adalah isyarat aktifnya.
        opacity: loading ? 0.6 : 1,
        paddingHorizontal: isIcon ? 0 : isSmall ? spacing.md : spacing.lg,
      })}
    >
      {/* Pemintal MENDAMPINGI label di sisi kiri, tidak menggantikannya. Ukuran
          'small' supaya ia tidak menaikkan tinggi baris pada tombol 52. */}
      {showSpinner ? <ActivityIndicator size="small" color={contentColor} /> : icon}
      {isIcon && !resolvedTitle ? null : (
        <Text
          selectable={false}
          numberOfLines={1}
          style={{
            color: contentColor,
            // Berat 600 dibawa oleh KELUARGA font, bukan oleh fontWeight.
            // Android tidak mensintesis berat untuk font kustom; `fontWeight`
            // di sebelah `fontFamily` tidak berguna dan pada sebagian perangkat
            // memicu fallback ke muka huruf yang salah.
            fontFamily: fonts.sansSemiBold,
            fontSize: labelFontSize,
            // Aksi merusak rata tengah seperti tombol lain. Ditulis eksplisit
            // karena ia satu-satunya varian tanpa latar, dan tanpa ini ia
            // mengandalkan perataan induknya untuk sesuatu yang dikunci spek.
            textAlign: 'center',
          }}
        >
          {resolvedTitle}
        </Text>
      )}
    </Pressable>
  );
}

/**
 * @deprecated Spek batch 1a: tidak ada FAB, dan tidak ada tombol ikon-saja
 * untuk aksi utama. Aksi utama adalah tombol berlabel selebar kolom konten.
 *
 * Nol pemanggil saat ini — prop `floatingAction` pada <Screen> juga nol
 * pemanggil. Keduanya DIBIARKAN berdiri karena membuang ekspor melanggar
 * batasan keras batch ini; pencabutannya aman dilakukan kapan saja.
 */
export function FloatingActionButton({
  icon = 'plus',
  label,
  onPress,
}: {
  icon?: IconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={{
        alignItems: 'center',
        backgroundColor: palette.accent,
        borderRadius: tokens.radius.cardInner,
        height: tokens.layout.controlHeight,
        justifyContent: 'center',
        width: tokens.layout.controlHeight,
      }}
    >
      <Icon name={icon} size={24} color={colors.white} />
    </Pressable>
  );
}

export function ErrorBanner({ message }: { message?: string | null }) {
  const safeMessage = sanitizeUserFacingMessage(message);

  if (!safeMessage) {
    return null;
  }

  return (
    <View
      style={{
        backgroundColor: colors.dangerSurface,
        borderColor: colors.dangerBorder,
        borderRadius: radius.lg,
        borderWidth: 1,
        padding: spacing.md,
      }}
    >
      <Text selectable style={{ color: colors.danger, lineHeight: 20 }}>
        {safeMessage}
      </Text>
    </View>
  );
}

export function SuccessBanner({ message }: { message?: string | null }) {
  if (!message) {
    return null;
  }

  return (
    <View
      style={{
        backgroundColor: colors.successSurface,
        borderColor: colors.successBorder,
        borderRadius: radius.lg,
        borderWidth: 1,
        padding: spacing.md,
      }}
    >
      <Text selectable style={{ color: colors.primary, lineHeight: 20 }}>
        {message}
      </Text>
    </View>
  );
}

// `header` OPSIONAL, dan ketiadaannya adalah perilaku lama PERSIS: tanpa prop
// itu Screen tidak merender slot header sama sekali, seperti sejak awal.
//
// KENAPA IA ADA. Layar memakai LoadingState sebagai `return` lebih awal, jadi
// selama memuat SELURUH layar diganti — termasuk TopAppBar beserta tombol
// kembalinya. Pada layar bertab itu tidak berbahaya: bottom nav tetap berdiri
// dan orang masih punya jalan keluar. Pada layar yang DIDORONG KE STACK,
// satu-satunya jalan keluar yang tersisa adalah tombol back perangkat — dan itu
// yang bisa menghentikan pengguna yang tidak terbiasa, tepat di tengah alur.
//
// Pemanggil yang mengoper header WAJIB mengirim header yang sama dengan yang
// dipakai layarnya setelah selesai memuat, supaya judul dan tombol kembali
// tidak berpindah tempat saat pemintalnya hilang.
export function LoadingState({
  header,
  message,
  rowHeight,
  rows,
}: {
  header?: React.ReactNode;
  /**
   * Baris penjelas yang muncul HANYA setelah pemuatan melewati 5 detik.
   *
   * Perannya BERUBAH di batch 1b. Dulu ia teks yang langsung tampil di bawah
   * pemutar; sekarang ia keterangan keterlambatan. Bawaannya dicabut (dulu
   * 'Memuat data...') supaya SlowLoadNotice bisa membedakan "pemanggil memang
   * mengirim kalimat" dari "tidak ada yang dikirim" — tanpa itu, setiap
   * pemanggil selalu terhitung mengirim sesuatu dan cabang bawaan spek
   * ('Sedang menyiapkan data.') tidak akan pernah menyala.
   *
   * 33 pemanggil mengirim kalimat sendiri ('Memuat tugas pekerja...' dan
   * sejenisnya). Kalimat itu tidak hilang — ia hanya tidak lagi muncul pada
   * detik pertama, karena kerangka di atasnya sudah mengabarkan hal yang sama
   * tanpa kata.
   */
  message?: string;
  /** Tinggi tiap baris kerangka. Lihat SkeletonList. */
  rowHeight?: number;
  /** Jumlah baris kerangka. Lihat SkeletonList. */
  rows?: number;
}) {
  return (
    <Screen header={header}>
      {/* Kerangka duduk di ATAS layar mengikuti aliran isi, bukan dipusatkan
          vertikal seperti pemutar dulu. Itu memang inti perubahannya: bentuknya
          harus berada di tempat isinya akan muncul, supaya tidak ada lompatan
          saat data tiba. */}
      <View style={{ gap: spacing.lg }}>
        <SkeletonList rowHeight={rowHeight} rows={rows} />
        <SlowLoadNotice message={message} />
      </View>
    </Screen>
  );
}

// Lingkaran ikon milik EmptyState. Bukan komponen publik — hanya supaya
// markup-nya tidak disalin tiga kali di dalam file ini. `background` dioper
// eksplisit karena tiap varian duduk di atas warna yang berbeda: lingkaran
// harus kontras terhadap kotak di belakangnya, bukan menyatu dengannya.
function EmptyStateGlyph({ background, name }: { background: string; name: IconName }) {
  return (
    <View
      style={{
        alignItems: 'center',
        backgroundColor: background,
        borderRadius: tokens.radius.pill,
        height: 56,
        justifyContent: 'center',
        width: 56,
      }}
    >
      <Icon name={name} size={tokens.icon.lg} color={tokens.color.text.tertiary} />
    </View>
  );
}

// Tiga varian:
//   'card'   (bawaan) — di dalam Card, teks rata kiri. Bentuk paling umum.
//   'plain'  — tanpa kotak, rata tengah. Untuk daftar kosong satu layar penuh.
//   'dashed' — kotak border putus-putus, rata tengah. Untuk "belum dicatat"
//              dan slot foto kosong, yang mengundang user menekan sesuatu.
//
// Varian 'card' dan 'plain' sengaja tidak berubah perilakunya bagi pemanggil
// yang sudah ada. Satu-satunya perbaikan pada 'card': prop `icon` dulu DIAM-DIAM
// diabaikan di cabang itu, sekarang dirender. Aman untuk pemanggil lama karena
// tidak ada satu pun yang mengirim `icon` bersama varian 'card'.
export function EmptyState({
  icon,
  subtitle,
  title,
  variant = 'card',
}: {
  icon?: IconName;
  subtitle?: string;
  title: string;
  variant?: 'card' | 'dashed' | 'plain';
}) {
  if (variant === 'plain') {
    return (
      // Daftar kosong satu layar penuh. Ini SATU-SATUNYA varian yang dibentuk
      // ulang di batch 1b: ia satu-satunya yang menjadi isi utama layarnya dan
      // punya ruang untuk judul 34. Varian 'card' dan 'dashed' adalah blok kecil
      // di tengah isi — judul sebesar ini di sana akan lebih besar daripada
      // judul layarnya sendiri.
      <View style={{ alignItems: 'center', gap: tokens.space.md, paddingVertical: tokens.space.xxl }}>
        {icon ? (
          // Ikon GARIS 44, bukan lagi ikon 24 di dalam lingkaran berlatar 56.
          // Lingkaran itu bidang berwarna yang tidak menyatakan apa pun —
          // keadaan kosong bukan status, jadi ia tidak diberi bidang.
          //
          // strokeWidth 1,5 (bawaannya 2): goresan diukur dalam satuan viewBox
          // 24, jadi pada 44px goresan 2 menjadi ~3,7 piksel dan ikonnya
          // terbaca gempal. 1,5 mengembalikannya ke ~2,75.
          //
          // Warnanya neutralCell, dan itu keputusan yang TIDAK ditetapkan spek —
          // spek hanya menyebut "ikon garis 44" tanpa warna. neutralCell dipilih
          // karena ia token bidang netral yang sudah dipakai penanda kondisi
          // sehat: netral, terlihat, dan bukan warna status.
          <Icon name={icon} size={44} strokeWidth={1.5} color={palette.neutralCell} />
        ) : null}
        <Text
          selectable
          style={{
            color: palette.textPrimary,
            // Pemakaian fonts.serif PERTAMA yang benar-benar tampil di aplikasi.
            // Serif dipakai untuk angka besar dan judul keadaan — tempat yang
            // dibaca sekali lalu ditinggalkan — bukan untuk teks antarmuka yang
            // dipindai berulang kali.
            fontFamily: fonts.serif,
            fontSize: 34,
            lineHeight: 40,
            textAlign: 'center',
          }}
        >
          {title}
        </Text>
        {subtitle ? (
          // SATU kalimat. Komponen tidak bisa menegakkannya — kalau pemanggil
          // mengirim paragraf, paragraf itu yang tampil. Yang bisa ditegakkan
          // di sini cuma bentuknya; isinya diperiksa saat layarnya digarap.
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
            {subtitle}
          </Text>
        ) : null}
      </View>
    );
  }

  if (variant === 'dashed') {
    return (
      // Border putus-putus dibaca sebagai "tempat ini masih kosong dan menunggu
      // diisi", beda dari kotak bergaris utuh yang terbaca sebagai kartu berisi.
      // Lingkaran ikonnya memakai surface.card supaya kontras di atas kotak
      // surface.subtle.
      <View
        style={{
          alignItems: 'center',
          backgroundColor: tokens.color.surface.subtle,
          borderColor: tokens.color.line.card,
          borderCurve: 'continuous',
          borderRadius: tokens.radius.cardInner,
          borderStyle: 'dashed',
          borderWidth: 1,
          gap: tokens.space.sm,
          justifyContent: 'center',
          paddingHorizontal: tokens.space.xl,
          paddingVertical: tokens.space.xxxl,
        }}
      >
        {icon ? <EmptyStateGlyph background={tokens.color.surface.card} name={icon} /> : null}
        <Text selectable style={{ ...tokens.type.subheading, color: tokens.color.text.primary, textAlign: 'center' }}>
          {title}
        </Text>
        {subtitle ? (
          <Text selectable style={{ ...tokens.type.meta, color: tokens.color.text.tertiary, textAlign: 'center' }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <Card>
      {icon ? <EmptyStateGlyph background={tokens.color.surface.subtle} name={icon} /> : null}
      {/* Tanpa fontWeight — berat dibawa keluarga huruf. */}
      <Text selectable style={{ color: colors.text, fontFamily: fonts.sansSemiBold, fontSize: typography.h3.fontSize }}>
        {title}
      </Text>
      {subtitle ? (
        <Text selectable style={{ color: colors.muted, fontFamily: fonts.sans, lineHeight: 21 }}>
          {subtitle}
        </Text>
      ) : null}
    </Card>
  );
}

export function MetaRow({ label, value }: { label: string; value?: string | null }) {
  const safeValue = sanitizeDisplayValue(value);

  return (
    <View style={{ gap: spacing.xs }}>
      <Text selectable style={{ color: colors.muted, fontSize: 13 }}>
        {label}
      </Text>
      <Text selectable style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>
        {safeValue || '-'}
      </Text>
    </View>
  );
}

// Baris menu bernavigasi: ikon kiri + label + chevron kanan.
//
// Bentuknya mengikuti pola baris-menu inline yang dipakai di tab Kebun, tapi
// tanpa lingkaran latar ikon — baris menu profil hanya perlu ikon + label.
// Pemakaian inline lama di layar-layar itu SENGAJA belum dimigrasikan ke sini.
//
// Acuan aslinya dulu adalah baris "SOP perawatan" di tab Kebun. Baris itu sudah
// tidak ada sejak fitur SOP dilepas dari aplikasi, jadi rujukannya dihapus —
// yang tersisa dan tetap berlaku adalah bentuk barisnya.
export function MenuRow({
  danger = false,
  icon,
  label,
  meta,
  navigates,
  onPress,
  trailing,
}: {
  danger?: boolean;
  icon: IconName;
  label: string;
  /**
   * Keterangan di BAWAH judul, 14px, textMuted. Bukan di ujung kanan baris.
   *
   * Spek mengunci susunannya: penanda -> judul + meta -> aksi atau chevron.
   * Meta yang duduk di ujung kanan memaksa mata melompati judul untuk
   * membacanya, lalu kembali; ditumpuk di bawah judul ia terbaca dalam satu
   * gerakan turun bersama barisnya.
   */
  meta?: string;
  /**
   * Apakah baris ini benar-benar MEMBUKA sesuatu. Chevron hanya muncul bila
   * ya.
   *
   * Bawaannya `!danger`, yang mereproduksi perilaku sebelum batch 1a persis.
   * Diisi eksplisit `false` untuk baris yang hanya menyalakan sesuatu di
   * tempat, atau yang menjalankan aksi tanpa berpindah layar — chevron di sana
   * menjanjikan halaman yang tidak pernah datang.
   */
  navigates?: boolean;
  onPress: () => void;
  /**
   * Elemen di ujung kanan, menggantikan chevron: badge, sakelar, atau tombol
   * kecil. Bila diisi, chevron tidak dirender meski `navigates` true —
   * keduanya berebut tempat yang sama, dan yang membawa informasi menang.
   */
  trailing?: React.ReactNode;
}) {
  const contentColor = danger ? palette.statusBurukInk : palette.textPrimary;
  const iconColor = danger ? palette.statusBurukInk : tokens.color.brand.base;
  const showChevron = (navigates ?? !danger) && !trailing;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: 'center',
        flexDirection: 'row',
        gap: tokens.space.md,
        // 48 minimum + padding 12, turun dari controlHeight 56. Baris daftar
        // bukan kontrol: ia tidak perlu setinggi tombol, dan tinggi berlebih
        // memperpendek jumlah baris yang muat di satu layar tanpa menambah
        // apa pun pada keterbacaannya. 48 tetap target sentuh yang aman.
        minHeight: touch.row,
        opacity: pressed ? 0.6 : 1,
        paddingVertical: tokens.space.md,
      })}
    >
      <Icon name={icon} size={tokens.icon.md} color={iconColor} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          selectable={false}
          numberOfLines={1}
          style={{
            color: contentColor,
            // 17/600 lewat keluarga font, bukan fontWeight.
            fontFamily: fonts.sansSemiBold,
            fontSize: 17,
            lineHeight: 23,
          }}
        >
          {label}
        </Text>
        {meta ? (
          <Text
            selectable={false}
            numberOfLines={1}
            style={{
              color: palette.textMuted,
              fontFamily: fonts.sans,
              fontSize: 14,
              lineHeight: 20,
            }}
          >
            {meta}
          </Text>
        ) : null}
      </View>
      {trailing ? <View style={{ flexShrink: 0 }}>{trailing}</View> : null}
      {showChevron ? (
        <Icon name="chevron-right" size={tokens.icon.md} color={palette.textMuted} />
      ) : null}
    </Pressable>
  );
}

// Container deret baris menu. Pemisah hairline diurus di sini, BUKAN di MenuRow,
// supaya aturan "tidak ada pemisah di baris terakhir" tidak bergantung pada
// kedisiplinan pemanggil. Pola yang sama dipakai member-row.tsx (baris tidak
// menggambar border sendiri). Dipakai sebagai anak tunggal <Card>.
export function MenuRowGroup({ children }: { children: React.ReactNode }) {
  const rows = React.Children.toArray(children);

  return (
    <View>
      {rows.map((row, index) => (
        <View
          key={index}
          // Pemisah antarbaris adalah GARIS 1px, bukan jarak dan bukan kartu.
          // Urutan pemisah yang dipakai di seluruh redesign: jarak dulu, lalu
          // garis, lalu kotak. Daftar baris yang seragam sudah terbaca sebagai
          // daftar lewat garis; membungkus tiap barisnya jadi kartu adalah
          // tingkat ketiga untuk pekerjaan yang selesai di tingkat kedua.
          style={
            index < rows.length - 1
              ? { borderBottomColor: palette.border, borderBottomWidth: 1 }
              : undefined
          }
        >
          {row}
        </View>
      ))}
    </View>
  );
}

export function FormSection({
  children,
  description,
  style,
  title,
}: {
  children: React.ReactNode;
  description?: string;
  style?: StyleProp<ViewStyle>;
  title: string;
}) {
  return (
    <View style={style}>
      <Card>
        <SectionHeader description={description} title={title} />
        <View style={{ gap: 14 }}>{children}</View>
      </Card>
    </View>
  );
}

export function SearchFilterRow({
  filterActive = false,
  filterCount,
  onChangeText,
  onFilterPress,
  placeholder = 'Cari data',
  style,
  value,
}: {
  filterActive?: boolean;
  filterCount?: number;
  onChangeText: (value: string) => void;
  onFilterPress?: () => void;
  placeholder?: string;
  style?: StyleProp<ViewStyle>;
  value: string;
}) {
  return (
    // Baris ini dulu setinggi 56 — setinggi tombol utama — padahal ia hanya alat
    // bantu di atas daftar, bukan aksi. rowMinHeight (48) menyusutkannya tanpa
    // menembus batas area tekan yang nyaman, dan ukuran itu WAJIB sama persis
    // untuk kolom pencarian dan tombol Filter: keduanya bersebelahan, dan selisih
    // satu piksel pun langsung terlihat sebagai bar yang miring.
    <View style={[{ alignItems: 'center', flexDirection: 'row', gap: spacing.md }, style]}>
      <View
        style={{
          alignItems: 'center',
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderCurve: 'continuous',
          borderRadius: radius.lg,
          borderWidth: 1,
          flex: 1,
          flexDirection: 'row',
          gap: spacing.sm,
          height: tokens.layout.rowMinHeight,
          paddingHorizontal: spacing.md,
        }}
      >
        <Icon name="search" size={tokens.icon.md} color={colors.textSoft} />
        {/* paddingVertical 0 eksplisit: Android memberi TextInput padding bawaan
            yang, di kotak 48px, mendorong teksnya keluar dari tengah. */}
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textSoft}
          style={{
            color: colors.text,
            flex: 1,
            fontSize: typography.small.fontSize,
            paddingVertical: 0,
          }}
          value={value}
        />
        {value.length > 0 ? (
          <Pressable
            accessibilityLabel="Hapus pencarian"
            accessibilityRole="button"
            hitSlop={{ bottom: 12, left: 12, right: 12, top: 12 }}
            onPress={() => onChangeText('')}
          >
            <Icon name="x" size={tokens.icon.md} color={colors.textSoft} />
          </Pressable>
        ) : null}
      </View>
      {onFilterPress ? (
        // Ikon PLUS teks "Filter", bukan ikon saja. Glif adjustments-horizontal
        // tidak punya arti bawaan yang bisa ditebak sekali lihat — tombol ini
        // sebelumnya hanya terbaca oleh orang yang sudah pernah menekannya.
        // Lebarnya sekarang mengikuti isi (dulu kotak 56×56); kolom pencarian di
        // sebelahnya flex:1, jadi ia yang menyesuaikan diri.
        <Pressable
          accessibilityRole="button"
          onPress={onFilterPress}
          style={{
            alignItems: 'center',
            backgroundColor: filterActive ? palette.accent : colors.surface,
            borderColor: filterActive ? palette.accent : colors.primaryBorder,
            borderCurve: 'continuous',
            borderRadius: radius.lg,
            borderWidth: 1,
            flexDirection: 'row',
            gap: spacing.sm,
            height: tokens.layout.rowMinHeight,
            justifyContent: 'center',
            paddingHorizontal: spacing.md,
          }}
        >
          <Icon
            name="adjustments-horizontal"
            size={tokens.icon.md}
            color={filterActive ? colors.white : colors.primary}
          />
          <Text
            selectable={false}
            style={{
              color: filterActive ? colors.white : colors.primary,
              fontSize: typography.small.fontSize,
              fontWeight: '700',
            }}
          >
            Filter
          </Text>
          {(filterCount ?? 0) > 0 ? (
            <View
              style={{
                alignItems: 'center',
                backgroundColor: palette.accent,
                borderRadius: tokens.radius.pill,
                height: 20,
                justifyContent: 'center',
                minWidth: 20,
                paddingHorizontal: 4,
                position: 'absolute',
                right: -6,
                top: -6,
              }}
            >
              <Text selectable={false} style={{ ...tokens.type.caption, color: colors.white, textAlign: 'center' }}>
                {filterCount}
              </Text>
            </View>
          ) : null}
        </Pressable>
      ) : null}
    </View>
  );
}

export function PhotoPickerCard({
  choosePhotoLabel = 'Pilih galeri',
  description,
  emptyLabel = 'Tambah foto',
  error,
  imageUri,
  loading = false,
  onChoosePhoto,
  onRemovePhoto,
  onTakePhoto,
  removeLabel = 'Hapus foto',
  required = false,
  takePhotoLabel = 'Ambil foto',
  title = 'Foto',
}: {
  choosePhotoLabel?: string;
  description?: string;
  emptyLabel?: string;
  error?: string | null;
  imageUri?: string | null;
  loading?: boolean;
  onChoosePhoto?: () => void;
  onRemovePhoto?: () => void;
  onTakePhoto?: () => void;
  removeLabel?: string;
  required?: boolean;
  takePhotoLabel?: string;
  title?: string;
}) {
  const [sourceSheetOpen, setSourceSheetOpen] = React.useState(false);
  const hasImage = Boolean(imageUri);
  const sourceActions = [
    onTakePhoto ? { label: takePhotoLabel, onPress: onTakePhoto } : null,
    onChoosePhoto ? { label: choosePhotoLabel, onPress: onChoosePhoto } : null,
  ].filter((action): action is { label: string; onPress: () => void } => Boolean(action));

  function handleCardPress() {
    if (loading || sourceActions.length === 0) {
      return;
    }

    if (sourceActions.length === 1) {
      sourceActions[0].onPress();
      return;
    }

    setSourceSheetOpen(true);
  }

  return (
    <Card>
      <PhotoSourceSheet
        cameraLabel={takePhotoLabel}
        galleryLabel={choosePhotoLabel}
        hasPhoto={false}
        visible={sourceSheetOpen}
        onCameraPress={() => {
          setSourceSheetOpen(false);
          onTakePhoto?.();
        }}
        onClose={() => setSourceSheetOpen(false)}
        onDeletePhoto={() => setSourceSheetOpen(false)}
        onGalleryPress={() => {
          setSourceSheetOpen(false);
          onChoosePhoto?.();
        }}
      />
      <View style={{ gap: spacing.xs }}>
        <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' }}>
          <Text selectable style={{ color: colors.text, flex: 1, fontSize: 16, fontWeight: '700' }}>
            {title}
          </Text>
          {required ? <Badge label="Wajib" tone="warning" /> : null}
        </View>
        {description ? (
          <Text selectable style={{ color: colors.muted, lineHeight: typography.small.lineHeight }}>
            {description}
          </Text>
        ) : null}
      </View>

      <Pressable
        accessibilityRole="button"
        disabled={loading || sourceActions.length === 0}
        onPress={handleCardPress}
        style={{
          alignItems: 'center',
          backgroundColor: colors.photoPlaceholder,
          borderColor: colors.border,
          borderCurve: 'continuous',
          borderRadius: radius.lg,
          borderWidth: 1,
          justifyContent: 'center',
          minHeight: 180,
          overflow: 'hidden',
        }}
      >
        {hasImage ? (
          <Image
            resizeMode="cover"
            source={{ uri: imageUri ?? undefined }}
            style={{ height: 180, width: '100%' }}
          />
        ) : (
          <View style={{ alignItems: 'center', gap: spacing.sm, padding: spacing.xl }}>
            <View
              style={{
                alignItems: 'center',
                backgroundColor: colors.surface,
                borderColor: colors.primaryBorder,
                borderRadius: radius.round,
                borderWidth: 1,
                height: 52,
                justifyContent: 'center',
                width: 52,
              }}
            >
              <CameraGlyph color={colors.primary} />
            </View>
            <Text selectable={false} style={{ color: colors.text, fontWeight: '700', textAlign: 'center' }}>
              {emptyLabel}
            </Text>
          </View>
        )}
        {onRemovePhoto && hasImage ? (
          <Pressable
            accessibilityLabel={removeLabel}
            accessibilityRole="button"
            disabled={loading}
            onPress={onRemovePhoto}
            style={({ pressed }) => ({
              alignItems: 'center',
              backgroundColor: palette.statusBuruk,
              borderColor: colors.surface,
              borderRadius: radius.round,
              borderWidth: 1,
              height: 34,
              justifyContent: 'center',
              opacity: pressed ? 0.78 : 1,
              position: 'absolute',
              right: spacing.sm,
              top: spacing.sm,
              width: 34,
            })}
          >
            <Icon name="x" size={16} color={colors.white} />
          </Pressable>
        ) : null}
        {loading ? (
          <View
            style={{
              alignItems: 'center',
              backgroundColor: tokens.color.overlay.upload,
              bottom: 0,
              justifyContent: 'center',
              left: 0,
              position: 'absolute',
              right: 0,
              top: 0,
            }}
          >
            <ActivityIndicator color={colors.white} />
          </View>
        ) : null}
      </Pressable>

      {error ? <ErrorBanner message={error} /> : null}
    </Card>
  );
}

export function getStatusTone(status: string): StatusTone {
  const normalized = normalizeStatus(status);

  if (
    [
      'healthy',
      'sehat',
      'completed',
      'complete',
      'selesai',
      'active',
      'aktif',
      'resolved',
      'done',
    ].includes(normalized)
  ) {
    return 'success';
  }

  if (
    [
      'needs_attention',
      'perlu_perhatian',
      'postponed',
      'tertunda',
      'pending',
      'menunggu',
      'new',
      'baru',
    ].includes(normalized)
  ) {
    return 'warning';
  }

  if (
    [
      'pest_attacked',
      'disease_indicated',
      'damaged',
      'dead',
      'hama',
      'penyakit',
      'rusak',
      'mati',
      'rejected',
      'ditolak',
      'removed',
      'dikeluarkan',
      'error',
      'failed',
      'gagal',
    ].includes(normalized)
  ) {
    return 'danger';
  }

  if (['in_progress', 'follow_up', 'tindak_lanjut', 'info', 'informational'].includes(normalized)) {
    return 'info';
  }

  return 'neutral';
}

function getButtonBackground(variant: ButtonVariant, pressed: boolean): string {
  if (variant === 'primary') {
    // palette.accent, BUKAN colors.primary. Keduanya jingga-bata dan mudah
    // tertukar: colors.primary adalah accentText (#A84D26), yang digelapkan
    // untuk dipakai sebagai TEKS di atas kanvas terang. Latar tombol utama
    // adalah accent (#B4552E) — itu yang dikunci spek, dan textOnAccent putih
    // dihitung kontrasnya terhadap nilai itu.
    return pressed ? palette.accentPressed : palette.accent;
  }

  if (variant === 'danger') {
    // Tanpa latar, termasuk saat ditekan. Aksi merusak adalah BARIS teks
    // terpisah, bukan tombol merah — spek menyebutnya eksplisit. Umpan balik
    // tekannya datang dari opacity pada Pressable, bukan dari bidang warna.
    return 'transparent';
  }

  if (variant === 'ghost' || variant === 'quiet') {
    return pressed ? colors.primarySoft : 'transparent';
  }

  if (variant === 'icon') {
    return pressed ? colors.primarySoft : colors.surface;
  }

  // Sekunder: surfaceRaised, ditegaskan garis borderStrong 1px di pemanggilnya.
  return pressed ? palette.surfaceSunken : palette.surfaceRaised;
}

function getButtonBorderColor(variant: ButtonVariant): string {
  if (variant === 'primary') {
    // Tombol utama tidak lagi menggambar garis (borderWidth 0 lewat isStrong
    // yang bernilai false secara bawaan). Nilai ini hanya terpakai bila
    // pemanggil meminta emphasis 'strong'.
    return palette.accent;
  }

  if (variant === 'icon') {
    return colors.border;
  }

  // Sekunder memakai borderStrong, bukan border. `border` (#E2DCD2) di atas
  // surfaceRaised (#FFFDFA) berkontras ~1,1:1 — di luar ruangan dengan layar
  // kena silau, tombolnya hilang sama sekali. borderStrong (#9A9081) yang
  // membuat batasnya bertahan, dan sejak batch 1a ia batas bawaan, bukan lagi
  // sesuatu yang harus diminta lewat emphasis='strong'.
  return palette.borderStrong;
}

function getCardVariantStyle(
  variant: 'default' | 'highlight' | 'softGreen' | 'heroGreen' | 'warning' | 'danger' | 'info'
): { backgroundColor: string; borderColor: string } {
  if (variant === 'highlight' || variant === 'softGreen') {
    return {
      backgroundColor: colors.surfaceGreen,
      borderColor: colors.primaryBorder,
    };
  }

  if (variant === 'heroGreen') {
    return {
      backgroundColor: palette.accent,
      borderColor: palette.accent,
    };
  }

  if (variant === 'warning') {
    return {
      backgroundColor: colors.warningBg,
      borderColor: colors.warningBorder,
    };
  }

  if (variant === 'danger') {
    return {
      backgroundColor: colors.dangerBg,
      borderColor: colors.dangerBorder,
    };
  }

  if (variant === 'info') {
    return {
      backgroundColor: colors.infoBg,
      borderColor: colors.infoBorder,
    };
  }

  return {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  };
}

export function CameraGlyph({ color = colors.primary }: { color?: string }) {
  return <Icon name="camera" color={color} size={24} />;
}

function normalizeStatus(status: string): string {
  return status.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function parseIsoDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  return Number.isNaN(date.getTime()) ? null : date;
}

function formatIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatFriendlyDate(value: string, placeholder = 'Pilih tanggal'): string {
  const date = parseIsoDate(value);

  if (!date) {
    return placeholder;
  }

  return date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
