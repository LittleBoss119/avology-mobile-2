import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';

import { useAuth } from '../context/auth-context';
import {
  createTaskFromOperationalReport,
  getOperationalReportFollowUpTasks,
} from '../services/careTaskService';
import { getActiveWorkers, getFarmMemberBasicProfiles } from '../services/memberService';
import {
  createOperationalReport,
  getOperationalReportDetail,
  getOperationalReports,
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
import {
  formatCareTarget,
  formatTaskStatus,
} from './care-schedule-components';
import { formatCareCategory } from './care-sop-components';
import {
  formatOperationalReportCategory,
  formatOperationalReportStatus,
  formatOperationalReportStatusShort,
  formatTargetType,
} from '../utils/displayFormat';
import { formatTreeLocation } from '../utils/treeFormat';
import {
  appTheme,
  Badge,
  Button,
  Card,
  ChipButton,
  CompactMetaItem,
  DateField,
  EmptyState,
  ErrorBanner,
  Field,
  LoadingState,
  MetaRow,
  PageIntro,
  Screen,
  SectionTitle,
  SuccessBanner,
  TopAppBar,
} from './ui';

const operationalReportCategoryOptions: OperationalReportCategory[] = [
  'land_damage',
  'broken_tool',
  'out_of_stock',
  'area_pest_disease',
  'disaster_weather',
  'worker_need',
  'other',
];

const operationalReportStatusOptions: OperationalReportStatus[] = [
  'new',
  'in_progress',
  'resolved',
  'rejected',
];

type OperationalReportStatusFilter = 'all' | OperationalReportStatus;
type OperationalReportCategoryFilter = 'all' | OperationalReportCategory;

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

    setSubmitting(false);
    setSuccess('Laporan operasional berhasil dikirim.');
    redirectTimer.current = setTimeout(() => {
      router.replace('/worker/reports');
    }, 900);
  }

  return (
    <Screen
      footer={
        <Button title="Simpan Laporan" loading={submitting} onPress={handleSubmit} />
      }
    >
      <TopAppBar title="Buat Laporan" onBack={() => router.back()} />
      <ErrorBanner message={error} />
      <SuccessBanner message={success} />

      <Card>
        <SectionTitle title="Kategori Laporan" subtitle="Pilih jenis kejadian lapangan yang perlu diketahui pemilik." />
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
      </Card>

      <Card>
        <SectionTitle title="Ringkasan Lapangan" subtitle="Isi singkat saja, yang penting jelas untuk tindak lanjut." />
        <Field
          label="Lokasi"
          onChangeText={setLocationNote}
          placeholder="Contoh: Gudang alat"
          value={locationNote}
        />

        <TextArea
          label="Catatan laporan"
          onChangeText={setDescription}
          placeholder="Contoh: Selang penyemprot pecah"
          value={description}
        />
      </Card>
    </Screen>
  );
}

