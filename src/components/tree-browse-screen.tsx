import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomSheet } from './bottom-sheet';
import { Icon } from './icons';
import { FarmMapScreen } from './farm-map-screen';
import { TreeCard } from './tree-components';
import {
  Button,
  ChipButton,
  EmptyState,
  ErrorBanner,
  FilterChipsRow,
  RootTabTitle,
  SearchFilterRow,
  Screen,
  SkeletonBlock,
  SkeletonList,
  UnderlineTabs,
} from './ui';
import { colors, spacing, tokens } from '../constants/theme';
import { useAuth } from '../context/auth-context';
import {
  DEFAULT_TREE_FILTER_CRITERIA,
  matchesTreeCriteria,
  peekTreeBrowseCriteria,
  peekTreeBrowseSearch,
  peekTreeBrowseView,
  resetTreeBrowseState,
  setTreeBrowseCriteria,
  setTreeBrowseSearch,
  setTreeBrowseView,
  type TreeAgeRange,
  type TreeBrowseView,
  type TreeFilterCriteria,
  type TreePhaseFilter,
} from '../lib/treeBrowseState';
import { listTreeMainPhotosForFarm } from '../services/photoAttachmentService';
import { getTrees } from '../services/treeService';
import type { Tree, TreeConditionStatus } from '../types/domain';
import type { TreeMainPhotoMap } from '../types/media';
import {
  formatGrowthPhase,
  formatTreeConditionStatus,
  formatTreeDisplayCode,
} from '../utils/treeFormat';

// SATU komponen untuk kedua peran, menggantikan dua berkas route yang selama ini
// kembar 620 baris.
//
// Keduanya berbeda di TIGA tempat saja: bar aksi "Tambah pohon" (pemilik),
// kalimat keadaan kosong, dan route detail pohon. Sisanya — pencarian, keempat
// sumbu filter, urutan, pemulihan keadaan, cabang Daftar/Denah — identik kata
// per kata, dan dua salinan berarti setiap perbaikan harus diingat dua kali.
// Batch 4a mengubah baris pohon, judul layar, dan perilaku pertukaran tab; tanpa
// peleburan ini, ketiganya perlu ditulis dua kali dengan tangan.
//
// Polanya mengikuti ProfileScreen dan FarmMapScreen: komponen bersama menerima
// basePath, dan kedua berkas route menyusut jadi pembungkus tiga baris.

// Label DITURUNKAN dari formatter bersama, tidak ditulis tangan. Menyalin
// teksnya persis yang dulu membuat chip di layar ini menyebut nama yang berbeda
// dari yang tertulis di baris daftar dan di legenda peta. Urutannya tetap
// ditulis eksplisit — itu urutan tampil, bukan label.
const conditionOptions: Array<{ label: string; value: TreeConditionStatus }> = (
  ['healthy', 'needs_attention', 'pest_attacked', 'disease_indicated', 'damaged', 'dead'] as const
).map((value) => ({ label: formatTreeConditionStatus(value), value }));

// Lima nilai enum PLUS 'unrecorded'. Yang terakhir bukan tambalan: kolom
// trees.current_growth_phase nullable tanpa default, jadi "belum dicatat" adalah
// keadaan yang benar-benar dimiliki data dan sebelum ini tidak punya satu pun
// cara untuk ditemukan.
const phaseOptions: Array<{ label: string; value: TreePhaseFilter }> = [
  ...(['initial_planting', 'vegetative', 'flowering', 'fruiting', 'harvesting'] as const).map(
    (value): { label: string; value: TreePhaseFilter } => ({ label: formatGrowthPhase(value), value })
  ),
  { label: formatGrowthPhase(null), value: 'unrecorded' },
];

const ageRangeOptions: Array<{ label: string; value: TreeAgeRange }> = [
  { label: '<1 tahun', value: 'lt_1' },
  { label: '1-3 tahun', value: '1_3' },
  { label: '>3 tahun', value: 'gt_3' },
];

// "Semua" bukan anggota himpunan melainkan jalan mengosongkannya, jadi ia tidak
// ikut di-toggle: menekannya selalu berarti conditions = [].
const CONDITION_CHIP_ALL = 'all';

const SEGMENT_OPTIONS = [
  { key: 'list', label: 'Daftar' },
  { key: 'map', label: 'Denah' },
];

