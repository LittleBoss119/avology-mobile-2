import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomSheet } from '../../../../src/components/bottom-sheet';
import { FarmMapScreen } from '../../../../src/components/farm-map-screen';
import { TreeCard } from '../../../../src/components/tree-components';
import {
  Button,
  ChipButton,
  EmptyState,
  ErrorBanner,
  FilterChipsRow,
  LoadingState,
  SearchFilterRow,
  Screen,
  SegmentedControl,
} from '../../../../src/components/ui';
import { colors, spacing, tokens } from '../../../../src/constants/theme';
import { useAuth } from '../../../../src/context/auth-context';
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
} from '../../../../src/lib/treeBrowseState';
import { listTreeMainPhotosForFarm } from '../../../../src/services/photoAttachmentService';
import { getTrees } from '../../../../src/services/treeService';
import type { Tree, TreeConditionStatus } from '../../../../src/types/domain';
import type { TreeMainPhotoMap } from '../../../../src/types/media';
import {
  formatGrowthPhase,
  formatTreeConditionStatus,
  formatTreeDisplayCode,
} from '../../../../src/utils/treeFormat';

// Label DITURUNKAN dari formatter bersama, tidak ditulis tangan. Menyalin
// teksnya ke sini persis yang dulu membuat chip di layar ini menyebut nama yang
// berbeda dari yang tertulis di baris daftar dan di legenda peta. Urutannya
// tetap ditulis eksplisit — itu urutan tampil, bukan label.
const conditionOptions: Array<{ label: string; value: TreeConditionStatus }> = (
  ['healthy', 'needs_attention', 'pest_attacked', 'disease_indicated', 'damaged', 'dead'] as const
).map((value) => ({ label: formatTreeConditionStatus(value), value }));

// Lima nilai enum PLUS 'unrecorded'. Yang terakhir bukan tambalan: kolom
// trees.current_growth_phase nullable tanpa default, jadi "belum dicatat" adalah
// keadaan yang benar-benar dimiliki data dan sebelum ini tidak punya satu pun
// cara untuk ditemukan. Labelnya diambil dari formatGrowthPhase(null), bukan
// diketik ulang, supaya ia tidak bisa berbeda dari teks yang sama di baris
// daftar.
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

// Deret chip kondisi: "Semua" plus keenam nilai enum, MULTI-PILIH.
//
// Dulu tiap chip memilih tepat satu kondisi dan menimpa pilihan sebelumnya, jadi
// "tunjukkan semua yang bermasalah" — perkara paling sering di layar ini —
// mustahil ditanyakan. Sekarang chip menyalakan dan memadamkan anggotanya
// sendiri, dan empat kondisi non-mati bisa dinyalakan bersamaan.
//
// "Semua" bukan anggota himpunan melainkan jalan mengosongkannya, jadi ia tidak
// ikut di-toggle: menekannya selalu berarti conditions = [].
const CONDITION_CHIP_ALL = 'all';

