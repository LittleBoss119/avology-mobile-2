import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { Alert, Image, Modal, Pressable, Text, TextInput, View } from 'react-native';

import { colors, radius, spacing, typography } from '../constants/theme';
import { useAuth } from '../context/auth-context';
import {
  createTaskFromOperationalReport,
  getOperationalReportFollowUpTasks,
} from '../services/careTaskService';
import { getActiveWorkers, getFarmMemberBasicProfiles } from '../services/memberService';
import {
  listTaskProofPhotosForActivities,
} from '../services/photoAttachmentService';
import {
  createOperationalReport,
  getOperationalReportEditEligibility,
  getOperationalReportDetail,
  getOperationalReports,
  updateOwnOperationalReport,
  updateOperationalReportStatus,
} from '../services/operationalReportService';
import { getTrees } from '../services/treeService';
import type {
  CreateTaskFromOperationalReportInput,
  ActivityStatus,
  CareTaskDetail,
  FarmMemberBasicProfile,
  OperationalReport,
  OperationalReportCategory,
  OperationalReportStatus,
  TargetType,
  TaskStatus,
  Tree,
  WorkerMembership,
} from '../types/domain';
import type {
  TaskProofPhotoMap,
} from '../types/media';
import { BottomSheet } from './bottom-sheet';
import {
  formatCareTarget,
  ProofRequirementToggle,
  formatTaskStatus,
} from './care-schedule-components';
import { formatCareCategory } from './care-sop-components';
import { TaskProofPhotoPreview } from './task-proof-photo';
import {
  formatDateOnly,
  formatOperationalReportCategory,
  formatOperationalReportStatus,
  formatTargetType,
} from '../utils/displayFormat';
import { formatTreeLocation } from '../utils/treeFormat';
import {
  appTheme,
  Badge,
  Button,
  CameraGlyph,
  Card,
  ChipButton,
  CompactMetaItem,
  DateField,
  EmptyState,
  ErrorBanner,
  Field,
  FilterChipsRow,
  FloatingActionButton,
  FormSection,
  LoadingState,
  MainTabHeader,
  MetaRow,
  Screen,
  SearchFilterRow,
  SectionHeader,
  SuccessBanner,
  TopAppBar,
} from './ui';

const operationalReportCategoryOptions: OperationalReportCategory[] = [
  'pest',
  'disease',
  'land_damage',
  'broken_tool',
  'worker_need',
  'weather',
  'disaster',
  'out_of_stock',
  'other',
];

const operationalReportStatusOptions: OperationalReportStatus[] = [
  'new',
  'in_progress',
  'resolved',
  'rejected',
];

type OperationalReportStatusFilter = 'all' | OperationalReportStatus;

function canCreateTaskFromReportStatus(status: OperationalReportStatus): boolean {
  return status !== 'resolved' && status !== 'rejected';
}

function getClosedReportTaskMessage(status: OperationalReportStatus): string {
  if (status === 'resolved') {
    return 'Laporan yang sudah selesai tidak dapat dibuatkan tugas tindak lanjut.';
  }

  return 'Laporan yang ditolak tidak dapat dibuatkan tugas tindak lanjut.';
}

export function WorkerCreateOperationalReportScreen() {
  const { currentFarm } = useAuth();
  const [category, setCategory] = React.useState<OperationalReportCategory | null>(null);
  const [description, setDescription] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [locationNote, setLocationNote] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [success, setSuccess] = React.useState<string | null>(null);
  const redirectTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (redirectTimer.current) {
        clearTimeout(redirectTimer.current);
      }
    };
  }, []);

  async function handleSubmit() {
    if (!currentFarm?.farmId || currentFarm.role !== 'worker' || currentFarm.status !== 'active') {
      setError('Hanya pekerja aktif yang dapat membuat laporan operasional.');
      return;
    }

    if (!category) {
      setError('Kategori laporan wajib dipilih.');
      return;
    }

    if (!locationNote.trim() && !description.trim()) {
      setError('Isi lokasi atau deskripsi laporan.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    const result = await createOperationalReport({
      category,
      description,
      farmId: currentFarm.farmId,
      locationNote,
    });

    if (result.error) {
      setError(result.error.message);
      setSubmitting(false);
      return;
    }

    finishOperationalReport();
  }

  function finishOperationalReport() {
    if (redirectTimer.current) {
      clearTimeout(redirectTimer.current);
    }

    setSubmitting(false);
    setSuccess('Laporan operasional berhasil dikirim.');
    redirectTimer.current = setTimeout(() => {
      router.replace('/worker/reports');
    }, 900);
  }

  return (
    <Screen
      footer={
        <>
          <Button title="Kirim Laporan" loading={submitting} onPress={handleSubmit} />
          <Button disabled={submitting} title="Batal" variant="secondary" onPress={() => router.back()} />
        </>
      }
    >
      <TopAppBar title="Buat Laporan" onBack={() => router.back()} />
      <ErrorBanner message={error} />
      <SuccessBanner message={success} />

      <FormSection title="Kategori">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {operationalReportCategoryOptions.map((option) => (
            <ChipButton
              key={option}
              active={category === option}
              label={formatOperationalReportCategory(option)}
              onPress={() => setCategory(option)}
            />
          ))}
        </View>
      </FormSection>

      <FormSection title="Target">
        <Field
          label="Target/Lokasi"
          onChangeText={setLocationNote}
          placeholder="Contoh: Gudang alat atau Baris A"
          value={locationNote}
        />
      </FormSection>

      <FormSection title="Catatan">
        <TextArea
          label="Deskripsi"
          onChangeText={setDescription}
          placeholder="Contoh: Selang penyemprot pecah"
          value={description}
        />
      </FormSection>
    </Screen>
  );
}