// Route induk. Ia memiliki DUA hal: tampilan mana yang sedang dipandang, dan
// jumlah pohon yang dipajang di judul.
//
// Header, judul, dan tab Daftar/Denah dirender DI SINI, di luar percabangan, jadi
// ketiganya tidak ikut bertukar — judul tidak berganti, tidak ada tombol back
// yang muncul, dan kepala layar tidak dirender ulang saat pengguna berpindah
// Daftar/Denah. Itu seluruh sebab kedua tampilan disatukan jadi satu route.
//
// TANPA <Screen> di tingkat ini, dan itu WAJIB: Screen membungkus children-nya
// dengan ScrollView vertikal, dan denah punya dua penggulungnya sendiri. Anak
// flex:1 di dalam ScrollView tidak pernah mendapat tinggi terbatas, jadi
// petaknya akan kolaps. Screen tetap dipakai, tapi HANYA di dalam cabang daftar.
//
// RENDER KONDISIONAL YANG BENAR-BENAR MELEPAS, bukan display:none.
// useFocusEffect terikat pada fokus ROUTE, bukan pada visibilitas komponen —
// kalau daftar dan denah ter-mount bersamaan, setiap kali route ini difokus
// getTrees dipanggil dua kali, ditambah ratusan permintaan foto milik daftar.
export function TreeBrowseScreen({ basePath }: { basePath: '/owner/trees' | '/worker/trees' }) {
  // Inset atas diterapkan DI SINI, bukan lewat prop `applyTopInset` pada Screen
  // seperti keempat tab root lain. Alasannya bentuk layar ini: `headerWrap`
  // adalah elemen teratas yang nyata untuk KEDUA cabang, sementara Screen hanya
  // ada di dalam cabang daftar — di bawah tab, dan sama sekali tidak ada
  // di cabang denah.
  const insets = useSafeAreaInsets();

  // Dibaca di FASE RENDER, di dalam penginisialisasi useState. Kalau dibaca di
  // effect, layar selalu melukis Daftar sekali lebih dulu lalu bertukar ke Denah
  // satu frame kemudian — kedipan yang terlihat jelas justru pada pengguna yang
  // memang lebih sering memakai denah.
  const [view, setView] = React.useState<TreeBrowseView>(peekTreeBrowseView);

  // Jumlah pohon untuk judul. null = belum pernah terbaca, dan itu berbeda dari
  // 0: null berarti angkanya tidak dicetak sama sekali, 0 berarti kebunnya
  // memang kosong dan itu kabar yang benar.
  //
  // Dilaporkan oleh cabang yang sedang aktif, bukan diambil sendiri di sini.
  // Kedua cabang memang SUDAH memanggil getTrees untuk keperluannya masing-
  // masing; menambah pemanggilan ketiga di induk berarti membayar permintaan
  // yang sama tiga kali tiap layar ini dibuka.
  const [treeCount, setTreeCount] = React.useState<number | null>(null);

  // KERANGKA SAAT TAB BERPINDAH.
  //
  // Keluhan lag yang tercatat bukan tentang kecepatan melainkan tentang
  // KETIADAAN UMPAN BALIK: sebelum ini pertukaran tab menampilkan
  // <LoadingState>, satu pemutar di tengah layar yang tidak berbentuk seperti
  // apa pun, dan selama detik itu layar terasa membeku alih-alih bekerja.
  //
  // Penggantinya kerangka yang berbentuk seperti isi yang akan datang, dirender
  // oleh masing-masing cabang. Isi LAMA tidak pernah bertahan — percabangan di
  // bawah benar-benar melepas cabang yang ditinggalkan — jadi tidak ada keadaan
  // di mana pengguna melihat daftar sementara ia sudah menekan Denah.
  function changeView(key: string) {
    const next: TreeBrowseView = key === 'map' ? 'map' : 'list';

    if (next === view) {
      return;
    }

    setView(next);
    setTreeBrowseView(next);
  }

  // Disinkronkan ulang saat route kembali difokus. Ini yang membuat pengalih di
  // /owner/trees/map bekerja: ia menyetel modul lalu router.replace ke sini, dan
  // kalau layar ini ternyata dipakai ulang alih-alih dipasang ulang,
  // penginisialisasi useState di atas TIDAK jalan lagi.
  useFocusEffect(
    React.useCallback(() => {
      setView(peekTreeBrowseView());
    }, [])
  );

  return (
    <View style={styles.root}>
      {/* `spacing.xl + insets.top` DISENGAJA, bukan Math.max(insets.top,
          spacing.sm) seperti TopAppBar: ini rumus yang sama persis dengan yang
          dipakai Screen saat applyTopInset menyala (ui.tsx), sehingga jarak atas
          layar Pohon identik dengan ketiga tab root lainnya. */}
      <View style={[styles.headerWrap, { paddingTop: spacing.xl + insets.top }]}>
        {/* Judul layar root tab, 26 rata kiri — penundaan dari batch 1b.
            Judulnya "Pohon", bukan sapaan seperti di Beranda: layar ini menamai
            sekumpulan benda, bukan menyapa orang.

            Jumlahnya di baris meta, bukan disisipkan ke judul. "Pohon (234)"
            memaksa mata membaca angka sebelum sampai ke akhir judul; ditumpuk di
            bawahnya, judulnya terbaca utuh dulu dan angkanya menyusul sebagai
            keterangan — yang memang perannya.

            BERTAHAN saat tab berpindah: angkanya milik induk, bukan milik salah
            satu cabang, jadi ia tidak berkedip jadi kosong lalu terisi lagi tiap
            kali pengguna menekan Denah. */}
        <RootTabTitle
          title="Pohon"
          meta={treeCount === null ? undefined : `${treeCount} pohon`}
        />
        {/* TAB BERGARIS BAWAH, menggantikan SegmentedControl berpil.
 
            Pil lama adalah slab surfaceSunken berisi pil surfaceRaised: dua
            bidang bertumpuk tepat di bawah judul layar, dan arah visual yang
            berlaku menolak bidang bertumpuk. Ia juga menempati 46px untuk
            pekerjaan yang butuh 30 — dan di layar inilah 16px itu berarti,
            karena petak denah di bawahnya sedang diperebutkan sampai piksel
            terakhir.

            paddingBottom TURUN dari space.md (12) ke space.sm (8): garis bawah
            tab sudah memisahkan kepala layar dari isinya, jadi jarak tidak
            perlu mengerjakan pekerjaan yang sudah dikerjakan garis. */}
        <View style={styles.tabsWrap}>
          <UnderlineTabs onChange={changeView} options={SEGMENT_OPTIONS} value={view} />
        </View>
      </View>

      {view === 'list' ? (
        <TreeListView basePath={basePath} onTreeCountChange={setTreeCount} />
      ) : (
        <FarmMapScreen basePath={basePath} onTreeCountChange={setTreeCount} />
      )}
    </View>
  );
}