// Route induk. Ia memiliki SATU hal: tampilan mana yang sedang dipandang.
//
// Header dan segmented dirender DI SINI, di luar percabangan, jadi keduanya
// tidak ikut bertukar — judul tidak berganti, tidak ada tombol back yang
// muncul, dan kepala layar tidak dirender ulang saat pengguna berpindah
// Daftar/Denah. Itu seluruh sebab kedua tampilan disatukan jadi satu route.
//
// TANPA <Screen> di tingkat ini, dan itu WAJIB: Screen membungkus children-nya
// dengan ScrollView vertikal, dan denah punya dua penggulungnya sendiri. Anak
// flex:1 di dalam ScrollView tidak pernah mendapat tinggi terbatas, jadi
// petaknya akan kolaps. Screen tetap dipakai, tapi HANYA di dalam cabang
// daftar, tempat ia memang benar.
//
// RENDER KONDISIONAL YANG BENAR-BENAR MELEPAS, bukan display:none.
// useFocusEffect terikat pada fokus ROUTE, bukan pada visibilitas komponen —
// kalau daftar dan denah ter-mount bersamaan, setiap kali route ini difokus
// getTrees dipanggil dua kali, ditambah getFarmDetail dan ratusan permintaan
// foto milik daftar. Harganya: berpindah tampilan memuat ulang datanya, dan
// posisi gulung petak hilang. Keduanya diterima.
export default function WorkerTreesScreen() {
  // Inset atas diterapkan DI SINI, bukan lewat prop `applyTopInset` pada
  // Screen seperti keempat tab root lain. Alasannya bentuk layar ini:
  // `headerWrap` adalah elemen teratas yang nyata untuk KEDUA cabang,
  // sementara Screen hanya ada di dalam cabang daftar — di bawah segmented,
  // dan sama sekali tidak ada di cabang denah (FarmMapScreen). Padding di
  // headerWrap ikut menyelamatkan cabang denah itu.
  const insets = useSafeAreaInsets();

  // Dibaca di FASE RENDER, di dalam penginisialisasi useState. Kalau dibaca di
  // effect, layar selalu melukis Daftar sekali lebih dulu lalu bertukar ke
  // Denah satu frame kemudian — kedipan yang terlihat jelas justru pada
  // pengguna yang memang lebih sering memakai denah.
  const [view, setView] = React.useState<TreeBrowseView>(peekTreeBrowseView);

  // Disinkronkan ulang saat route kembali difokus. Ini yang membuat pengalih
  // di /worker/trees/map bekerja: ia menyetel modul lalu router.replace ke sini, dan
  // kalau layar ini ternyata dipakai ulang alih-alih dipasang ulang,
  // penginisialisasi useState di atas TIDAK jalan lagi. Effect ini yang
  // menangkap keadaan itu. Saat nilainya tidak berubah, ia tidak berbuat apa-apa.
  useFocusEffect(
    React.useCallback(() => {
      setView(peekTreeBrowseView());
    }, [])
  );

  function changeView(key: string) {
    const next: TreeBrowseView = key === 'map' ? 'map' : 'list';

    setView(next);
    setTreeBrowseView(next);
  }

  return (
    <View style={styles.root}>
      {/* Judul layar dibuang: tab bar di bawah sudah menamai layar ini dan
          menyalakannya. Angkanya dirakit saat render, bukan di
          StyleSheet.create, karena insets.top baru diketahui saat itu.

          `spacing.xl + insets.top` DISENGAJA, bukan Math.max(insets.top,
          spacing.sm) seperti TopAppBar: ini rumus yang sama persis dengan yang
          dipakai Screen saat applyTopInset menyala (ui.tsx), sehingga jarak
          atas layar Pohon identik dengan ketiga tab root lainnya. */}
      <View style={[styles.headerWrap, { paddingTop: spacing.xl + insets.top }]}>
        <View style={styles.segmentedWrap}>
          <SegmentedControl onChange={changeView} options={SEGMENT_OPTIONS} value={view} />
        </View>
      </View>

      {view === 'list' ? <TreeListView /> : <FarmMapScreen basePath="/worker/trees" />}
    </View>
  );
}

