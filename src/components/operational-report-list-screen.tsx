import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import {
  OPERATIONAL_REPORT_CATEGORIES,
  OPERATIONAL_REPORT_STATUSES,
} from '../constants/operationalReport';
import { colors, spacing, tokens } from '../constants/theme';
import { useAuth } from '../context/auth-context';
import { getFarmMemberBasicProfiles } from '../services/memberService';
import { getOperationalReports } from '../services/operationalReportService';
import { countOperationalReportPhotos } from '../services/photoAttachmentService';
import type {
  FarmMemberBasicProfile,
  MemberRole,
  OperationalReport,
  OperationalReportCategory,
  OperationalReportStatus,
} from '../types/domain';
import {
  formatDateOnly,
  formatOperationalReportCategory,
  formatOperationalReportStatus,
} from '../utils/displayFormat';
import { dayDifference, getTodayIsoDate, toWibIsoDate } from '../utils/taskDueDate';
import { BottomSheet } from './bottom-sheet';
import { Icon } from './icons';
import { getReportStatusTone } from './operational-report-common';
import {
  Badge,
  Button,
  ChipButton,
  EmptyState,
  ErrorBanner,
  FilterChipsRow,
  LoadingState,
  MainTabHeader,
  Screen,
  SearchFilterRow,
  withAlpha,
} from './ui';

type OperationalReportStatusFilter = 'all' | OperationalReportStatus;

type OperationalReportListScreenProps = {
  role: MemberRole;
  onProfilePress: () => void;
};

// Kriteria filter yang tinggal di bottom sheet: kategori (multi) + pelapor (owner saja).
// Status TIDAK di sini — dia chip yang selalu terlihat di atas daftar.
type ReportSheetCriteria = {
  categories: OperationalReportCategory[];
  reporter: string; // 'all' | userId
};

const DEFAULT_REPORT_CRITERIA: ReportSheetCriteria = {
  categories: [],
  reporter: 'all',
};

const reportStatusFilterOptions: OperationalReportStatusFilter[] = [
  'all',
  ...OPERATIONAL_REPORT_STATUSES,
];

// Lebar pita gradasi di tepi kanan deret chip status.
const CHIP_ROW_FADE_WIDTH = tokens.space.xxxl;