// Cabang daftar. Ia memiliki SELURUH keadaan daftar — pohon, foto, filter,
// sheet — dan tidak tahu apa pun tentang judul maupun tab di atasnya.
//
// <Screen> dipakai DI SINI, tanpa prop `header`: headernya sudah dirender induk
// di luar percabangan. Screen tetap yang paling benar untuk cabang ini — ia yang
// membawa penggulung vertikal, padding tepi, dan bar aksi melekat.
function TreeListView({
  basePath,
  onTreeCountChange,
}: {
  basePath: '/owner/trees' | '/worker/trees';
  onTreeCountChange: (count: number) => void;
}) {
  const { currentFarm } = useAuth();
  // Pencarian dan filter DIPULIHKAN di fase render, bukan di effect. Kalau
  // dibaca di effect, render pertama melukis seluruh daftar tanpa filter lalu
  // menggantinya sekejap kemudian — dan layar inilah yang isinya paling banyak,
  // jadi kedipannya paling terlihat.
  const [criteria, setCriteria] = React.useState<TreeFilterCriteria>(peekTreeBrowseCriteria);
  const [debouncedSearch, setDebouncedSearch] = React.useState(() =>
    peekTreeBrowseSearch().trim().toLowerCase()
  );
  const [draft, setDraft] = React.useState<TreeFilterCriteria>(DEFAULT_TREE_FILTER_CRITERIA);
  const [error, setError] = React.useState<string | null>(null);
  const [filterSheetOpen, setFilterSheetOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [photoMap, setPhotoMap] = React.useState<TreeMainPhotoMap>({});
  const [search, setSearch] = React.useState(peekTreeBrowseSearch);
  const [trees, setTrees] = React.useState<Tree[]>([]);

  const farmId = currentFarm?.farmId;
  // Menambah pohon menuntut pemilik aktif di sisi database —
  // create_tree_with_planting dan create_trees_at_positions sama-sama menolak
  // pekerja. Bar aksinya karena itu tidak dirender sama sekali untuk pekerja,
  // bukan dirender lalu dinonaktifkan: tombol mati yang selalu mati hanya
  // menjanjikan sesuatu yang tidak akan pernah terjadi.
  const canAddTrees = basePath === '/owner/trees';

  const loadTrees = React.useCallback(async () => {
    if (!farmId) {
      setError('Data kebun aktif tidak ditemukan.');
      setTrees([]);
      setPhotoMap({});
      return;
    }

    setError(null);

    // archived: false sebagai literal, sama dengan enam pemanggil getTrees lain
    // di repo. Sumbu filter Aktif/Diarsipkan sudah dicabut, jadi tidak ada lagi
    // yang bisa membuatnya true. Parameternya sendiri TETAP ada di getTrees.
    const result = await getTrees({ archived: false, farmId });

    if (result.error) {
      setError(result.error.message);
      setTrees([]);
      setPhotoMap({});
      return;
    }

    setTrees(result.data);
    onTreeCountChange(result.data.length);

    // Siklus aktif tiap posisi, diambil dari daftar pohon yang baru saja dimuat
    // — getTrees sudah membawa activePlanting sebagai embedded resource, jadi
    // tidak ada query tambahan. Tanpa peta ini, posisi yang ditanami ulang akan
    // menampilkan foto pohon lama di daftar.
    const photoResult = await listTreeMainPhotosForFarm(
      farmId,
      Object.fromEntries(result.data.map((tree) => [tree.id, tree.activePlanting?.id ?? null]))
    );

    if (photoResult.error) {
      setPhotoMap({});
      return;
    }

    setPhotoMap(photoResult.data);
    // onTreeCountChange sengaja TIDAK jadi dependensi: induk mengopernya sebagai
    // setter useState yang memang stabil, tapi memasukkannya ke sini tetap
    // mengundang pemuatan ulang tanpa henti kalau kelak ia diganti fungsi biasa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [farmId]);

  // Ref dimulai dari farmId SEKARANG, jadi effect ini tidak berbuat apa-apa pada
  // pemasangan pertama. Itu syaratnya: kalau ia jalan saat mount, ia akan
  // menghapus pencarian dan filter yang baru saja dipulihkan di fase render.
  const farmIdRef = React.useRef(farmId);

  React.useEffect(() => {
    if (farmIdRef.current === farmId) {
      return;
    }

    farmIdRef.current = farmId;
    resetTreeBrowseState();
    setCriteria(DEFAULT_TREE_FILTER_CRITERIA);
    setDebouncedSearch('');
    setSearch('');
  }, [farmId]);

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 250);

    return () => clearTimeout(timer);
  }, [search]);

  useFocusEffect(
    React.useCallback(() => {
      loadTrees().finally(() => setLoading(false));
    }, [loadTrees])
  );

  const displayedTrees = React.useMemo(
    () => sortTreesByCode(filterTrees(trees, criteria, debouncedSearch)),
    [criteria, debouncedSearch, trees]
  );

  // Kondisi TIDAK ikut dihitung. Badge angka di tombol Filter hanya mewakili apa
  // yang TERSEMBUNYI di balik tombol itu, dan kondisi sudah terpampang sebagai
  // deret chip yang aktif tepat di bawahnya.
  const activeGroupCount =
    (criteria.phases.length > 0 ? 1 : 0) +
    (criteria.ageRanges.length > 0 ? 1 : 0) +
    (criteria.onlyMissingVariety ? 1 : 0);

  // "Kebun ini memang belum punya pohon" — BUKAN sekadar nol hasil. Nol hasil
  // karena filter ditangani cabang empty state yang lain, yang menyuruh
  // melonggarkan filternya alih-alih menawarkan tombol Tambah pohon.
  const isFarmEmpty = trees.length === 0;

  // SATU pintu untuk setiap perubahan filter: state React dan modul penyimpan
  // ditulis berbarengan, jadi tidak ada jalur yang mengubah salah satunya saja.
  function applyCriteria(next: TreeFilterCriteria) {
    setCriteria(next);
    setTreeBrowseCriteria(next);
  }

  function applySearch(value: string) {
    setSearch(value);
    setTreeBrowseSearch(value);
  }

  function toggleCondition(value: TreeConditionStatus) {
    applyCriteria({ ...criteria, conditions: toggleArrayValue(criteria.conditions, value) });
  }

  function openFilterSheet() {
    setDraft(criteria);
    setFilterSheetOpen(true);
  }

  function applyDraft() {
    applyCriteria(draft);
    setFilterSheetOpen(false);
  }

  if (loading) {
    return <TreeListSkeleton />;
  }

  return (
    <Screen
      stickyFooter={
        canAddTrees ? (
          <Button
            icon={<Icon name="plus" size={tokens.icon.md} color={tokens.color.brand.on} />}
            onPress={() => router.push('/owner/trees/create')}
            title="Tambah pohon"
          />
        ) : undefined
      }
    >
      <ErrorBanner message={error} />

      {/* Kebun yang belum punya pohon tidak diberi kolom pencarian, deret chip,
          maupun "Menampilkan 0 pohon": tidak ada yang bisa dicari atau disaring,
          dan ketiganya cuma menunda empty state yang jadi satu-satunya isi
          berguna di layar ini. Begitu ada pohon, ketiganya kembali — termasuk
          saat filter tidak menghasilkan apa-apa, karena di sana justru kontrol
          itulah jalan keluarnya. */}
      {isFarmEmpty ? null : (
        <>
          {/* PENCARIAN DULU, FILTER SESUDAHNYA — urutan yang sudah benar dan
              tidak diubah di batch 4a. Orang yang tahu kode pohonnya mengetik;
              orang yang tidak tahu menyaring. Yang pertama jauh lebih sering. */}
          <SearchFilterRow
            filterActive={activeGroupCount > 0}
            filterCount={activeGroupCount}
            onChangeText={applySearch}
            onFilterPress={openFilterSheet}
            placeholder="Cari kode atau varietas"
            value={search}
          />

          {/* Ikut tergulung bersama isi, TIDAK melekat di header. Deret ini
              panjang dan sudah punya gulungannya sendiri ke samping; membuatnya
              melekat pula berarti dua baris kontrol tetap yang memakan tinggi
              layar sepanjang waktu, di layar yang gunanya membaca daftar. */}
          <FilterChipsRow>
            <ChipButton
              active={criteria.conditions.length === 0}
              key={CONDITION_CHIP_ALL}
              label="Semua"
              onPress={() => applyCriteria({ ...criteria, conditions: [] })}
            />
            {conditionOptions.map((option) => (
              <ChipButton
                key={option.value}
                active={criteria.conditions.includes(option.value)}
                label={option.label}
                onPress={() => toggleCondition(option.value)}
              />
            ))}
          </FilterChipsRow>

          <ResultCount count={displayedTrees.length} />
        </>
      )}

      <TreeFilterSheet
        draft={draft}
        onApply={applyDraft}
        onClose={() => setFilterSheetOpen(false)}
        onDraftChange={setDraft}
        visible={filterSheetOpen}
      />

      {displayedTrees.length === 0 ? (
        isFarmEmpty ? (
          // Tanpa tombol "Tambah pohon" di badan layar: tombol lebar dengan
          // label yang sama sudah melekat di atas navigasi bawah, terlihat di
          // layar yang sama. Dua tombol untuk satu perbuatan membuat pembacanya
          // berhenti menimbang mana yang benar.
          //
          // Kalimatnya bercabang menurut peran, dan itu bukan kosmetik: pekerja
          // tidak bisa menambah pohon, jadi mengajaknya menambahkan pohon
          // pertama adalah memberi tugas yang bukan miliknya.
          <EmptyState
            icon="tree"
            title="Belum ada pohon"
            subtitle={
              canAddTrees
                ? 'Tambahkan pohon pertama untuk mulai memantau kondisi kebun.'
                : 'Data pohon akan muncul setelah pemilik menambahkannya.'
            }
            variant="plain"
          />
        ) : (
          <EmptyState
            icon="tree"
            subtitle="Coba longgarkan filternya."
            title="Tidak ada pohon yang cocok"
            variant="plain"
          />
        )
      ) : (
        // Satu kolom dengan garis antar baris, bukan grid dua kolom. Baris
        // terakhir tidak diberi garis supaya daftarnya tidak menggantung.
        <View>
          {displayedTrees.map((tree, index) => (
            <React.Fragment key={tree.id}>
              {index > 0 ? <View style={styles.rowDivider} /> : null}
              <TreeCard
                photoUrl={photoMap[tree.id]?.signedUrl}
                tree={tree}
                onPress={() => router.push(`${basePath}/${tree.id}`)}
              />
            </React.Fragment>
          ))}
        </View>
      )}
    </Screen>
  );
}