// Cabang daftar. Ia memiliki SELURUH keadaan daftar — pohon, foto, filter,
// sheet — dan tidak tahu apa pun tentang segmented di atasnya.
//
// <Screen> dipakai DI SINI, tanpa prop `header`: headernya sudah dirender induk
// di luar percabangan. Screen tetap yang paling benar untuk cabang ini — ia yang
// membawa penggulung vertikal, padding tepi, dan footer melekat.
function TreeListView() {
  const { currentFarm } = useAuth();
  // Pencarian dan filter DIPULIHKAN di fase render, bukan di effect. Kalau
  // dibaca di effect, render pertama melukis seluruh daftar tanpa filter lalu
  // menggantinya sekejap kemudian — dan layar inilah yang isinya paling banyak,
  // jadi kedipannya paling terlihat. Polanya sama dengan peekPendingCareTrees di
  // farm-care-record-screen, termasuk alasannya.
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

  const loadTrees = React.useCallback(async () => {
    if (!farmId) {
      setError('Data kebun aktif tidak ditemukan.');
      setTrees([]);
      setPhotoMap({});
      return;
    }

    setError(null);

    // archived: false sebagai literal, sama dengan enam pemanggil getTrees lain
    // di repo. Sebelumnya nilainya dibaca dari criteria, tapi sumbu arsipnya
    // sudah dipagari includeStatus={false} di layar ini dan kini dicabut
    // seluruhnya. Parameternya sendiri TETAP ada di getTrees.
    const result = await getTrees({
      archived: false,
      farmId,
    });

    if (result.error) {
      setError(result.error.message);
      setTrees([]);
      setPhotoMap({});
      return;
    }

    setTrees(result.data);

    // Sama seperti daftar pohon sisi pemilik: siklus aktif tiap posisi diambil
    // dari data yang sudah dimuat, supaya posisi yang ditanami ulang tidak
    // menampilkan foto pohon lama.
    const photoResult = await listTreeMainPhotosForFarm(
      farmId,
      Object.fromEntries(result.data.map((tree) => [tree.id, tree.activePlanting?.id ?? null]))
    );

    if (photoResult.error) {
      setPhotoMap({});
      return;
    }

    setPhotoMap(photoResult.data);
  }, [farmId]);

  // Ref dimulai dari farmId SEKARANG, jadi effect ini tidak berbuat apa-apa pada
  // pemasangan pertama. Itu syaratnya: kalau ia jalan saat mount, ia akan
  // menghapus pencarian dan filter yang baru saja dipulihkan di fase render dua
  // puluh baris di atas — persis yang seluruh modul treeBrowseState ada untuk
  // mencegahnya.
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
  // deret chip yang aktif tepat di bawahnya. Sumbu kondisi sekarang memang juga
  // hadir di dalam sheet, tapi itu tidak membuatnya tersembunyi — keduanya dua
  // pandangan atas satu nilai yang sama, dan menghitungnya di sini berarti
  // menekan chip menaikkan angka yang mengaku mewakili hal lain.
  const activeGroupCount =
    (criteria.phases.length > 0 ? 1 : 0) +
    (criteria.ageRanges.length > 0 ? 1 : 0) +
    (criteria.onlyMissingVariety ? 1 : 0);

  // Daftar kosong di sini memang berarti kebunnya belum punya pohon. Nol hasil
  // karena filter ditangani cabang empty state yang lain.
  const isFarmEmpty = trees.length === 0;

  // SATU pintu untuk setiap perubahan filter: state React dan modul penyimpan
  // ditulis berbarengan, jadi tidak ada jalur yang mengubah salah satunya saja.
  // Sengaja menerima nilai jadi, bukan updater — pemanggilnya membaca `criteria`
  // yang sedang berlaku, dan modulnya butuh nilai akhir untuk disimpan.
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
    return <LoadingState message="Memuat pohon..." />;
  }

  return (
    // TANPA stickyFooter "Tambah pohon". Bukan kelalaian: menambah pohon menuntut
    // pemilik aktif di sisi database — create_tree_with_planting dan
    // create_trees_at_positions sama-sama menolak pekerja — dan layar ini memang
    // tidak pernah punya jalan ke sana. Tombolnya tidak dirender sama sekali,
    // bukan dirender lalu dinonaktifkan: tombol mati yang selalu mati hanya
    // menjanjikan sesuatu yang tidak akan pernah terjadi.
    <Screen>
      <ErrorBanner message={error} />

      {/* Kebun yang belum punya pohon tidak diberi kolom pencarian, deret chip,
          maupun "Menampilkan 0 pohon": tidak ada yang bisa dicari atau disaring,
          dan ketiganya cuma menunda empty state yang jadi satu-satunya isi
          berguna di layar ini. Begitu ada pohon, ketiganya kembali — termasuk
          saat filter tidak menghasilkan apa-apa, karena di sana justru kontrol
          itulah jalan keluarnya. */}
      {isFarmEmpty ? null : (
        <>
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
          <EmptyState
            icon="tree"
            subtitle="Data pohon akan muncul setelah pemilik menambahkannya."
            title="Belum ada pohon"
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
        // Satu kolom dengan garis rambut antar baris, bukan grid dua kolom.
        // Baris terakhir tidak diberi garis supaya daftarnya tidak menggantung.
        <View>
          {displayedTrees.map((tree, index) => (
            <React.Fragment key={tree.id}>
              {index > 0 ? <View style={styles.rowDivider} /> : null}
              <TreeCard
                photoUrl={photoMap[tree.id]?.signedUrl}
                tree={tree}
                onPress={() => router.push(`/worker/trees/${tree.id}`)}
              />
            </React.Fragment>
          ))}
        </View>
      )}
    </Screen>
  );
}