export function WorkerOperationalReportListScreen() {
  const { currentFarm } = useAuth();
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [reports, setReports] = React.useState<OperationalReport[]>([]);
  const [statusFilter, setStatusFilter] = React.useState<OperationalReportStatusFilter>('all');

  const farmId = currentFarm?.farmId;
  const filteredReports = React.useMemo(() => {
    if (statusFilter === 'all') {
      return reports;
    }

    return reports.filter((report) => report.status === statusFilter);
  }, [reports, statusFilter]);

  const loadReports = React.useCallback(async () => {
    if (!farmId || currentFarm?.role !== 'worker' || currentFarm.status !== 'active') {
      setError('Hanya pekerja aktif yang dapat melihat laporan operasional.');
      setReports([]);
      return;
    }

    setError(null);

    const result = await getOperationalReports({
      farmId,
      reportedBy: currentFarm.userId,
    });

    if (result.error) {
      setError(result.error.message);
      setReports([]);
      return;
    }

    setReports(result.data);
  }, [currentFarm?.role, currentFarm?.status, currentFarm?.userId, farmId]);

  useFocusEffect(
    React.useCallback(() => {
      setLoading(true);
      loadReports().finally(() => setLoading(false));
    }, [loadReports])
  );

  if (loading) {
    return <LoadingState message="Memuat laporan operasional..." />;
  }

  return (
    <Screen
      stickyFooter={
        <Button title="Buat Laporan" onPress={() => router.push('/worker/reports/create')} />
      }
    >
      <PageIntro
        title="Riwayat Laporan"
        subtitle="Lihat laporan kebun yang pernah Anda kirim."
      />
      <ErrorBanner message={error} />

      <ReportSummary reports={reports} compact />

      <ReportStatusFilter selectedStatus={statusFilter} onSelect={setStatusFilter} />

      {filteredReports.length === 0 ? (
        <EmptyState
          title={reports.length === 0 ? 'Belum ada laporan' : 'Tidak ada laporan pada filter ini'}
          subtitle="Laporan operasional yang Anda buat akan muncul di sini."
        />
      ) : (
        <View style={{ gap: 12 }}>
          {filteredReports.map((report) => (
            <OperationalReportCard
              key={report.id}
              compactStatus
              report={report}
              onPress={() => router.push(`/worker/reports/${report.id}`)}
            />
          ))}
        </View>
      )}
    </Screen>
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

  return (
    <Screen>
      <TopAppBar title="Detail Laporan" onBack={() => router.back()} />
      <ErrorBanner message={error} />

      <Card variant="highlight">
        <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'space-between' }}>
          <Text selectable style={{ color: '#1E2A24', flex: 1, fontSize: 22, fontWeight: '900', lineHeight: 28 }}>
            {formatOperationalReportCategory(report.category)}
          </Text>
          <Badge label={formatOperationalReportStatus(report.status)} maxWidth={150} tone={getReportStatusTone(report.status)} />
        </View>
        <View style={{ gap: 10 }}>
          <MetaRow label="Tanggal dibuat" value={formatDateTime(report.createdAt)} />
          <MetaRow label="Lokasi" value={report.locationNote} />
          <MetaRow label="Status" value={formatOperationalReportStatus(report.status)} />
        </View>
      </Card>

      <Card>
        <Text selectable style={{ color: '#1E2A24', fontSize: 17, fontWeight: '700' }}>
          Catatan Laporan
        </Text>
        <Text selectable style={{ color: '#68746D', lineHeight: 21 }}>
          {report.description || '-'}
        </Text>
      </Card>

      <Card>
        <Text selectable style={{ color: '#1E2A24', fontSize: 17, fontWeight: '700' }}>
          Status dari Pemilik
        </Text>
        <Text selectable style={{ color: '#68746D', lineHeight: 21 }}>
          Laporan yang sudah dikirim menunggu keputusan pemilik. Perubahan status hanya dapat dilakukan oleh pemilik kebun.
        </Text>
      </Card>

      <ReportFollowUpSection
        mode="worker"
        reportStatus={report.status}
        tasks={followUpTasks}
        workerNames={workerNames}
      />
    </Screen>
  );
}

