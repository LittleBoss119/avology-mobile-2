import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import {
  OPERATIONAL_REPORT_CATEGORIES,
  OPERATIONAL_REPORT_STATUSES,
} from '../constants/operationalReport';
import { colors, radius, spacing } from '../constants/theme';
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
import { BottomSheet } from './bottom-sheet';
import { getReportStatusTone } from './operational-report-common';
import {
  Badge,
  Button,
  CameraGlyph,
  Card,
  ChipButton,
  CompactMetaItem,
  EmptyState,
  ErrorBanner,
  FilterChipsRow,
  FloatingActionButton,
  LoadingState,
  MainTabHeader,
  Screen,
  SearchFilterRow,
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
  const [statusFilter, setStatusFilter] = React.useState<OperationalReportStatusFilter>('all');
  const [memberNames, setMemberNames] = React.useState<Record<string, string>>({});
  const [photoCounts, setPhotoCounts] = React.useState<Record<string, number>>({});

  const farmId = currentFarm?.farmId;

  const filteredReports = React.useMemo(() => {
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
      const matchesStatus = statusFilter === 'all' || report.status === statusFilter;
      const matchesCategory =
        criteria.categories.length === 0 || criteria.categories.includes(report.category);
      const matchesReporter = criteria.reporter === 'all' || report.reportedBy === criteria.reporter;

      return matchesSearch && matchesStatus && matchesCategory && matchesReporter;
    });
  }, [criteria.categories, criteria.reporter, isOwner, memberNames, reports, searchQuery, statusFilter]);

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
      // Ruang ekstra di bawah supaya FAB tidak menutupi kartu terakhir.
      contentStyle={{ paddingBottom: 160 }}
      floatingAction={
        role === 'worker' ? (
          <FloatingActionButton label="Buat laporan" onPress={() => router.push('/worker/reports/create')} />
        ) : undefined
      }
      header={
        <MainTabHeader
          title="Laporan"
          roleLabel={isOwner ? 'Pemilik' : 'Pekerja'}
          onProfilePress={onProfilePress}
        />
      }
    >
      <ErrorBanner message={error} />

      {error ? null : hasNoData ? (
        <EmptyState
          title="Belum ada laporan"
          subtitle={
            isOwner
              ? 'Laporan dari pekerja akan muncul di sini.'
              : 'Buat laporan jika ada kondisi lapangan.'
          }
        />
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

          {/* Bleed ke tepi kanan layar: tanpa ini chip terakhir terlihat
              terpotong di tengah-tengah padding, bukan jelas berlanjut. */}
          <FilterChipsRow style={{ marginRight: -spacing.screenHorizontal }}>
            {reportStatusFilterOptions.map((status) => (
              <ChipButton
                key={status}
                active={statusFilter === status}
                label={status === 'all' ? 'Semua' : formatOperationalReportStatus(status)}
                onPress={() => setStatusFilter(status)}
              />
            ))}
          </FilterChipsRow>

          <Text selectable style={{ color: colors.textMuted, fontSize: 13, lineHeight: 18 }}>
            {hasActiveFilters
              ? `Menampilkan ${filteredReports.length} dari ${reports.length} laporan`
              : `Menampilkan ${filteredReports.length} laporan`}
          </Text>

          {filteredReports.length === 0 ? (
            <EmptyState title="Tidak ada laporan pada filter ini" />
          ) : (
            <View style={{ gap: spacing.md }}>
              {filteredReports.map((report) => (
                <OperationalReportCard
                  key={report.id}
                  photoCount={photoCounts[report.id] ?? 0}
                  report={report}
                  reporterName={memberNames[report.reportedBy]}
                  showReporter={isOwner}
                  onPress={() =>
                    router.push(isOwner ? `/owner/reports/${report.id}` : `/worker/reports/${report.id}`)
                  }
                />
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

function OperationalReportCard({
  onPress,
  photoCount,
  report,
  reporterName,
  showReporter,
}: {
  onPress?: () => void;
  photoCount: number;
  report: OperationalReport;
  reporterName?: string;
  showReporter: boolean;
}) {
  // Deskripsi selalu jadi judul. Sejak tahap 3 deskripsi wajib, jadi tidak ada
  // lagi cabang "kalau kosong pakai label kategori".
  const content = (
    <Card padding={spacing.md}>
      <View style={{ gap: spacing.sm }}>
        <View
          style={{
            alignItems: 'flex-start',
            flexDirection: 'row',
            gap: spacing.sm,
            justifyContent: 'space-between',
          }}
        >
          <Text
            selectable
            ellipsizeMode="tail"
            numberOfLines={2}
            style={{ color: colors.text, flex: 1, fontSize: 15, fontWeight: '600', lineHeight: 21 }}
          >
            {report.description}
          </Text>
          <Badge
            label={formatOperationalReportStatus(report.status)}
            tone={getReportStatusTone(report.status)}
          />
        </View>

        <View style={{ alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          <Badge label={formatOperationalReportCategory(report.category)} tone="info" />
          {report.locationNote ? <CompactMetaItem icon="target" label={report.locationNote} /> : null}
        </View>

        <View style={{ alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
          <CompactMetaItem icon="calendar" label={formatDateOnly(report.createdAt)} />
          {showReporter ? (
            <CompactMetaItem icon="user" label={reporterName ?? 'Pelapor tidak tersedia'} />
          ) : null}
          {photoCount > 0 ? <PhotoCountChip count={photoCount} /> : null}
        </View>
      </View>
    </Card>
  );

  if (!onPress) {
    return content;
  }

  return <Pressable onPress={onPress}>{content}</Pressable>;
}

function PhotoCountChip({ count }: { count: number }) {
  return (
    <View
      style={{
        alignItems: 'center',
        backgroundColor: colors.successBg,
        borderColor: colors.successBorder,
        borderRadius: radius.round,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 4,
        paddingHorizontal: spacing.sm,
        paddingVertical: 3,
      }}
    >
      <CameraGlyph color={colors.success} />
      <Text selectable={false} style={{ color: colors.success, fontSize: 12, fontWeight: '700' }}>
        {count}
      </Text>
    </View>
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