const SEGMENT_OPTIONS = [
  { key: 'list', label: 'Daftar' },
  { key: 'map', label: 'Denah' },
];

function ResultCount({ count }: { count: number }) {
  return (
    <Text selectable style={styles.resultCount}>
      {`Menampilkan ${count} pohon`}
    </Text>
  );
}

// Seluruh sumbu filter sebagai BADGE yang bisa dinyalakan bersamaan, bukan
// daftar pilihan yang memanjang ke bawah. Empat kelompok muat dalam satu
// pandangan tanpa menggulung sheet, dan itu yang membuat "sehat DAN berbuah DAN
// di atas 3 tahun" bisa dirakit tanpa kehilangan jejak apa yang sudah dipilih.
//
// Kelompoknya membungkus ke bawah (flexWrap), bukan menggulung ke samping:
// gulungan mendatar menyembunyikan pilihan di luar layar, dan di dalam sheet
// tidak ada alasan untuk itu — ruangnya ada.
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
  // Kondisi IKUT diperiksa sekarang, tidak seperti sebelumnya. Dulu ia
  // dikecualikan karena sumbu itu hidup di luar sheet dan "Atur ulang" tidak
  // boleh diam-diam membatalkan pilihan yang dibuat di tempat lain. Kini kondisi
  // hadir di sheet ini juga, jadi tombol yang mengaku mengatur ulang isi sheet
  // harus benar-benar mengatur ulang seluruhnya.
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
            kondisi ketujuh.

            HADIR JUGA UNTUK PEKERJA, walau melengkapi varietas bukan
            pekerjaannya. Menyaring bukan menulis: pekerja yang menemukan pohon
            tanpa varietas punya alasan sah untuk melihat daftarnya, dan
            menyembunyikan sumbu ini darinya berarti ia harus menelusuri seluruh
            kebun untuk pertanyaan yang satu ketukan. */}
        <FilterBadgeGroup title="Kelengkapan data">
          <ChipButton
            active={draft.onlyMissingVariety}
            label="Varietas belum diisi"
            onPress={() => onDraftChange({ ...draft, onlyMissingVariety: !draft.onlyMissingVariety })}
          />
        </FilterBadgeGroup>

        {/* Tombol tidak selebar sheet. Selebar penuh ia terbaca sebagai penutup
            halaman — sesuatu yang harus ditekan untuk keluar — padahal menutup
            sheet ini juga bisa lewat backdrop dan gestur. Dipersempit, ia kembali
            jadi satu pilihan di antara pilihan lain, dan "Atur ulang" di bawahnya
            punya ruang untuk terbaca sebagai pasangannya, bukan sisipan. */}
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
// layar daftar yang punya kolom pencarian.
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
      .join(" ")
      .toLowerCase();

    return searchableText.includes(search);
  });
}

function sortTreesByCode(trees: Tree[]): Tree[] {
  return [...trees].sort((first, second) =>
    formatTreeDisplayCode(first).localeCompare(formatTreeDisplayCode(second), 'id-ID', { numeric: true })
  );
}

function getTreeAgeYears(plantedAt?: string | null): number | null {
  if (!plantedAt) {
    return null;
  }

  const plantedDate = new Date(plantedAt);

  if (Number.isNaN(plantedDate.getTime())) {
    return null;
  }

  return (Date.now() - plantedDate.getTime()) / 31_536_000_000;
}

function toggleArrayValue<T>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

const styles = StyleSheet.create({
  root: { backgroundColor: colors.background, flex: 1 },
  headerWrap: { paddingHorizontal: spacing.screenHorizontal },
  segmentedWrap: { paddingBottom: tokens.space.md, paddingTop: tokens.space.xs },
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