export function OwnerOperationalReportListScreen() {
  const { currentFarm } = useAuth();
  const [error, setError] = React.useState<string | null>(null);
  const [filterSheetVisible, setFilterSheetVisible] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [categoryFilter, setCategoryFilter] = React.useState<OperationalReportCategoryFilter>('all');
  const [reports, setReports] = React.useState<OperationalReport[]>([]);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<OperationalReportStatusFilter>('all');
  const [workerNames, setWorkerNames] = React.useState<Record<string, string>>({});

  const farmId = currentFarm?.farmId;
  const filteredReports = React.useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return reports.filter((report) => {
      const reporterName = workerNames[report.reportedBy] ?? '';
      const searchableText = [
        formatOperationalReportCategory(report.category),
        report.description,
        report.locationNote,
        reporterName,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      const matchesSearch = !normalizedQuery || searchableText.includes(normalizedQuery);
      const matchesStatus = statusFilter === 'all' || report.status === statusFilter;
      const matchesCategory = categoryFilter === 'all' || report.category === categoryFilter;

      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [categoryFilter, reports, searchQuery, statusFilter, workerNames]);

  const loadReports = React.useCallback(async () => {
    if (!farmId || currentFarm?.role !== 'owner' || currentFarm.status !== 'active') {
      setError('Hanya pemilik aktif yang dapat melihat laporan operasional.');
      setReports([]);
      setWorkerNames({});
      return;
    }

    setError(null);

    const [reportsResult, workersResult] = await Promise.all([
      getOperationalReports({ farmId }),
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
  }, [currentFarm?.role, currentFarm?.status, farmId]);

  useFocusEffect(
    React.useCallback(() => {
      setLoading(true);
      loadReports().finally(() => setLoading(false));
    }, [loadReports])
  );

  if (loading) {
    return <LoadingState message="Memuat laporan operasional..." />;
  }

  return (
    <Screen>
      <View style={{ gap: 7, paddingTop: 10 }}>
        <Text selectable style={{ color: appTheme.primary, fontSize: 13, fontWeight: '900', letterSpacing: 0.2 }}>
          Laporan Operasional
        </Text>
        <Text selectable style={{ color: '#1E2A24', fontSize: 31, fontWeight: '900', lineHeight: 36 }}>
          Laporan Lapangan
        </Text>
        <Text selectable style={{ color: '#68746D', fontSize: 16, lineHeight: 23 }}>
          Pantau laporan kebun dari pekerja dan tindak lanjuti bila perlu.
        </Text>
      </View>
      <ErrorBanner message={error} />

      <ReportSummary reports={reports} />

      <ReportSearchFilterRow
        categoryFilter={categoryFilter}
        onOpenFilter={() => setFilterSheetVisible(true)}
        onSearchChange={setSearchQuery}
        searchQuery={searchQuery}
        statusFilter={statusFilter}
      />

      <Text selectable style={{ color: '#68746D', fontSize: 13, fontWeight: '700' }}>
        Menampilkan {filteredReports.length} dari {reports.length} laporan
      </Text>

      {filteredReports.length === 0 ? (
        <EmptyState
          title={reports.length === 0 ? 'Belum ada laporan' : 'Tidak ada laporan pada filter ini'}
          subtitle="Laporan operasional pekerja yang sesuai pencarian akan muncul di sini."
        />
      ) : (
        <View style={{ gap: 12 }}>
          {filteredReports.map((report) => (
            <OperationalReportCard
              key={report.id}
              compactStatus
              report={report}
              reporterName={workerNames[report.reportedBy]}
              onPress={() => router.push(`/owner/reports/${report.id}`)}
            />
          ))}
        </View>
      )}
      <ReportFilterSheet
        categoryFilter={categoryFilter}
        onClose={() => setFilterSheetVisible(false)}
        onReset={() => {
          setStatusFilter('all');
          setCategoryFilter('all');
        }}
        onSelectCategory={setCategoryFilter}
        onSelectStatus={setStatusFilter}
        statusFilter={statusFilter}
        visible={filterSheetVisible}
      />
    </Screen>
  );
}

export function OwnerOperationalReportDetailScreen({ reportId }: { reportId?: string }) {
  const { currentFarm } = useAuth();
  const [error, setError] = React.useState<string | null>(null);
  const [followUpTasks, setFollowUpTasks] = React.useState<CareTaskDetail[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [report, setReport] = React.useState<OperationalReport | null>(null);
  const [updatingStatus, setUpdatingStatus] = React.useState<OperationalReportStatus | null>(null);
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

    if (!farmId || currentFarm?.role !== 'owner' || currentFarm.status !== 'active') {
      setError('Hanya pemilik aktif yang dapat melihat detail laporan operasional.');
      setFollowUpTasks([]);
      setReport(null);
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
      setReport(null);
    } else {
      setReport(reportResult.data);
    }

    if (tasksResult.error) {
      setError(tasksResult.error.message);
      setFollowUpTasks([]);
    } else {
      setFollowUpTasks(tasksResult.data);
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

      <Card variant="highlight">
        <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'space-between' }}>
          <View style={{ flex: 1, gap: 5 }}>
            <Text selectable style={{ color: '#1E2A24', fontSize: 22, fontWeight: '900', lineHeight: 28 }}>
              {formatOperationalReportCategory(report.category)}
            </Text>
          </View>
          <Badge label={formatOperationalReportStatus(report.status)} tone={getReportStatusTone(report.status)} />
        </View>
        <View style={{ gap: 10 }}>
          <MetaRow label="Pelapor" value={workerNames[report.reportedBy] ?? 'Pelapor tidak tersedia'} />
          <MetaRow label="Tanggal dibuat" value={formatDateTime(report.createdAt)} />
          <MetaRow label="Lokasi" value={report.locationNote} />
        </View>
      </Card>

      <Card>
        <Text selectable style={{ color: '#1E2A24', fontSize: 17, fontWeight: '700' }}>
          Deskripsi
        </Text>
        <Text selectable style={{ color: '#68746D', lineHeight: 21 }}>
          {report.description || '-'}
        </Text>
      </Card>

      <ReportFollowUpSection
        mode="owner"
        reportStatus={report.status}
        tasks={followUpTasks}
        workerNames={workerNames}
      />

      <OwnerReportDecisionSection
        allFollowUpTasksCompleted={allFollowUpTasksCompleted}
        hasActiveFollowUpTask={hasActiveFollowUpTask}
        hasFollowUpTasks={hasFollowUpTasks}
        onCreateTask={() => router.push(`/owner/reports/${report.id}/task`)}
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
            title="Buat Tugas"
            disabled={!canSubmitFollowUpTask}
            loading={submitting}
            onPress={handleSubmit}
          />
        </>
      }
    >
      <TopAppBar title="Buat Tugas" onBack={() => router.back()} />
      <ErrorBanner message={error} />

      {report ? (
        <Card variant="highlight">
          <MetaRow label="Kategori laporan" value={formatOperationalReportCategory(report.category)} />
          <MetaRow label="Status laporan" value={formatOperationalReportStatus(report.status)} />
          <MetaRow label="Tanggal laporan" value={formatDateTime(report.createdAt)} />
          <MetaRow label="Lokasi" value={report.locationNote} />
          <MetaRow label="Deskripsi" value={report.description || 'Deskripsi belum diisi'} />
        </Card>
      ) : null}

      <Field
        label="Judul tugas *"
        onChangeText={setTitle}
        placeholder="Contoh: Perbaiki alat semprot"
        value={title}
      />

      <DateField label="Tanggal jatuh tempo *" onChangeDate={setDueDate} value={dueDate} />

      <WorkerPicker assignedWorkerId={assignedWorkerId} onSelect={setAssignedWorkerId} workers={workers} />

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

      <TextArea
        label="Instruksi"
        onChangeText={setInstruction}
        placeholder="Instruksi tindak lanjut untuk pekerja"
        value={instruction}
      />
    </Screen>
  );
}

function ReportSearchFilterRow({
  categoryFilter,
  onOpenFilter,
  onSearchChange,
  searchQuery,
  statusFilter,
}: {
  categoryFilter: OperationalReportCategoryFilter;
  onOpenFilter: () => void;
  onSearchChange: (value: string) => void;
  searchQuery: string;
  statusFilter: OperationalReportStatusFilter;
}) {
  const activeFilterCount = Number(statusFilter !== 'all') + Number(categoryFilter !== 'all');

  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={onSearchChange}
        placeholder="Cari laporan, lokasi, atau pelapor"
        placeholderTextColor="#94A098"
        style={{
          backgroundColor: '#FFFFFF',
          borderColor: '#DCE7D5',
          borderRadius: 14,
          borderWidth: 1,
          color: '#1E2A24',
          flex: 1,
          fontSize: 15,
          minHeight: 48,
          paddingHorizontal: 14,
        }}
        value={searchQuery}
      />
      <Pressable
        accessibilityRole="button"
        onPress={onOpenFilter}
        style={{
          alignItems: 'center',
          backgroundColor: activeFilterCount > 0 ? appTheme.primary : '#FFFFFF',
          borderColor: activeFilterCount > 0 ? appTheme.primary : '#DCE7D5',
          borderRadius: 14,
          borderWidth: 1,
          justifyContent: 'center',
          minHeight: 48,
          paddingHorizontal: 15,
        }}
      >
        <Text selectable style={{ color: activeFilterCount > 0 ? '#FFFFFF' : '#1E2A24', fontSize: 14, fontWeight: '900' }}>
          Filter{activeFilterCount > 0 ? ` ${activeFilterCount}` : ''}
        </Text>
      </Pressable>
    </View>
  );
}

function ReportFilterSheet({
  categoryFilter,
  onClose,
  onReset,
  onSelectCategory,
  onSelectStatus,
  statusFilter,
  visible,
}: {
  categoryFilter: OperationalReportCategoryFilter;
  onClose: () => void;
  onReset: () => void;
  onSelectCategory: (category: OperationalReportCategoryFilter) => void;
  onSelectStatus: (status: OperationalReportStatusFilter) => void;
  statusFilter: OperationalReportStatusFilter;
  visible: boolean;
}) {
  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <View style={{ backgroundColor: 'rgba(30, 42, 36, 0.28)', flex: 1, justifyContent: 'flex-end' }}>
        <Pressable accessibilityRole="button" onPress={onClose} style={{ flex: 1 }} />
        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            gap: 18,
            padding: 20,
            paddingBottom: 24,
          }}
        >
          <View style={{ gap: 5 }}>
            <Text selectable style={{ color: '#1E2A24', fontSize: 20, fontWeight: '900' }}>
              Filter Laporan
            </Text>
            <Text selectable style={{ color: '#68746D', lineHeight: 20 }}>
              Pilih status dan kategori laporan yang ingin ditampilkan.
            </Text>
          </View>

          <ReportStatusFilter selectedStatus={statusFilter} onSelect={onSelectStatus} />
          <ReportCategoryFilter selectedCategory={categoryFilter} onSelect={onSelectCategory} />

          <View style={{ gap: 10 }}>
            <Button title="Terapkan Filter" onPress={onClose} />
            <Button
              title="Reset Filter"
              variant="secondary"
              onPress={() => {
                onReset();
                onClose();
              }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function OwnerReportDecisionSection({
  allFollowUpTasksCompleted,
  hasActiveFollowUpTask,
  hasFollowUpTasks,
  onCreateTask,
  onUpdateStatus,
  reportStatus,
  updatingStatus,
}: {
  allFollowUpTasksCompleted: boolean;
  hasActiveFollowUpTask: boolean;
  hasFollowUpTasks: boolean;
  onCreateTask: () => void;
  onUpdateStatus: (status: OperationalReportStatus) => void;
  reportStatus: OperationalReportStatus;
  updatingStatus: OperationalReportStatus | null;
}) {
  if (reportStatus === 'new') {
    return (
      <Card>
        <Text selectable style={{ color: '#1E2A24', fontSize: 17, fontWeight: '800' }}>
          Tindakan Owner
        </Text>
        <Text selectable style={{ color: '#68746D', lineHeight: 21 }}>
          Laporan belum direspons. Pilih tindak lanjut yang paling sesuai dengan kondisi lapangan.
        </Text>
        <View style={{ gap: 10 }}>
          {!hasFollowUpTasks ? (
            <Button title="Buat Tugas Tindak Lanjut" onPress={onCreateTask} />
          ) : (
            <Text selectable style={{ color: '#68746D', lineHeight: 21 }}>
              Tugas tindak lanjut sudah tersedia untuk laporan ini.
            </Text>
          )}
          <Button
            title="Tandai Selesai Tanpa Tugas"
            loading={updatingStatus === 'resolved'}
            variant="secondary"
            onPress={() => onUpdateStatus('resolved')}
          />
          <Button
            title="Tolak Laporan"
            loading={updatingStatus === 'rejected'}
            variant="danger"
            onPress={() => onUpdateStatus('rejected')}
          />
        </View>
      </Card>
    );
  }

  if (reportStatus === 'in_progress') {
    return (
      <Card>
        <Text selectable style={{ color: '#1E2A24', fontSize: 17, fontWeight: '800' }}>
          Tindakan Owner
        </Text>
        {allFollowUpTasksCompleted ? (
          <>
            <Text selectable style={{ color: appTheme.primary, fontWeight: '800', lineHeight: 21 }}>
              Tugas tindak lanjut sudah selesai. Tinjau hasilnya lalu tandai laporan selesai.
            </Text>
            <Button
              title="Tandai Laporan Selesai"
              loading={updatingStatus === 'resolved'}
              onPress={() => onUpdateStatus('resolved')}
            />
          </>
        ) : hasActiveFollowUpTask ? (
          <Text selectable style={{ color: '#68746D', lineHeight: 21 }}>
            Menunggu pekerja menyelesaikan tugas tindak lanjut.
          </Text>
        ) : (
          <Text selectable style={{ color: '#68746D', lineHeight: 21 }}>
            Laporan sedang dalam tindak lanjut. Status final tetap diputuskan oleh pemilik.
          </Text>
        )}
      </Card>
    );
  }

  return (
    <Card>
      <Text selectable style={{ color: '#1E2A24', fontSize: 17, fontWeight: '800' }}>
        Status Final
      </Text>
      <Text selectable style={{ color: '#68746D', lineHeight: 21 }}>
        {reportStatus === 'resolved' ? 'Laporan selesai.' : 'Laporan ditolak.'}
      </Text>
    </Card>
  );
}

function OperationalReportCard({
  compactStatus = false,
  onPress,
  report,
  reporterName,
}: {
  compactStatus?: boolean;
  onPress?: () => void;
  report: OperationalReport;
  reporterName?: string;
}) {
  const content = (
    <Card>
      <View style={{ gap: 8 }}>
        <View style={{ alignItems: 'flex-start', flexDirection: 'row', gap: 8, justifyContent: 'space-between' }}>
          <Text
            selectable
            ellipsizeMode="tail"
            numberOfLines={1}
            style={{ color: appTheme.primary, flex: 1, fontSize: 17, fontWeight: '900', lineHeight: 23 }}
          >
            {formatOperationalReportCategory(report.category)}
          </Text>
          <Badge
            label={compactStatus ? formatOperationalReportStatusShort(report.status) : formatOperationalReportStatus(report.status)}
            maxWidth={compactStatus ? 118 : 150}
            tone={getReportStatusTone(report.status)}
          />
        </View>
        <Text selectable ellipsizeMode="tail" numberOfLines={2} style={{ color: '#68746D', fontSize: 13, lineHeight: 18 }}>
          {formatReportSummary(report)}
        </Text>
        <View style={{ gap: 4 }}>
          <View style={{ alignItems: 'center', flexDirection: 'row', gap: 10 }}>
            <CompactMetaItem icon="calendar" label={formatDate(report.createdAt)} />
            {report.locationNote ? <CompactMetaItem icon="target" label={report.locationNote} /> : null}
          </View>
          {reporterName ? <CompactMetaItem icon="user" label={reporterName} /> : null}
        </View>
      </View>
    </Card>
  );

  if (!onPress) {
    return content;
  }

  return <Pressable onPress={onPress}>{content}</Pressable>;
}

function ReportStatusFilter({
  onSelect,
  selectedStatus,
}: {
  onSelect: (status: OperationalReportStatusFilter) => void;
  selectedStatus: OperationalReportStatusFilter;
}) {
  const filters: OperationalReportStatusFilter[] = ['all', ...operationalReportStatusOptions];

  return (
    <View style={{ gap: 8 }}>
      <Text selectable style={{ color: '#1E2A24', fontSize: 14, fontWeight: '600' }}>
        Status
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {filters.map((status) => (
          <ChipButton
            key={status}
            active={selectedStatus === status}
            label={status === 'all' ? 'Semua' : formatOperationalReportStatus(status)}
            onPress={() => onSelect(status)}
          />
        ))}
      </View>
    </View>
  );
}

function ReportCategoryFilter({
  onSelect,
  selectedCategory,
}: {
  onSelect: (category: OperationalReportCategoryFilter) => void;
  selectedCategory: OperationalReportCategoryFilter;
}) {
  const filters: OperationalReportCategoryFilter[] = ['all', ...operationalReportCategoryOptions];

  return (
    <View style={{ gap: 8 }}>
      <Text selectable style={{ color: '#1E2A24', fontSize: 14, fontWeight: '600' }}>
        Kategori
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {filters.map((category) => (
          <ChipButton
            key={category}
            active={selectedCategory === category}
            label={category === 'all' ? 'Semua' : formatOperationalReportCategory(category)}
            onPress={() => onSelect(category)}
          />
        ))}
      </View>
    </View>
  );
}

function ReportSummary({ compact, reports }: { compact?: boolean; reports: OperationalReport[] }) {
  const items: Array<{ label: string; value: number }> = compact
    ? [
        { label: 'Total', value: reports.length },
        { label: 'Tindak lanjut', value: countReportsByStatus(reports, 'in_progress') },
        { label: 'Selesai', value: countReportsByStatus(reports, 'resolved') },
      ]
    : [
        { label: 'Belum respons', value: countReportsByStatus(reports, 'new') },
        { label: 'Tindak lanjut', value: countReportsByStatus(reports, 'in_progress') },
        { label: 'Selesai', value: countReportsByStatus(reports, 'resolved') },
        { label: 'Ditolak', value: countReportsByStatus(reports, 'rejected') },
      ];

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {items.map((item) => (
        <View
          key={item.label}
          style={{
            backgroundColor: '#FFFFFF',
            borderColor: '#DCE7D5',
            borderRadius: 14,
            borderWidth: 1,
            flexBasis: compact ? '30%' : '47%',
            flexGrow: 1,
            gap: 3,
            minHeight: compact ? 74 : 78,
            padding: 11,
          }}
        >
          <Text selectable numberOfLines={2} style={{ color: appTheme.muted, fontSize: 12, fontWeight: '800', lineHeight: 16 }}>
            {item.label}
          </Text>
          <Text selectable style={{ color: appTheme.primary, fontSize: 22, fontVariant: ['tabular-nums'], fontWeight: '900' }}>
            {item.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

function ReportFollowUpSection({
  mode,
  tasks,
  workerNames,
}: {
  mode: 'owner' | 'worker';
  reportStatus: OperationalReportStatus;
  tasks: CareTaskDetail[];
  workerNames: Record<string, string>;
}) {
  return (
    <View style={{ gap: 12 }}>
      <Text selectable style={{ color: '#1E2A24', fontSize: 20, fontWeight: '800', paddingTop: 4 }}>
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
  task,
  workerNames,
}: {
  mode: 'owner' | 'worker';
  task: CareTaskDetail;
  workerNames: Record<string, string>;
}) {
  const taskRoute = mode === 'owner'
    ? `/owner/tasks/${task.id}`
    : `/worker/tasks/${task.id}`;

  return (
    <Card>
      <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'space-between' }}>
        <Text
          selectable
          numberOfLines={2}
          style={{ color: '#1E2A24', flex: 1, fontSize: 17, fontWeight: '900', lineHeight: 23 }}
        >
          {task.title}
        </Text>
        <Badge label={formatTaskStatus(task.status)} maxWidth={110} tone={getTaskTone(task.status)} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
        <Badge label="Dari Laporan" tone="muted" />
        {task.category ? <Badge label={formatCareCategory(task.category)} tone="success" /> : null}
      </View>
      <View style={{ gap: 9 }}>
        <MetaRow label="Pekerja" value={workerNames[task.assignedTo] ?? 'Pekerja tidak tersedia'} />
        <MetaRow label="Tanggal tugas" value={formatDate(task.dueDate)} />
        <MetaRow label="Target" value={formatCareTarget(task)} />
        <MetaRow label="Instruksi" value={task.instruction || '-'} />
      </View>

      {task.activities.length > 0 ? (
        <View style={{ gap: 10 }}>
          <Text selectable style={{ color: '#1E2A24', fontSize: 15, fontWeight: '800' }}>
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
                <Text selectable style={{ color: '#1E2A24', flex: 1, fontWeight: '800' }}>
                  {formatActivityStatus(activity.status)}
                </Text>
                <Badge label={formatActivityStatus(activity.status)} maxWidth={110} tone={getActivityTone(activity.status)} />
              </View>
              <MetaRow label="Waktu" value={formatDateTime(activity.performedAt)} />
              <MetaRow label="Pelaksana" value={workerNames[activity.performedBy] ?? 'Pekerja tidak tersedia'} />
              <MetaRow label="Catatan" value={activity.note || '-'} />
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

function formatReportSummary(report: OperationalReport): string {
  const summary = report.description ?? report.locationNote;

  if (!summary) {
    return 'Tanpa keterangan';
  }

  return summary.length > 96 ? `${summary.slice(0, 93)}...` : summary;
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

function countReportsByStatus(reports: OperationalReport[], status: OperationalReportStatus): number {
  return reports.filter((report) => report.status === status).length;
}

function getReportStatusTone(status: OperationalReportStatus): 'danger' | 'muted' | 'success' | 'warning' {
  if (status === 'resolved') {
    return 'success';
  }

  if (status === 'rejected') {
    return 'muted';
  }

  if (status === 'new') {
    return 'danger';
  }

  return 'warning';
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
          borderColor: '#DDE4DA',
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