// Kerangka daftar pohon, MENGGANTIKAN <LoadingState>.
//
// Bentuknya meniru isi yang akan datang, tingkat demi tingkat: satu bidang
// selebar baris pencarian, satu deret pendek untuk chip kondisi, lalu baris-
// baris setinggi TreeCard. Kerangka yang bentuknya meleset dari isi yang datang
// justru membuat lompatannya lebih terasa, bukan kurang — lihat catatan di
// skeleton.tsx.
//
// 80 adalah TREE_ROW_MIN_HEIGHT di tree-components.tsx. Ia disalin sebagai
// angka, dan itu disengaja: mengekspor konstanta tata letak baris hanya untuk
// kerangkanya akan mengikat keduanya lebih erat daripada yang sebenarnya perlu —
// kerangka yang meleset beberapa piksel tidak merusak apa pun.
function TreeListSkeleton() {
  return (
    <Screen>
      <SkeletonBlock height={tokens.layout.fieldHeight} />
      <View style={{ flexDirection: 'row', gap: tokens.space.sm }}>
        <SkeletonBlock height={36} width="28%" />
        <SkeletonBlock height={36} width="28%" />
        <SkeletonBlock height={36} width="28%" />
      </View>
      <SkeletonList rows={6} rowHeight={80} />
    </Screen>
  );
}