export function OperationalReportListScreen({ role, onProfilePress }: OperationalReportListScreenProps) {
  const isOwner = role === 'owner';
  const { currentFarm } = useAuth();
  const [criteria, setCriteria] = React.useState<ReportSheetCriteria>(DEFAULT_REPORT_CRITERIA);
  const [draft, setDraft] = React.useState<ReportSheetCriteria>(DEFAULT_REPORT_CRITERIA);
  const [error, setError] = React.useState<string | null>(null);
  const [filterSheetOpen, setFilterSheetOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [reports, setReports] = React.useState<OperationalReport[]>([]);
  const [searchQuery, setSearchQuery] = React.useState('');
  // Owner membuka layar ini untuk mengurus yang belum ditindaklanjuti, jadi
  // defaultnya 'new'. Pekerja datang untuk melihat nasib laporannya sendiri,
  // jadi defaultnya 'all'. Ini NILAI AWAL state saja — begitu user menekan chip
  // lain, tidak ada apa pun di sini yang mengembalikannya.
  const [statusFilter, setStatusFilter] = React.useState<OperationalReportStatusFilter>(
    isOwner ? 'new' : 'all'
  );
  const [memberNames, setMemberNames] = React.useState<Record<string, string>>({});
  const [photoCounts, setPhotoCounts] = React.useState<Record<string, number>>({});

  const farmId = currentFarm?.farmId;
  const todayIso = getTodayIsoDate();

  // Semua kriteria KECUALI status. Dipakai dua kali: sebagai dasar angka di chip
  // status, dan sebagai dasar daftar yang ditampilkan. Dengan begini angka di
  // chip selalu berarti "sebanyak ini yang akan kamu lihat kalau chip ini
  // ditekan" — bukan angka yang bertentangan dengan pencarian yang sedang aktif.
  const reportsBeforeStatusFilter = React.useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return reports.filter((report) => {
      const reporterName = memberNames[report.reportedBy] ?? '';
      const searchableParts = [
        formatOperationalReportCategory(report.category),
        report.description,
        report.locationNote,
      ];

      if (isOwner) {
        searchableParts.push(reporterName);
      }

      const searchableText = searchableParts.filter(Boolean).join(' ').toLowerCase();

      const matchesSearch = !normalizedQuery || searchableText.includes(normalizedQuery);
      const matchesCategory =
        criteria.categories.length === 0 || criteria.categories.includes(report.category);
      const matchesReporter = criteria.reporter === 'all' || report.reportedBy === criteria.reporter;

      return matchesSearch && matchesCategory && matchesReporter;
    });
  }, [criteria.categories, criteria.reporter, isOwner, memberNames, reports, searchQuery]);

  const filteredReports = React.useMemo(
    () =>
      statusFilter === 'all'
        ? reportsBeforeStatusFilter
        : reportsBeforeStatusFilter.filter((report) => report.status === statusFilter),
    [reportsBeforeStatusFilter, statusFilter]
  );

  // Angka chip dihitung dari baris yang SUDAH dimuat — nol query tambahan.
  // Chip berangka nol tetap dirender: "Ditolak · 0" adalah jawaban, sedangkan
  // chip yang hilang membuat user mengira filternya rusak.
  const statusCounts = React.useMemo(() => {
    const counts: Record<OperationalReportStatusFilter, number> = {
      all: reportsBeforeStatusFilter.length,
      in_progress: 0,
      new: 0,
      rejected: 0,
      resolved: 0,
    };

    for (const report of reportsBeforeStatusFilter) {
      counts[report.status] += 1;
    }

    return counts;
  }, [reportsBeforeStatusFilter]);

  const loadReports = React.useCallback(async () => {
    if (!farmId || !currentFarm || currentFarm.role !== role || currentFarm.status !== 'active') {
      setError('Hanya anggota kebun aktif yang dapat melihat laporan operasional.');
      setReports([]);
      setMemberNames({});
      return;
    }

    setError(null);

    const [reportsResult, membersResult] = await Promise.all([
      getOperationalReports(isOwner ? { farmId } : { farmId, reportedBy: currentFarm.userId }),
      getFarmMemberBasicProfiles(farmId),
    ]);

    if (reportsResult.error) {
      setError(reportsResult.error.message);
      setReports([]);
      setPhotoCounts({});
    } else {
      setReports(reportsResult.data);

      // Satu query untuk semua laporan yang dimuat, bukan satu per kartu.
      // Hanya jumlah, tanpa signed URL — signed URL-lah yang mahal.
      const countsResult = await countOperationalReportPhotos({
        farmId,
        operationalReportIds: reportsResult.data.map((report) => report.id),
      });

      setPhotoCounts(countsResult.error ? {} : countsResult.data);
    }

    if (membersResult.error) {
      setMemberNames({});
    } else {
      setMemberNames(
        Object.fromEntries(
          membersResult.data.map((member: FarmMemberBasicProfile) => [member.userId, member.fullName])
        )
      );
    }
  }, [currentFarm, farmId, isOwner, role]);

  useFocusEffect(
    React.useCallback(() => {
      setLoading(true);
      loadReports().finally(() => setLoading(false));
    }, [loadReports])
  );

  if (loading) {
    return <LoadingState message="Memuat laporan operasional..." />;
  }

  const activeFilterCount = criteria.categories.length + (criteria.reporter !== 'all' ? 1 : 0);
  const hasActiveFilters =
    statusFilter !== 'all' || activeFilterCount > 0 || searchQuery.trim().length > 0;
  const hasNoData = reports.length === 0;
  const filterEmptyCopy = getFilterEmptyCopy(statusFilter, isOwner);

  const reporterOptions: Array<{ label: string; value: string }> = [
    { label: 'Semua', value: 'all' },
    ...Object.entries(memberNames)
      .map(([userId, name]) => ({ label: name, value: userId }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  ];

  function openFilterSheet() {
    setDraft(criteria);
    setFilterSheetOpen(true);
  }

  function applyDraft() {
    setCriteria(draft);
    setFilterSheetOpen(false);
  }

  return (
    <Screen
      header={
        <MainTabHeader
          title="Laporan"
          roleLabel={isOwner ? 'Pemilik' : 'Pekerja'}
          onProfilePress={onProfilePress}
        />
      }
      // Hanya pekerja yang bisa membuat laporan. Owner tidak punya footer sama
      // sekali, jadi daftarnya memakai seluruh tinggi layar. Tinggi footer
      // diukur Screen lewat onLayout — tidak ada lagi paddingBottom tebakan.
      //
      // Saat layar kosong footer ini padam: EmptyState sudah membawa tombol
      // "Buat laporan" sendiri, dan dua tombol berlabel sama di satu layar cuma
      // saling mengulang.
      stickyFooter={
        role === 'worker' && !hasNoData ? (
          <Button title="Buat laporan" onPress={() => router.push('/worker/reports/create')} />
        ) : undefined
      }
    >
      <ErrorBanner message={error} />

      {error ? null : hasNoData ? (
        <View style={{ gap: tokens.space.lg }}>
          <EmptyState
            icon="clipboard"
            subtitle={
              isOwner
                ? 'Begitu pekerja mengirim laporan kondisi lapangan, semuanya muncul di sini.'
                : 'Kirim laporan kalau kamu menemukan kondisi lapangan yang perlu ditangani pemilik.'
            }
            title={isOwner ? 'Belum ada laporan dari pekerja' : 'Belum ada laporan'}
            variant="dashed"
          />
          {isOwner ? null : (
            <Button title="Buat laporan" onPress={() => router.push('/worker/reports/create')} />
          )}
        </View>
      ) : (
        <>
          <SearchFilterRow
            filterActive={activeFilterCount > 0}
            filterCount={activeFilterCount}
            onChangeText={setSearchQuery}
            onFilterPress={openFilterSheet}
            placeholder={isOwner ? 'Cari isi, lokasi, atau pelapor' : 'Cari isi atau lokasi'}
            value={searchQuery}
          />

          {/* Deret chip status sengaja BLEED ke tepi kanan layar lewat marginRight
              negatif. Tanpa itu deretnya berhenti rapi di batas padding dan
              terbaca seperti sudah habis; dengan itu chip terakhir terpotong oleh
              tepi layar, dan potongan itulah isyarat utama bahwa masih ada
              lanjutannya. Pita gradasi di bawah memperkuat isyarat, bukan
              menggantikannya — polanya sama persis dengan pita footer di Screen. */}
          <View style={{ position: 'relative' }}>
            <FilterChipsRow style={{ marginRight: -spacing.screenHorizontal }}>
              {reportStatusFilterOptions.map((status) => (
                <ChipButton
                  key={status}
                  active={statusFilter === status}
                  count={statusCounts[status]}
                  label={status === 'all' ? 'Semua' : formatOperationalReportStatus(status)}
                  onPress={() => setStatusFilter(status)}
                />
              ))}
            </FilterChipsRow>
            {/* pointerEvents 'none' WAJIB: tanpa itu pita ini menangkap sentuhan
                dan chip di belakangnya tidak bisa digulung maupun ditekan. */}
            <LinearGradient
              colors={[withAlpha(tokens.color.surface.canvas, 0), tokens.color.surface.canvas]}
              end={{ x: 1, y: 0 }}
              pointerEvents="none"
              start={{ x: 0, y: 0 }}
              style={{
                bottom: 0,
                position: 'absolute',
                right: -spacing.screenHorizontal,
                top: 0,
                width: CHIP_ROW_FADE_WIDTH,
              }}
            />
          </View>

          <Text selectable style={{ ...tokens.type.meta, color: tokens.color.text.tertiary }}>
            {hasActiveFilters
              ? `Menampilkan ${filteredReports.length} dari ${reports.length} laporan`
              : `Menampilkan ${filteredReports.length} laporan`}
          </Text>

          {filteredReports.length === 0 ? (
            <EmptyState
              icon="search"
              subtitle={filterEmptyCopy.subtitle}
              title={filterEmptyCopy.title}
              variant="dashed"
            />
          ) : (
            <View>
              {filteredReports.map((report, index) => (
                <View
                  key={report.id}
                  // Garis rambut sebagai pemisah, bukan kartu berbayang. Baris
                  // terakhir tidak diberi garis supaya daftarnya tidak terlihat
                  // menggantung.
                  style={
                    index === filteredReports.length - 1
                      ? undefined
                      : { borderBottomColor: tokens.color.line.hairline, borderBottomWidth: 1 }
                  }
                >
                  <OperationalReportRow
                    ageDays={getReportAgeDays(report, todayIso)}
                    photoCount={photoCounts[report.id] ?? 0}
                    report={report}
                    reporterName={memberNames[report.reportedBy]}
                    showReporter={isOwner}
                    // Pil status hanya berguna kalau daftarnya campur. Saat satu
                    // status sudah dipilih lewat chip, setiap baris pasti berstatus
                    // itu dan pilnya cuma pengulangan.
                    showStatus={statusFilter === 'all'}
                    onPress={() =>
                      router.push(isOwner ? `/owner/reports/${report.id}` : `/worker/reports/${report.id}`)
                    }
                  />
                </View>
              ))}
            </View>
          )}
        </>
      )}

      <ReportFilterSheet
        draft={draft}
        isOwner={isOwner}
        onApply={applyDraft}
        onClose={() => setFilterSheetOpen(false)}
        onDraftChange={setDraft}
        reporterOptions={reporterOptions}
        visible={filterSheetOpen}
      />
    </Screen>
  );
}

// Umur laporan yang sedang diproses, dalam hari WIB. null = tidak usah ditandai.
//
// Sengaja TIDAK melihat tugas tindak lanjut: data tugas tidak tersedia di layar
// ini, dan mengambilnya berarti query tambahan. Penanda ini murni dibaca dari
// responded_at yang sudah ada di baris laporan.
function getReportAgeDays(report: OperationalReport, todayIso: string): number | null {
  if (report.status !== 'in_progress') {
    return null;
  }

  const respondedIso = toWibIsoDate(report.respondedAt);

  // responded_at kosong pada baris in_progress berarti datanya tidak lengkap.
  // Lebih baik tidak menampilkan apa pun daripada menampilkan "0 hari" atau "-".
  if (!respondedIso) {
    return null;
  }

  const days = dayDifference(respondedIso, todayIso);

  // Baru diproses hari ini belum punya umur yang perlu diperingatkan, dan
  // "Diproses sejak 0 hari lalu" bukan kalimat yang benar.
  return days >= 1 ? days : null;
}

function getFilterEmptyCopy(
  statusFilter: OperationalReportStatusFilter,
  isOwner: boolean
): { subtitle: string; title: string } {
  // Filter 'new' yang kosong adalah KABAR BAIK, bukan kekosongan: artinya tidak
  // ada lagi yang menunggu ditangani. Kalimatnya harus terbaca begitu.
  if (statusFilter === 'new') {
    return {
      subtitle: isOwner
        ? 'Semua laporan yang masuk sudah kamu tindak lanjuti.'
        : 'Semua laporanmu sudah ditanggapi pemilik.',
      title: 'Tidak ada laporan yang menunggu',
    };
  }

  if (statusFilter === 'all') {
    return {
      subtitle: 'Coba ubah kata pencarian, kategori, atau pelapor yang dipilih.',
      title: 'Tidak ada laporan yang cocok',
    };
  }

  return {
    subtitle: `Belum ada laporan berstatus "${formatOperationalReportStatus(statusFilter)}" yang cocok dengan pencarian dan filter saat ini.`,
    title: 'Tidak ada laporan yang cocok',
  };
}

function OperationalReportRow({
  ageDays,
  onPress,
  photoCount,
  report,
  reporterName,
  showReporter,
  showStatus,
}: {
  ageDays: number | null;
  onPress: () => void;
  photoCount: number;
  report: OperationalReport;
  reporterName?: string;
  showReporter: boolean;
  showStatus: boolean;
}) {
  // Deskripsi selalu jadi judul. Sejak tahap 3 deskripsi wajib, jadi tidak ada
  // lagi cabang "kalau kosong pakai label kategori".
  const secondaryLine = [
    formatOperationalReportCategory(report.category),
    showReporter ? reporterName ?? 'Pelapor tidak tersedia' : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        gap: tokens.space.xs,
        opacity: pressed ? 0.6 : 1,
        paddingVertical: tokens.space.lg,
      })}
    >
      <View style={{ alignItems: 'flex-start', flexDirection: 'row', gap: tokens.space.sm }}>
        <Text
          selectable
          ellipsizeMode="tail"
          numberOfLines={2}
          style={{ ...tokens.type.subheading, color: tokens.color.text.primary, flex: 1 }}
        >
          {report.description}
        </Text>
        {showStatus ? (
          <Badge
            label={formatOperationalReportStatus(report.status)}
            tone={getReportStatusTone(report.status)}
          />
        ) : null}
      </View>

      <Text
        selectable
        ellipsizeMode="tail"
        numberOfLines={1}
        style={{ ...tokens.type.meta, color: tokens.color.text.secondary }}
      >
        {secondaryLine}
      </Text>

      <View style={{ alignItems: 'center', flexDirection: 'row', gap: tokens.space.sm }}>
        <Text selectable style={{ ...tokens.type.meta, color: tokens.color.text.tertiary }}>
          {formatDateOnly(report.createdAt)}
        </Text>
        {photoCount > 0 ? (
          <View style={{ alignItems: 'center', flexDirection: 'row', gap: tokens.space.xs }}>
            <Text selectable={false} style={{ ...tokens.type.meta, color: tokens.color.text.tertiary }}>
              ·
            </Text>
            <Icon name="camera" size={tokens.icon.sm} color={tokens.color.text.tertiary} />
            <Text selectable={false} style={{ ...tokens.type.meta, color: tokens.color.text.tertiary }}>
              {photoCount}
            </Text>
          </View>
        ) : null}
      </View>

      {ageDays === null ? null : (
        <Text selectable style={{ ...tokens.type.meta, color: tokens.color.status.warning.text }}>
          {`Diproses sejak ${ageDays} hari lalu`}
        </Text>
      )}
    </Pressable>
  );
}