type OperationalReportListScreenProps = {
  role: 'owner' | 'worker';
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

const reportStatusFilterOptions: OperationalReportStatusFilter[] = ['all', ...operationalReportStatusOptions];

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
  const [workerNames, setWorkerNames] = React.useState<Record<string, string>>({});

  const farmId = currentFarm?.farmId;

  const filteredReports = React.useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return reports.filter((report) => {
      const reporterName = workerNames[report.reportedBy] ?? '';
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
  }, [criteria.categories, criteria.reporter, isOwner, reports, searchQuery, statusFilter, workerNames]);

  const loadReports = React.useCallback(async () => {
    if (!farmId || !currentFarm || currentFarm.role !== role || currentFarm.status !== 'active') {
      setError('Hanya anggota kebun aktif yang dapat melihat laporan operasional.');
      setReports([]);
      setWorkerNames({});
      return;
    }

    setError(null);

    const [reportsResult, workersResult] = await Promise.all([
      getOperationalReports(isOwner ? { farmId } : { farmId, reportedBy: currentFarm.userId }),
      getFarmMemberBasicProfiles(farmId),
    ]);

    if (reportsResult.error) {
      setError(reportsResult.error.message);
      setReports([]);
    } else {
      setReports(reportsResult.data);
    }

    if (workersResult.error) {
      setWorkerNames({});
    } else {
      setWorkerNames(
        Object.fromEntries(
          workersResult.data.map((worker: FarmMemberBasicProfile) => [worker.userId, worker.fullName])
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
    ...Object.entries(workerNames)
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

          <FilterChipsRow>
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
            <View style={{ gap: 12 }}>
              {filteredReports.map((report) => (
                <OperationalReportCard
                  key={report.id}
                  report={report}
                  reporterName={workerNames[report.reportedBy]}
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
              style={{ color: isDefault ? colors.textMuted : colors.primary, fontSize: 14, fontWeight: '700' }}
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
            {operationalReportCategoryOptions.map((category) => (
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

export function WorkerOperationalReportDetailScreen({ reportId }: { reportId?: string }) {
  const { currentFarm } = useAuth();
  const [error, setError] = React.useState<string | null>(null);
  const [followUpTasks, setFollowUpTasks] = React.useState<CareTaskDetail[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [report, setReport] = React.useState<OperationalReport | null>(null);
  const [workerNames, setWorkerNames] = React.useState<Record<string, string>>({});

  const farmId = currentFarm?.farmId;

  const loadDetail = React.useCallback(async () => {
    const normalizedReportId = reportId?.trim();

    if (!normalizedReportId) {
      setError('Data laporan tidak ditemukan.');
      setFollowUpTasks([]);
      setReport(null);
      setWorkerNames({});
      return;
    }

    if (!farmId || currentFarm?.role !== 'worker' || currentFarm.status !== 'active') {
      setError('Hanya pekerja aktif yang dapat melihat detail laporan operasional.');
      setFollowUpTasks([]);
      setReport(null);
      setWorkerNames({});
      return;
    }

    setError(null);

    const [reportResult, workersResult] = await Promise.all([
      getOperationalReportDetail({ operationalReportId: normalizedReportId }),
      getFarmMemberBasicProfiles(farmId),
    ]);

    if (reportResult.error) {
      setError(reportResult.error.message);
      setFollowUpTasks([]);
      setReport(null);
    } else if (reportResult.data.reportedBy !== currentFarm.userId) {
      setError('Laporan tidak ditemukan atau bukan laporan milik Anda.');
      setFollowUpTasks([]);
      setReport(null);
    } else {
      setReport(reportResult.data);

      const tasksResult = await getOperationalReportFollowUpTasks({
        operationalReportId: normalizedReportId,
      });

      if (tasksResult.error) {
        setError(tasksResult.error.message);
        setFollowUpTasks([]);
      } else {
        setFollowUpTasks(tasksResult.data);
      }
    }

    if (workersResult.error) {
      setWorkerNames({});
    } else {
      setWorkerNames(
        Object.fromEntries(
          workersResult.data.map((worker: FarmMemberBasicProfile) => [worker.userId, worker.fullName])
        )
      );
    }
  }, [currentFarm?.role, currentFarm?.status, currentFarm?.userId, farmId, reportId]);

  useFocusEffect(
    React.useCallback(() => {
      setLoading(true);
      loadDetail().finally(() => setLoading(false));
    }, [loadDetail])
  );

  if (loading) {
    return <LoadingState message="Memuat detail laporan..." />;
  }

  if (!report) {
    return (
      <Screen>
        <TopAppBar title="Detail Laporan" onBack={() => router.back()} />
        <ErrorBanner message={error} />
        <EmptyState title="Laporan tidak ditemukan" subtitle="Laporan mungkin tidak tersedia atau akses ditolak." />
      </Screen>
    );
  }

  const canEditReport =
    report.status === 'new' &&
    !report.respondedAt &&
    !report.respondedBy &&
    !report.ownerResponseNote &&
    followUpTasks.length === 0;

  return (
    <Screen>
      <TopAppBar title="Detail Laporan" onBack={() => router.back()} />
      <ErrorBanner message={error} />

      <ReportDetailSummaryCard report={report} />

      {canEditReport ? (
        <Card>
          <SectionHeader title="Edit laporan" />
          <Text selectable style={{ color: colors.textMuted, lineHeight: 21 }}>
            Laporan masih menunggu respons owner dan dapat diperbarui.
          </Text>
          <Button title="Edit laporan" onPress={() => router.push(`/worker/reports/${report.id}/edit`)} />
        </Card>
      ) : null}

      <Card>
        <SectionHeader title="Catatan" />
        <Text selectable style={{ color: colors.textMuted, lineHeight: 21 }}>
          {report.description || 'Tidak ada catatan tambahan.'}
        </Text>
      </Card>

      <ReportFollowUpSection
        mode="worker"
        reportStatus={report.status}
        tasks={followUpTasks}
        workerNames={workerNames}
      />

      <Card>
        <SectionHeader title="Status Owner" />
        <Text selectable style={{ color: colors.textMuted, lineHeight: 21 }}>
          {getWorkerOwnerStatusMessage(report.status, followUpTasks.length > 0)}
        </Text>
      </Card>
    </Screen>
  );
}

export function WorkerEditOperationalReportScreen({ reportId }: { reportId?: string }) {
  const { currentFarm } = useAuth();
  const [blockedReason, setBlockedReason] = React.useState<string | null>(null);
  const [category, setCategory] = React.useState<OperationalReportCategory | null>(null);
  const [description, setDescription] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [locationNote, setLocationNote] = React.useState('');
  const [report, setReport] = React.useState<OperationalReport | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const farmId = currentFarm?.farmId;

  React.useEffect(() => {
    let isMounted = true;

    async function loadReport() {
      const normalizedReportId = reportId?.trim();

      if (!normalizedReportId) {
        setError('Data laporan tidak ditemukan.');
        setLoading(false);
        return;
      }

      if (!farmId || currentFarm?.role !== 'worker' || currentFarm.status !== 'active') {
        setError('Akses worker tidak aktif.');
        setLoading(false);
        return;
      }

      setError(null);
      setBlockedReason(null);

      const [reportResult, eligibilityResult] = await Promise.all([
        getOperationalReportDetail({ operationalReportId: normalizedReportId }),
        getOperationalReportEditEligibility({ operationalReportId: normalizedReportId }),
      ]);

      if (!isMounted) {
        return;
      }

      if (reportResult.error) {
        setError(reportResult.error.message);
        setLoading(false);
        return;
      }

      if (reportResult.data.reportedBy !== currentFarm.userId) {
        setError('Hanya pembuat laporan yang bisa mengedit laporan ini.');
        setLoading(false);
        return;
      }

      setReport(reportResult.data);
      setCategory(reportResult.data.category);
      setDescription(reportResult.data.description ?? '');
      setLocationNote(reportResult.data.locationNote ?? '');

      if (eligibilityResult.error) {
        setBlockedReason(eligibilityResult.error.message);
      } else if (!eligibilityResult.data.canEdit) {
        setBlockedReason(eligibilityResult.data.reason ?? 'Laporan ini tidak bisa diedit.');
      }

      setLoading(false);
    }

    loadReport();

    return () => {
      isMounted = false;
    };
  }, [currentFarm?.role, currentFarm?.status, currentFarm?.userId, farmId, reportId]);

  async function handleSubmit() {
    if (!report) {
      setError('Data laporan tidak ditemukan.');
      return;
    }

    if (blockedReason) {
      setError(blockedReason);
      return;
    }

    if (!category) {
      setError('Kategori laporan wajib dipilih.');
      return;
    }

    if (!locationNote.trim() && !description.trim()) {
      setError('Isi lokasi atau deskripsi laporan.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const result = await updateOwnOperationalReport({
      category,
      description,
      locationNote,
      operationalReportId: report.id,
    });

    if (result.error) {
      setError(result.error.message);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);

    Alert.alert('Laporan berhasil diperbarui', '', [
      {
        text: 'OK',
        onPress: () => router.replace(`/worker/reports/${report.id}`),
      },
    ]);
  }

  if (loading) {
    return <LoadingState message="Memuat laporan..." />;
  }

  if (!report) {
    return (
      <Screen>
        <TopAppBar title="Edit laporan" onBack={() => router.back()} />
        <ErrorBanner message={error} />
        <EmptyState title="Laporan tidak ditemukan" subtitle="Laporan mungkin tidak tersedia atau akses ditolak." />
      </Screen>
    );
  }

  if (blockedReason) {
    return (
      <Screen>
        <TopAppBar title="Edit laporan" onBack={() => router.back()} />
        <ErrorBanner message={error} />
        <Card variant="warning">
          <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: '700' }}>
            Laporan tidak bisa diedit
          </Text>
          <Text selectable style={{ color: colors.textMuted, lineHeight: 21 }}>
            {blockedReason}
          </Text>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <>
          <Button title="Simpan perubahan" loading={submitting} onPress={handleSubmit} />
          <Button disabled={submitting} title="Batal" variant="secondary" onPress={() => router.back()} />
        </>
      }
    >
      <TopAppBar title="Edit laporan" onBack={() => router.back()} />
      <ErrorBanner message={error} />

      <FormSection
        title="Informasi Laporan"
        description="Pilih kategori, lalu isi lokasi atau catatan minimal salah satu."
      >
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {operationalReportCategoryOptions.map((option) => (
            <ChipButton
              key={option}
              active={category === option}
              label={formatOperationalReportCategory(option)}
              onPress={() => setCategory(option)}
            />
          ))}
        </View>

        <Field
          label="Target/Lokasi"
          onChangeText={setLocationNote}
          placeholder="Contoh: Gudang alat, Baris A, atau area dekat pompa"
          value={locationNote}
        />
      </FormSection>

      <FormSection
        title="Catatan Lapangan"
        description="Jelaskan kondisi lapangan, pekerjaan, atau masalah yang perlu diketahui pemilik."
      >
        <TextArea
          label="Catatan laporan"
          onChangeText={setDescription}
          placeholder="Contoh: Selang penyemprot pecah"
          value={description}
        />
      </FormSection>

    </Screen>
  );
}

export function OwnerOperationalReportDetailScreen({ reportId }: { reportId?: string }) {
  const { currentFarm } = useAuth();
  const [error, setError] = React.useState<string | null>(null);
  const [followUpTasks, setFollowUpTasks] = React.useState<CareTaskDetail[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [proofPhotoMap, setProofPhotoMap] = React.useState<TaskProofPhotoMap>({});
  const [report, setReport] = React.useState<OperationalReport | null>(null);
  const [ownerResponseNote, setOwnerResponseNote] = React.useState('');
  const [updatingStatus, setUpdatingStatus] = React.useState<OperationalReportStatus | null>(null);
  const [workerNames, setWorkerNames] = React.useState<Record<string, string>>({});

  const farmId = currentFarm?.farmId;

  const loadDetail = React.useCallback(async () => {
    const normalizedReportId = reportId?.trim();

    if (!normalizedReportId) {
      setError('Data laporan tidak ditemukan.');
      setFollowUpTasks([]);
      setProofPhotoMap({});
      setReport(null);
      setOwnerResponseNote('');
      setWorkerNames({});
      return;
    }

    if (!farmId || currentFarm?.role !== 'owner' || currentFarm.status !== 'active') {
      setError('Hanya pemilik aktif yang dapat melihat detail laporan operasional.');
      setFollowUpTasks([]);
      setProofPhotoMap({});
      setReport(null);
      setOwnerResponseNote('');
      setWorkerNames({});
      return;
    }

    setError(null);

    const [reportResult, workersResult, tasksResult] = await Promise.all([
      getOperationalReportDetail({ operationalReportId: normalizedReportId }),
      getFarmMemberBasicProfiles(farmId),
      getOperationalReportFollowUpTasks({ operationalReportId: normalizedReportId }),
    ]);

    if (reportResult.error) {
      setError(reportResult.error.message);
      setFollowUpTasks([]);
      setProofPhotoMap({});
      setReport(null);
      setOwnerResponseNote('');
    } else {
      setReport(reportResult.data);
      setOwnerResponseNote(reportResult.data.ownerResponseNote ?? '');
    }

    if (tasksResult.error) {
      setError(tasksResult.error.message);
      setFollowUpTasks([]);
      setProofPhotoMap({});
    } else {
      setFollowUpTasks(tasksResult.data);

      const proofResult = await listTaskProofPhotosForActivities({
        activityIds: tasksResult.data.flatMap((task) => task.activities.map((activity) => activity.id)),
        farmId,
      });

      if (proofResult.error) {
        setProofPhotoMap({});
      } else {
        setProofPhotoMap(proofResult.data);
      }
    }

    if (workersResult.error) {
      setWorkerNames({});
    } else {
      setWorkerNames(
        Object.fromEntries(
          workersResult.data.map((worker: FarmMemberBasicProfile) => [worker.userId, worker.fullName])
        )
      );
    }
  }, [currentFarm?.role, currentFarm?.status, farmId, reportId]);

  useFocusEffect(
    React.useCallback(() => {
      setLoading(true);
      loadDetail().finally(() => setLoading(false));
    }, [loadDetail])
  );

  async function handleStatusUpdate(status: OperationalReportStatus) {
    if (!report || status === report.status || updatingStatus) {
      return;
    }

    setUpdatingStatus(status);
    setError(null);

    const result = await updateOperationalReportStatus({
      operationalReportId: report.id,
      ownerResponseNote,
      status,
    });

    if (result.error) {
      setError(result.error.message);
      setUpdatingStatus(null);
      return;
    }

    await loadDetail();
    setUpdatingStatus(null);
  }

  if (loading) {
    return <LoadingState message="Memuat detail laporan..." />;
  }

  if (!report) {
    return (
      <Screen>
        <TopAppBar title="Detail Laporan" onBack={() => router.back()} />
        <ErrorBanner message={error} />
        <EmptyState title="Laporan tidak ditemukan" subtitle="Laporan mungkin tidak tersedia atau akses ditolak." />
      </Screen>
    );
  }

  const hasFollowUpTasks = followUpTasks.length > 0;
  const hasActiveFollowUpTask = followUpTasks.some((task) => task.status === 'pending' || task.status === 'postponed');
  const allFollowUpTasksCompleted = hasFollowUpTasks && followUpTasks.every((task) => task.status === 'completed');

  return (
    <Screen>
      <TopAppBar title="Detail Laporan" onBack={() => router.back()} />
      <ErrorBanner message={error} />

      <ReportDetailSummaryCard report={report} reporterName={workerNames[report.reportedBy]} />

      <Card>
        <SectionHeader title="Catatan Laporan" />
        <Text selectable style={{ color: colors.textMuted, lineHeight: 21 }}>
          {report.description || 'Tidak ada catatan tambahan.'}
        </Text>
      </Card>

      <ReportFollowUpSection
        mode="owner"
        proofPhotoMap={proofPhotoMap}
        reportStatus={report.status}
        tasks={followUpTasks}
        workerNames={workerNames}
      />

      <OwnerReportDecisionSection
        allFollowUpTasksCompleted={allFollowUpTasksCompleted}
        hasActiveFollowUpTask={hasActiveFollowUpTask}
        hasFollowUpTasks={hasFollowUpTasks}
        ownerResponseNote={ownerResponseNote}
        onCreateTask={() => router.push(`/owner/reports/${report.id}/task`)}
        onChangeOwnerResponseNote={setOwnerResponseNote}
        onUpdateStatus={handleStatusUpdate}
        reportStatus={report.status}
        updatingStatus={updatingStatus}
      />
    </Screen>
  );
}

export function OwnerCreateTaskFromOperationalReportScreen({ reportId }: { reportId?: string }) {
  const { currentFarm } = useAuth();
  const [assignedWorkerId, setAssignedWorkerId] = React.useState('');
  const [customTargetNote, setCustomTargetNote] = React.useState('');
  const [dueDate, setDueDate] = React.useState(getTodayIsoDate());
  const [error, setError] = React.useState<string | null>(null);
  const [instruction, setInstruction] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [report, setReport] = React.useState<OperationalReport | null>(null);
  const [requiresPhoto, setRequiresPhoto] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [targetColumn, setTargetColumn] = React.useState('');
  const [targetRow, setTargetRow] = React.useState('');
  const [targetTreeId, setTargetTreeId] = React.useState('');
  const [targetType, setTargetType] = React.useState<TargetType>('farm');
  const [title, setTitle] = React.useState('');
  const [trees, setTrees] = React.useState<Tree[]>([]);
  const [workers, setWorkers] = React.useState<WorkerMembership[]>([]);

  const farmId = currentFarm?.farmId;

  React.useEffect(() => {
    let isMounted = true;

    async function loadFormData() {
      const normalizedReportId = reportId?.trim();

      if (!normalizedReportId) {
        setError('Data laporan tidak ditemukan.');
        setLoading(false);
        return;
      }

      if (!farmId || currentFarm?.role !== 'owner' || currentFarm.status !== 'active') {
        setError('Hanya pemilik aktif yang dapat membuat tindak lanjut laporan.');
        setLoading(false);
        return;
      }

      setError(null);

      const [reportResult, workersResult, treesResult] = await Promise.all([
        getOperationalReportDetail({ operationalReportId: normalizedReportId }),
        getActiveWorkers(farmId),
        getTrees({ archived: false, farmId }),
      ]);

      if (!isMounted) {
        return;
      }

      if (reportResult.error) {
        setError(reportResult.error.message);
      } else {
        setReport(reportResult.data);
        setTitle(`Tindak lanjut ${formatOperationalReportCategory(reportResult.data.category)}`);
        setInstruction(reportResult.data.description ?? reportResult.data.locationNote ?? '');

        if (!canCreateTaskFromReportStatus(reportResult.data.status)) {
          setError(getClosedReportTaskMessage(reportResult.data.status));
        }
      }

      if (workersResult.error) {
        setError(workersResult.error.message);
        setWorkers([]);
      } else {
        setWorkers(workersResult.data);
      }

      if (treesResult.error) {
        setTrees([]);
      } else {
        setTrees(treesResult.data);
      }

      setLoading(false);
    }

    loadFormData();

    return () => {
      isMounted = false;
    };
  }, [currentFarm?.role, currentFarm?.status, farmId, reportId]);

  function updateTargetType(nextTargetType: TargetType) {
    setTargetType(nextTargetType);
    setTargetRow('');
    setTargetColumn('');
    setTargetTreeId('');
    setCustomTargetNote('');
  }

  async function handleSubmit() {
    if (!report) {
      setError('Data laporan tidak ditemukan.');
      return;
    }

    if (!canCreateTaskFromReportStatus(report.status)) {
      setError(getClosedReportTaskMessage(report.status));
      return;
    }

    if (!assignedWorkerId) {
      setError('Pilih pekerja aktif.');
      return;
    }

    if (!title.trim()) {
      setError('Judul tugas wajib diisi.');
      return;
    }

    if (targetType === 'custom' && !customTargetNote.trim()) {
      setError('Catatan target khusus wajib diisi.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const payload: CreateTaskFromOperationalReportInput = {
      assignedWorkerId,
      customTargetNote: targetType === 'custom' ? customTargetNote : null,
      dueDate,
      instruction,
      operationalReportId: report.id,
      requiresPhoto,
      targetColumn: targetType === 'column' ? targetColumn : null,
      targetRow: targetType === 'row' ? targetRow : null,
      targetTreeId: targetType === 'tree' ? targetTreeId : null,
      targetType,
      title,
    };

    const result = await createTaskFromOperationalReport(payload);

    if (result.error) {
      setError(result.error.message);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    router.replace(`/owner/tasks/${result.data.taskId}`);
  }

  if (loading) {
    return <LoadingState message="Memuat form tindak lanjut..." />;
  }

  const canSubmitFollowUpTask = report ? canCreateTaskFromReportStatus(report.status) : false;

  return (
    <Screen
      footer={
        <>
          <Button
            title="Simpan Tugas"
            disabled={!canSubmitFollowUpTask}
            loading={submitting}
            onPress={handleSubmit}
          />
          <Button disabled={submitting} title="Batal" variant="secondary" onPress={() => router.back()} />
        </>
      }
    >
      <TopAppBar title="Tugas Tindak Lanjut" onBack={() => router.back()} />
      <ErrorBanner message={error} />

      {report ? (
        <Card variant="softGreen">
          <SectionHeader
            title={`Laporan ${formatOperationalReportCategory(report.category)}`}
            description="Gunakan konteks laporan ini untuk membuat tugas tindak lanjut."
          />
          <MetaRow label="Kategori laporan" value={formatOperationalReportCategory(report.category)} />
          <MetaRow label="Status laporan" value={formatOperationalReportStatus(report.status)} />
          <MetaRow label="Tanggal laporan" value={formatDateTime(report.createdAt)} />
          <MetaRow label="Target/Lokasi" value={report.locationNote} />
          <MetaRow label="Deskripsi" value={report.description || 'Deskripsi belum diisi'} />
        </Card>
      ) : null}

      <FormSection
        title="Rencana Tugas"
        description="Tentukan pekerjaan dan pekerja yang akan menindaklanjuti laporan."
      >
        <Field
          label="Judul tugas *"
          onChangeText={setTitle}
          placeholder="Contoh: Perbaiki alat semprot"
          value={title}
        />

        <DateField label="Tanggal *" onChangeDate={setDueDate} value={dueDate} />

        <WorkerPicker assignedWorkerId={assignedWorkerId} onSelect={setAssignedWorkerId} workers={workers} />
      </FormSection>

      <FormSection
        title="Target Tugas"
        description="Pilih area atau pohon yang perlu dikerjakan."
      >
        <TaskTargetPicker
          customTargetNote={customTargetNote}
          onCustomTargetNoteChange={setCustomTargetNote}
          onTargetColumnChange={setTargetColumn}
          onTargetRowChange={setTargetRow}
          onTargetTreeIdChange={setTargetTreeId}
          onTargetTypeChange={updateTargetType}
          targetColumn={targetColumn}
          targetRow={targetRow}
          targetTreeId={targetTreeId}
          targetType={targetType}
          trees={trees}
        />
      </FormSection>

      <FormSection
        title="Instruksi dan Bukti"
        description="Instruksi ini akan muncul di detail tugas pekerja."
      >
        <TextArea
          label="Instruksi"
          onChangeText={setInstruction}
          placeholder="Instruksi tindak lanjut untuk pekerja"
          value={instruction}
        />

        <ProofRequirementToggle
          enabled={requiresPhoto}
          onToggle={() => setRequiresPhoto((current) => !current)}
        />
      </FormSection>
    </Screen>
  );
}

function ReportDetailSummaryCard({
  report,
  reporterName,
}: {
  report: OperationalReport;
  reporterName?: string;
}) {
  return (
    <Card variant="softGreen">
      <View style={{ gap: spacing.md }}>
        <View style={{ alignItems: 'flex-start', flexDirection: 'row', gap: spacing.md, justifyContent: 'space-between' }}>
          <View style={{ flex: 1, gap: spacing.sm }}>
            <Text selectable style={{ color: colors.text, fontSize: 22, fontWeight: '700', lineHeight: 28 }}>
              {`Laporan ${formatOperationalReportCategory(report.category)}`}
            </Text>
            <Text selectable style={{ color: colors.textMuted, fontSize: 14, lineHeight: 20 }}>
              {report.locationNote || 'Target belum diisi'}
            </Text>
          </View>
          <Badge label={formatOperationalReportStatus(report.status)} tone={getReportStatusTone(report.status)} />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          <Badge label={formatOperationalReportCategory(report.category)} tone="info" />
        </View>
      </View>
      <View style={{ gap: spacing.sm }}>
        {reporterName ? <MetaRow label="Pelapor" value={reporterName} /> : null}
        <MetaRow label="Tanggal laporan" value={formatDateTime(report.createdAt)} />
        {report.ownerResponseNote ? <MetaRow label="Catatan owner" value={report.ownerResponseNote} /> : null}
      </View>
    </Card>
  );
}

function OwnerReportDecisionSection({
  allFollowUpTasksCompleted,
  hasActiveFollowUpTask,
  hasFollowUpTasks,
  ownerResponseNote,
  onCreateTask,
  onChangeOwnerResponseNote,
  onUpdateStatus,
  reportStatus,
  updatingStatus,
}: {
  allFollowUpTasksCompleted: boolean;
  hasActiveFollowUpTask: boolean;
  hasFollowUpTasks: boolean;
  ownerResponseNote: string;
  onCreateTask: () => void;
  onChangeOwnerResponseNote: (value: string) => void;
  onUpdateStatus: (status: OperationalReportStatus) => void;
  reportStatus: OperationalReportStatus;
  updatingStatus: OperationalReportStatus | null;
}) {
  const followUpWarning = hasFollowUpTasks
    ? '\n\nLaporan ini sudah memiliki tugas tindak lanjut. Tugas yang sudah dibuat tidak akan dihapus.'
    : '';

  function confirmStatusUpdate(
    status: OperationalReportStatus,
    title: string,
    message: string,
    confirmTitle: string
  ) {
    Alert.alert(title, `${message}${followUpWarning}`, [
      { style: 'cancel', text: 'Kembali' },
      {
        onPress: () => onUpdateStatus(status),
        style: status === 'rejected' ? 'destructive' : 'default',
        text: confirmTitle,
      },
    ]);
  }

  const noteField = (
    <TextArea
      label="Catatan owner"
      placeholder="Opsional, tulis catatan keputusan untuk laporan ini."
      value={ownerResponseNote}
      onChangeText={onChangeOwnerResponseNote}
    />
  );

  if (reportStatus === 'new') {
    return (
      <Card>
        <SectionHeader
          title="Tindak Lanjut"
          description="Pilih respons untuk laporan yang belum ditangani."
        />
        <Text selectable style={{ color: colors.textMuted, lineHeight: 21 }}>
          Laporan belum direspons. Pilih tindak lanjut yang paling sesuai dengan kondisi lapangan.
        </Text>
        {noteField}
        <View style={{ gap: 10 }}>
          {!hasFollowUpTasks ? (
            <Button title="Buat Tugas Tindak Lanjut" onPress={onCreateTask} />
          ) : (
            <Text selectable style={{ color: colors.textMuted, lineHeight: 21 }}>
              Tugas tindak lanjut sudah tersedia untuk laporan ini.
            </Text>
          )}
          <Button
            title="Tandai Diproses"
            loading={updatingStatus === 'in_progress'}
            variant="secondary"
            onPress={() => onUpdateStatus('in_progress')}
          />
          <Button
            title="Tandai Selesai"
            loading={updatingStatus === 'resolved'}
            variant="secondary"
            onPress={() =>
              confirmStatusUpdate(
                'resolved',
                'Tandai selesai?',
                'Laporan akan ditandai selesai sebagai keputusan owner.',
                'Tandai selesai'
              )
            }
          />
          <Button
            title="Tolak Laporan"
            loading={updatingStatus === 'rejected'}
            variant="danger"
            onPress={() =>
              confirmStatusUpdate(
                'rejected',
                'Tolak laporan?',
                'Laporan akan ditandai ditolak. Worker tidak bisa mengedit laporan ini setelah owner merespons.',
                'Tolak laporan'
              )
            }
          />
        </View>
      </Card>
    );
  }

  if (reportStatus === 'in_progress') {
    return (
      <Card>
        <SectionHeader
          title="Tindak Lanjut"
          description="Pantau penyelesaian tugas yang dibuat dari laporan ini."
        />
        {allFollowUpTasksCompleted ? (
          <>
            <Text selectable style={{ color: appTheme.primary, fontWeight: '700', lineHeight: 21 }}>
              Tugas tindak lanjut sudah selesai. Tinjau hasilnya lalu tandai laporan selesai.
            </Text>
            {noteField}
            <Button
              title="Tandai Laporan Selesai"
              loading={updatingStatus === 'resolved'}
              onPress={() =>
                confirmStatusUpdate(
                  'resolved',
                  'Tandai selesai?',
                  'Laporan akan ditandai selesai sebagai keputusan owner.',
                  'Tandai selesai'
                )
              }
            />
            <Button
              title="Tolak Laporan"
              loading={updatingStatus === 'rejected'}
              variant="danger"
              onPress={() =>
                confirmStatusUpdate(
                  'rejected',
                  'Tolak laporan?',
                  'Laporan akan ditandai ditolak. Worker tidak bisa mengedit laporan ini setelah owner merespons.',
                  'Tolak laporan'
                )
              }
            />
          </>
        ) : hasActiveFollowUpTask ? (
          <>
            <Text selectable style={{ color: colors.textMuted, lineHeight: 21 }}>
              Menunggu pekerja menyelesaikan tugas tindak lanjut.
            </Text>
            {noteField}
            <Button
              title="Tandai Laporan Selesai"
              loading={updatingStatus === 'resolved'}
              variant="secondary"
              onPress={() =>
                confirmStatusUpdate(
                  'resolved',
                  'Tandai selesai?',
                  'Laporan akan ditandai selesai sebagai keputusan owner.',
                  'Tandai selesai'
                )
              }
            />
            <Button
              title="Tolak Laporan"
              loading={updatingStatus === 'rejected'}
              variant="danger"
              onPress={() =>
                confirmStatusUpdate(
                  'rejected',
                  'Tolak laporan?',
                  'Laporan akan ditandai ditolak. Worker tidak bisa mengedit laporan ini setelah owner merespons.',
                  'Tolak laporan'
                )
              }
            />
          </>
        ) : (
          <>
            <Text selectable style={{ color: colors.textMuted, lineHeight: 21 }}>
              Laporan sedang dalam tindak lanjut. Status final tetap diputuskan oleh pemilik.
            </Text>
            {noteField}
            <Button
              title="Tandai Laporan Selesai"
              loading={updatingStatus === 'resolved'}
              variant="secondary"
              onPress={() =>
                confirmStatusUpdate(
                  'resolved',
                  'Tandai selesai?',
                  'Laporan akan ditandai selesai sebagai keputusan owner.',
                  'Tandai selesai'
                )
              }
            />
            <Button
              title="Tolak Laporan"
              loading={updatingStatus === 'rejected'}
              variant="danger"
              onPress={() =>
                confirmStatusUpdate(
                  'rejected',
                  'Tolak laporan?',
                  'Laporan akan ditandai ditolak. Worker tidak bisa mengedit laporan ini setelah owner merespons.',
                  'Tolak laporan'
                )
              }
            />
          </>
        )}
      </Card>
    );
  }

  return (
    <Card>
      <SectionHeader title="Tindak Lanjut" />
      <Badge
        label={formatOperationalReportStatus(reportStatus)}
        tone={getReportStatusTone(reportStatus)}
      />
      <Text selectable style={{ color: colors.textMuted, lineHeight: 21 }}>
        {reportStatus === 'resolved' ? 'Laporan selesai.' : 'Laporan ditolak.'}
      </Text>
    </Card>
  );
}

function OperationalReportCard({
  onPress,
  report,
  reporterName,
  showReporter,
}: {
  onPress?: () => void;
  report: OperationalReport;
  reporterName?: string;
  showReporter: boolean;
}) {
  const description = report.description?.trim();
  const hasDescription = Boolean(description);
  // Deskripsi jadi judul; kalau kosong, label kategori naik jadi judul dan baris
  // kategori di bawahnya disembunyikan supaya tidak dobel.
  const title = hasDescription ? description : formatOperationalReportCategory(report.category);

  const content = (
    <Card padding={spacing.md}>
      <View style={{ gap: spacing.sm }}>
        <View style={{ alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' }}>
          <Text
            selectable
            ellipsizeMode="tail"
            numberOfLines={2}
            style={{ color: colors.text, flex: 1, fontSize: 15, fontWeight: '500', lineHeight: 21 }}
          >
            {title}
          </Text>
          <Badge label={formatOperationalReportStatus(report.status)} tone={getReportStatusTone(report.status)} />
        </View>

        {hasDescription ? (
          <Text selectable style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 18 }}>
            {formatOperationalReportCategory(report.category)}
          </Text>
        ) : null}

        <View style={{ alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
          <CompactMetaItem icon="calendar" label={formatDateOnly(report.createdAt)} />
          {report.locationNote ? <CompactMetaItem icon="target" label={report.locationNote} /> : null}
        </View>

        {showReporter ? (
          <CompactMetaItem icon="user" label={reporterName ?? 'Pelapor tidak tersedia'} />
        ) : null}
      </View>
    </Card>
  );

  if (!onPress) {
    return content;
  }

  return <Pressable onPress={onPress}>{content}</Pressable>;
}

function PhotoIndicator() {
  return (
    <View
      style={{
        alignItems: 'center',
        backgroundColor: colors.successBg,
        borderColor: colors.successBorder,
        borderRadius: radius.round,
        borderWidth: 1,
        height: 28,
        justifyContent: 'center',
        width: 28,
      }}
    >
      <CameraGlyph color={colors.success} />
    </View>
  );
}

function ReportFollowUpSection({
  mode,
  proofPhotoMap = {},
  tasks,
  workerNames,
}: {
  mode: 'owner' | 'worker';
  proofPhotoMap?: TaskProofPhotoMap;
  reportStatus: OperationalReportStatus;
  tasks: CareTaskDetail[];
  workerNames: Record<string, string>;
}) {
  return (
    <View style={{ gap: 12 }}>
      <Text selectable style={{ color: '#1E2A24', fontSize: 20, fontWeight: '700', paddingTop: 4 }}>
        Tindak Lanjut
      </Text>

      {tasks.length === 0 ? (
        <Card>
          <Text selectable style={{ color: '#68746D', lineHeight: 21 }}>
            Belum ada tugas tindak lanjut.
          </Text>
        </Card>
      ) : (
        <View style={{ gap: 12 }}>
          {tasks.map((task) => (
            <ReportFollowUpTaskCard
              key={task.id}
              mode={mode}
              proofPhotoMap={proofPhotoMap}
              task={task}
              workerNames={workerNames}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function ReportFollowUpTaskCard({
  mode,
  proofPhotoMap,
  task,
  workerNames,
}: {
  mode: 'owner' | 'worker';
  proofPhotoMap: TaskProofPhotoMap;
  task: CareTaskDetail;
  workerNames: Record<string, string>;
}) {
  const taskRoute = mode === 'owner'
    ? `/owner/tasks/${task.id}`
    : `/worker/tasks/${task.id}`;

  return (
    <Card padding={spacing.md}>
      <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'space-between' }}>
        <Text
          selectable
          numberOfLines={2}
          style={{ color: '#1E2A24', flex: 1, fontSize: 16, fontWeight: '700', lineHeight: 22 }}
        >
          {task.title}
        </Text>
        <Badge label={formatTaskStatus(task.status)} maxWidth={110} tone={getTaskTone(task.status)} />
      </View>
      <View style={{ alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
        {task.category ? <Badge label={formatCareCategory(task.category)} tone="success" /> : null}
        {task.requiresPhoto ? <PhotoIndicator /> : null}
      </View>
      <View style={{ gap: 9 }}>
        <MetaRow label="Pekerja" value={workerNames[task.assignedTo] ?? 'Pekerja tidak tersedia'} />
        <MetaRow label="Tanggal tugas" value={formatDate(task.dueDate)} />
        <MetaRow label="Target" value={formatCareTarget(task)} />
        {task.instruction ? <MetaRow label="Instruksi" value={task.instruction} /> : null}
      </View>

      {task.activities.length > 0 ? (
        <View style={{ gap: 10 }}>
          <Text selectable style={{ color: '#1E2A24', fontSize: 15, fontWeight: '700' }}>
            Realisasi
          </Text>
          {task.activities.map((activity) => (
            <View
              key={activity.id}
              style={{
                backgroundColor: appTheme.primarySoft,
                borderColor: '#B8D8BF',
                borderRadius: 10,
                borderWidth: 1,
                gap: 8,
                padding: 11,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                <Text selectable style={{ color: '#1E2A24', flex: 1, fontWeight: '700' }}>
                  {formatActivityStatus(activity.status)}
                </Text>
                <Badge label={formatActivityStatus(activity.status)} maxWidth={110} tone={getActivityTone(activity.status)} />
              </View>
              <MetaRow label="Waktu" value={formatDateTime(activity.performedAt)} />
              <MetaRow label="Pelaksana" value={workerNames[activity.performedBy] ?? 'Pekerja tidak tersedia'} />
              <MetaRow label="Catatan" value={activity.note || '-'} />
              {mode === 'owner' && activity.status === 'completed' ? (
                <TaskProofPhotoPreview
                  emptyText={task.requiresPhoto ? 'Menunggu bukti foto dari pekerja.' : undefined}
                  photo={proofPhotoMap[activity.id]}
                />
              ) : null}
            </View>
          ))}
        </View>
      ) : (
        <Text selectable style={{ color: '#68746D', lineHeight: 21 }}>
          Belum ada realisasi.
        </Text>
      )}

      <Button
        title="Buka Tugas"
        variant="secondary"
        onPress={() => router.push(taskRoute)}
      />
    </Card>
  );
}

function WorkerPicker({
  assignedWorkerId,
  onSelect,
  workers,
}: {
  assignedWorkerId: string;
  onSelect: (workerId: string) => void;
  workers: WorkerMembership[];
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text selectable style={{ color: '#1E2A24', fontSize: 14, fontWeight: '600' }}>
        Pekerja aktif *
      </Text>
      {workers.length === 0 ? (
        <EmptyState title="Belum ada pekerja aktif" subtitle="Setujui pekerja terlebih dahulu sebelum membuat tugas." />
      ) : (
        <View style={{ gap: 8 }}>
          {workers.map((worker) => (
            <Button
              key={worker.userId}
              title={worker.fullName}
              variant={assignedWorkerId === worker.userId ? 'primary' : 'secondary'}
              onPress={() => onSelect(worker.userId)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function TaskTargetPicker({
  customTargetNote,
  onCustomTargetNoteChange,
  onTargetColumnChange,
  onTargetRowChange,
  onTargetTreeIdChange,
  onTargetTypeChange,
  targetColumn,
  targetRow,
  targetTreeId,
  targetType,
  trees,
}: {
  customTargetNote: string;
  onCustomTargetNoteChange: (value: string) => void;
  onTargetColumnChange: (value: string) => void;
  onTargetRowChange: (value: string) => void;
  onTargetTreeIdChange: (value: string) => void;
  onTargetTypeChange: (targetType: TargetType) => void;
  targetColumn: string;
  targetRow: string;
  targetTreeId: string;
  targetType: TargetType;
  trees: Tree[];
}) {
  const targetOptions: TargetType[] = ['farm', 'row', 'column', 'tree', 'custom'];

  return (
    <View style={{ gap: 12 }}>
      <View style={{ gap: 8 }}>
        <Text selectable style={{ color: '#1E2A24', fontSize: 14, fontWeight: '600' }}>
          Target tugas *
        </Text>
        <View style={{ gap: 8 }}>
          {targetOptions.map((option) => (
            <Button
              key={option}
              title={formatTargetType(option)}
              variant={targetType === option ? 'primary' : 'secondary'}
              onPress={() => onTargetTypeChange(option)}
            />
          ))}
        </View>
      </View>

      {targetType === 'row' ? (
        <Field label="Baris target *" onChangeText={onTargetRowChange} placeholder="Contoh: A" value={targetRow} />
      ) : null}

      {targetType === 'column' ? (
        <Field label="Kolom target *" onChangeText={onTargetColumnChange} placeholder="Contoh: 1" value={targetColumn} />
      ) : null}

      {targetType === 'tree' ? (
        <View style={{ gap: 8 }}>
          <Text selectable style={{ color: '#1E2A24', fontSize: 14, fontWeight: '600' }}>
            Pohon target *
          </Text>
          {trees.length === 0 ? (
            <EmptyState title="Belum ada pohon aktif" subtitle="Tambahkan pohon sebelum membuat tugas per pohon." />
          ) : (
            <View style={{ gap: 8 }}>
              {trees.map((tree) => (
                <Button
                  key={tree.id}
                  title={formatTreeLocation(tree)}
                  variant={targetTreeId === tree.id ? 'primary' : 'secondary'}
                  onPress={() => onTargetTreeIdChange(tree.id)}
                />
              ))}
            </View>
          )}
        </View>
      ) : null}

      {targetType === 'custom' ? (
        <TextArea
          label="Catatan target khusus *"
          onChangeText={onCustomTargetNoteChange}
          placeholder="Contoh: Area dekat gudang pupuk"
          value={customTargetNote}
        />
      ) : null}
    </View>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('id-ID', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function getTodayIsoDate(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getWorkerOwnerStatusMessage(
  status: OperationalReportStatus,
  hasFollowUpTasks: boolean
): string {
  if (status === 'new') {
    return 'Menunggu respons pemilik.';
  }

  if (status === 'in_progress') {
    return hasFollowUpTasks
      ? 'Pemilik membuat tindak lanjut untuk laporan ini.'
      : 'Laporan sedang dalam tindak lanjut oleh pemilik.';
  }

  if (status === 'resolved') {
    return 'Laporan sudah ditandai selesai.';
  }

  return 'Laporan ditolak oleh pemilik.';
}

function getReportStatusTone(status: OperationalReportStatus): 'danger' | 'info' | 'success' | 'warning' {
  if (status === 'resolved') {
    return 'success';
  }

  if (status === 'rejected') {
    return 'danger';
  }

  if (status === 'new') {
    return 'warning';
  }

  return 'info';
}

function getTaskTone(status: TaskStatus): 'danger' | 'muted' | 'success' | 'warning' {
  if (status === 'completed') {
    return 'success';
  }

  if (status === 'postponed') {
    return 'warning';
  }

  return 'muted';
}

function getActivityTone(status: ActivityStatus): 'danger' | 'muted' | 'success' | 'warning' {
  if (status === 'completed') {
    return 'success';
  }

  return 'warning';
}

function formatActivityStatus(status: ActivityStatus): string {
  const labels: Record<ActivityStatus, string> = {
    completed: 'Selesai',
    postponed: 'Ditunda',
  };

  return labels[status];
}

function TextArea({
  label,
  onChangeText,
  placeholder,
  value,
}: {
  label: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  return (
    <View style={{ gap: 7 }}>
      <Text selectable style={{ color: '#1E2A24', fontSize: 14, fontWeight: '600' }}>
        {label}
      </Text>
      <TextInput
        multiline
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94A098"
        style={{
          backgroundColor: '#FFFFFF',
          borderColor: colors.border,
          borderCurve: 'continuous',
          borderRadius: 8,
          borderWidth: 1,
          color: '#1E2A24',
          fontSize: 16,
          minHeight: 104,
          paddingHorizontal: 14,
          paddingTop: 12,
          textAlignVertical: 'top',
        }}
        value={value}
      />
    </View>
  );
}