function ResultCount({ count }: { count: number }) {
  return (
    <Text selectable style={styles.resultCount}>
      {`Menampilkan ${count} pohon`}
    </Text>
  );
}

// KEEMPAT SUMBU FILTER, dan keempatnya dipertahankan apa adanya di batch 4a.
//
// Spek redesign hanya menyebut chip filter kondisi. Mengikutinya secara harfiah
// berarti membuang fase, umur, dan kelengkapan data — dan itu menghapus FUNGSI,
// bukan menyederhanakan tampilan. "Pohon yang varietasnya belum diisi" tidak
// punya cara lain untuk ditanyakan di seluruh aplikasi ini.
//
// Seluruh sumbu sebagai BADGE yang bisa dinyalakan bersamaan, bukan daftar
// pilihan yang memanjang ke bawah. Empat kelompok muat dalam satu pandangan
// tanpa menggulung sheet, dan itu yang membuat "sehat DAN berbuah DAN di atas 3
// tahun" bisa dirakit tanpa kehilangan jejak apa yang sudah dipilih.
function TreeFilterSheet({
  draft,
  onApply,
  onClose,
  onDraftChange,
  visible,
}: {
  draft: TreeFilterCriteria;
  onApply: () => void;
  onClose: () => void;
  onDraftChange: (next: TreeFilterCriteria) => void;
  visible: boolean;
}) {
  // Kondisi IKUT diperiksa. Ia hadir di sheet ini juga, jadi tombol yang mengaku
  // mengatur ulang isi sheet harus benar-benar mengatur ulang seluruhnya.
  const isDefault =
    draft.ageRanges.length === 0 &&
    draft.conditions.length === 0 &&
    draft.phases.length === 0 &&
    !draft.onlyMissingVariety;

  return (
    <BottomSheet onClose={onClose} title="Filter pohon" visible={visible}>
      <View style={styles.filterSheetBody}>
        <FilterBadgeGroup title="Kondisi">
          {conditionOptions.map((option) => (
            <ChipButton
              key={option.value}
              active={draft.conditions.includes(option.value)}
              label={option.label}
              onPress={() =>
                onDraftChange({ ...draft, conditions: toggleArrayValue(draft.conditions, option.value) })
              }
            />
          ))}
        </FilterBadgeGroup>

        <FilterBadgeGroup title="Fase tumbuh">
          {phaseOptions.map((option) => (
            <ChipButton
              key={option.value}
              active={draft.phases.includes(option.value)}
              label={option.label}
              onPress={() =>
                onDraftChange({ ...draft, phases: toggleArrayValue(draft.phases, option.value) })
              }
            />
          ))}
        </FilterBadgeGroup>

        <FilterBadgeGroup title="Umur">
          {ageRangeOptions.map((option) => (
            <ChipButton
              key={option.value}
              active={draft.ageRanges.includes(option.value)}
              label={option.label}
              onPress={() =>
                onDraftChange({ ...draft, ageRanges: toggleArrayValue(draft.ageRanges, option.value) })
              }
            />
          ))}
        </FilterBadgeGroup>

        {/* Kelompok berisi SATU badge, dan itu disengaja: ia bukan varian dari
            kondisi, fase, maupun umur — ketiganya menyaring APA YANG TERCATAT,
            yang ini menyaring APA YANG BELUM. Menyelipkannya ke salah satu
            kelompok di atas akan membuatnya terbaca sebagai fase keenam atau
            kondisi ketujuh. */}
        <FilterBadgeGroup title="Kelengkapan data">
          <ChipButton
            active={draft.onlyMissingVariety}
            label="Varietas belum diisi"
            onPress={() => onDraftChange({ ...draft, onlyMissingVariety: !draft.onlyMissingVariety })}
          />
        </FilterBadgeGroup>

        {/* Tombol tidak selebar sheet. Selebar penuh ia terbaca sebagai penutup
            halaman — sesuatu yang harus ditekan untuk keluar — padahal menutup
            sheet ini juga bisa lewat backdrop dan gestur. */}
        <View style={styles.sheetFooter}>
          <View style={styles.applyButtonWrap}>
            <Button title="Terapkan" variant="primary" onPress={onApply} />
          </View>
          <Pressable
            accessibilityRole="button"
            disabled={isDefault}
            hitSlop={{ bottom: 8, left: 8, right: 8, top: 8 }}
            onPress={() => onDraftChange(DEFAULT_TREE_FILTER_CRITERIA)}
          >
            <Text selectable={false} style={[styles.resetText, isDefault ? styles.resetTextDisabled : null]}>
              Atur ulang
            </Text>
          </Pressable>
        </View>
      </View>
    </BottomSheet>
  );
}