function ReportFilterSheet({
  draft,
  isOwner,
  onApply,
  onClose,
  onDraftChange,
  reporterOptions,
  visible,
}: {
  draft: ReportSheetCriteria;
  isOwner: boolean;
  onApply: () => void;
  onClose: () => void;
  onDraftChange: (next: ReportSheetCriteria) => void;
  reporterOptions: Array<{ label: string; value: string }>;
  visible: boolean;
}) {
  const isDefault = draft.categories.length === 0 && draft.reporter === 'all';

  function toggleCategory(value: OperationalReportCategory) {
    const nextCategories = draft.categories.includes(value)
      ? draft.categories.filter((category) => category !== value)
      : [...draft.categories, value];
    onDraftChange({ ...draft, categories: nextCategories });
  }

  return (
    <BottomSheet onClose={onClose} title="Filter laporan" visible={visible}>
      <View style={{ gap: spacing.md }}>
        <View style={{ alignItems: 'flex-end' }}>
          <Pressable
            accessibilityRole="button"
            disabled={isDefault}
            hitSlop={{ bottom: 8, left: 8, right: 8, top: 8 }}
            onPress={() => onDraftChange(DEFAULT_REPORT_CRITERIA)}
          >
            <Text
              selectable={false}
              style={{
                color: isDefault ? colors.textMuted : colors.primary,
                fontSize: 14,
                fontWeight: '700',
              }}
            >
              Atur ulang
            </Text>
          </Pressable>
        </View>

        <View style={{ gap: spacing.sm }}>
          <Text selectable style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>
            Kategori
          </Text>
          <FilterChipsRow>
            {OPERATIONAL_REPORT_CATEGORIES.map((category) => (
              <ChipButton
                key={category}
                active={draft.categories.includes(category)}
                label={formatOperationalReportCategory(category)}
                onPress={() => toggleCategory(category)}
              />
            ))}
          </FilterChipsRow>
        </View>

        {isOwner ? (
          <View style={{ gap: spacing.sm }}>
            <Text selectable style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>
              Pelapor
            </Text>
            <FilterChipsRow>
              {reporterOptions.map((option) => (
                <ChipButton
                  key={option.value}
                  active={draft.reporter === option.value}
                  label={option.label}
                  onPress={() => onDraftChange({ ...draft, reporter: option.value })}
                />
              ))}
            </FilterChipsRow>
          </View>
        ) : null}

        <Button title="Terapkan" variant="primary" onPress={onApply} />
      </View>
    </BottomSheet>
  );
}