function FilterBadgeGroup({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <View style={styles.filterGroup}>
      <Text selectable style={styles.filterLabel}>
        {title}
      </Text>
      <View style={styles.badgeWrap}>{children}</View>
    </View>
  );
}

// Criteria disaring lewat matchesTreeCriteria di src/lib/treeBrowseState.ts —
// FUNGSI YANG SAMA yang dipakai layar denah, bukan salinan yang kebetulan
// berbunyi mirip. Yang tinggal di sini hanya pencarian teksnya, karena hanya
// tampilan daftar yang punya kolom pencarian.
function filterTrees(trees: Tree[], criteria: TreeFilterCriteria, search: string): Tree[] {
  return trees.filter((tree) => {
    if (!matchesTreeCriteria(tree, criteria)) {
      return false;
    }

    if (!search) {
      return true;
    }

    const searchableText = [
      formatTreeDisplayCode(tree),
      tree.treeCode,
      tree.activePlanting?.variety,
      tree.rowPosition,
      tree.columnPosition,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return searchableText.includes(search);
  });
}

function sortTreesByCode(trees: Tree[]): Tree[] {
  return [...trees].sort((first, second) =>
    formatTreeDisplayCode(first).localeCompare(formatTreeDisplayCode(second), 'id-ID', { numeric: true })
  );
}

function toggleArrayValue<T>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

const styles = StyleSheet.create({
  root: { backgroundColor: colors.background, flex: 1 },
  headerWrap: { gap: tokens.space.md, paddingHorizontal: spacing.screenHorizontal },
  tabsWrap: { paddingBottom: tokens.space.sm },
  rowDivider: {
    backgroundColor: tokens.color.line.hairline,
    height: StyleSheet.hairlineWidth,
  },
  resultCount: { ...tokens.type.meta, color: tokens.color.text.tertiary, fontWeight: '700', marginTop: -6 },
  filterSheetBody: { gap: tokens.space.md },
  filterGroup: { gap: tokens.space.sm },
  filterLabel: { ...tokens.type.label, color: tokens.color.text.primary },
  badgeWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space.sm },
  sheetFooter: { alignItems: 'center', gap: tokens.space.md, paddingTop: tokens.space.sm },
  applyButtonWrap: { width: '78%' },
  resetText: { ...tokens.type.label, color: tokens.color.brand.base },
  resetTextDisabled: { color: tokens.color.text.tertiary },
});
