import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { useAuth } from '../context/auth-context';
import { createTaskFromOperationalReport } from '../services/careTaskService';
import { getActiveWorkers } from '../services/memberService';
import {
  createOperationalReport,
  getOperationalReportDetail,
  getOperationalReports,
  updateOperationalReportStatus,
} from '../services/operationalReportService';
import { getTrees } from '../services/treeService';
import type {
  CreateTaskFromOperationalReportInput,
  OperationalReport,
  OperationalReportCategory,
  OperationalReportStatus,
  TargetType,
  Tree,
  WorkerMembership,
} from '../types/domain';
import {
  formatOperationalReportCategory,
  formatOperationalReportStatus,
  formatTargetType,
} from '../utils/displayFormat';
import { formatTreeLocation } from '../utils/treeFormat';
import {
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Field,
  LoadingState,
  MetaRow,
  PageIntro,
  Screen,
  SuccessBanner,
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
        <>
          <Button title="Simpan Laporan" loading={submitting} onPress={handleSubmit} />
          <Button title="Batal" variant="secondary" disabled={submitting} onPress={() => router.back()} />
        </>
      }
    >
      <PageIntro
        title="Laporan Operasional"
        subtitle="Laporkan kendala kebun agar pemilik bisa membuat tindak lanjut."
      />
      <ErrorBanner message={error} />
      <SuccessBanner message={success} />

      <Card>
        <Text selectable style={{ color: '#1E2A24', fontSize: 16, fontWeight: '700' }}>
          Kategori *
        </Text>
        <View style={{ gap: 10 }}>
          {operationalReportCategoryOptions.map((option) => (
            <Button
              key={option}
              title={formatOperationalReportCategory(option)}
              variant={category === option ? 'primary' : 'secondary'}
              onPress={() => setCategory(option)}
            />
          ))}
        </View>
      </Card>

      <Field
        label="Lokasi"
        onChangeText={setLocationNote}
        placeholder="Contoh: Gudang alat"
        value={locationNote}
      />

      <TextArea
        label="Deskripsi"
        onChangeText={setDescription}
        placeholder="Contoh: Selang penyemprot pecah"
        value={description}
      />
    </Screen>
  );
}

export function WorkerOperationalReportListScreen() {
  const { currentFarm } = useAuth();
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [reports, setReports] = React.useState<OperationalReport[]>([]);

  const farmId = currentFarm?.farmId;

  const loadReports = React.useCallback(async () => {
    if (!farmId || currentFarm?.role !== 'worker' || currentFarm.status !== 'active') {
      setError('Hanya pekerja aktif yang dapat melihat laporan operasional.');
      setReports([]);
      return;
    }

    setError(null);

    const result = await getOperationalReports({ farmId });

    if (result.error) {
      setError(result.error.message);
      setReports([]);
      return;
    }

    setReports(result.data);
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
    <Screen
      footer={
        <>
          <Button title="Buat Laporan" onPress={() => router.push('/worker/reports/create')} />
        </>
      }
    >
      <PageIntro
        title="Laporan Operasional"
        subtitle="Lihat laporan kebun yang pernah Anda kirim."
      />
      <ErrorBanner message={error} />

      {reports.length === 0 ? (
        <EmptyState
          title="Belum ada laporan"
          subtitle="Laporan operasional yang Anda buat akan muncul di sini."
        />
      ) : (
        <View style={{ gap: 12 }}>
          {reports.map((report) => (
            <OperationalReportCard key={report.id} report={report} />
          ))}
        </View>
      )}
    </Screen>
  );
}

export function OwnerOperationalReportListScreen() {
  const { currentFarm } = useAuth();
  const [categoryFilter, setCategoryFilter] = React.useState<OperationalReportCategoryFilter>('all');
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [reports, setReports] = React.useState<OperationalReport[]>([]);
  const [statusFilter, setStatusFilter] = React.useState<OperationalReportStatusFilter>('all');
  const [workerNames, setWorkerNames] = React.useState<Record<string, string>>({});

  const farmId = currentFarm?.farmId;

  const loadReports = React.useCallback(async () => {
    if (!farmId || currentFarm?.role !== 'owner' || currentFarm.status !== 'active') {
      setError('Hanya pemilik aktif yang dapat melihat laporan operasional.');
      setReports([]);
      setWorkerNames({});
      return;
    }

    setError(null);

    const [reportsResult, workersResult] = await Promise.all([
      getOperationalReports({
        category: categoryFilter,
        farmId,
        status: statusFilter,
      }),
      getActiveWorkers(farmId),
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
          workersResult.data.map((worker: WorkerMembership) => [worker.userId, worker.fullName])
        )
      );
    }
  }, [categoryFilter, currentFarm?.role, currentFarm?.status, farmId, statusFilter]);

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
      <PageIntro
        title="Laporan Operasional"
        subtitle="Pantau laporan kebun dari pekerja dan tindak lanjuti bila perlu."
      />
      <ErrorBanner message={error} />

      <ReportStatusFilter selectedStatus={statusFilter} onSelect={setStatusFilter} />
      <ReportCategoryFilter selectedCategory={categoryFilter} onSelect={setCategoryFilter} />

      {reports.length === 0 ? (
        <EmptyState
          title="Belum ada laporan"
          subtitle="Laporan operasional pekerja pada filter ini akan muncul di sini."
        />
      ) : (
        <View style={{ gap: 12 }}>
          {reports.map((report) => (
            <OperationalReportCard
              key={report.id}
              report={report}
              reporterName={workerNames[report.reportedBy]}
              onPress={() => router.push(`/owner/reports/${report.id}`)}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

export function OwnerOperationalReportDetailScreen({ reportId }: { reportId?: string }) {
  const { currentFarm } = useAuth();
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [report, setReport] = React.useState<OperationalReport | null>(null);
  const [updatingStatus, setUpdatingStatus] = React.useState<OperationalReportStatus | null>(null);
  const [workerNames, setWorkerNames] = React.useState<Record<string, string>>({});

  const farmId = currentFarm?.farmId;

  const loadDetail = React.useCallback(async () => {
    const normalizedReportId = reportId?.trim();

    if (!normalizedReportId) {
      setError('Data laporan tidak ditemukan.');
      setReport(null);
      setWorkerNames({});
      return;
    }

    if (!farmId || currentFarm?.role !== 'owner' || currentFarm.status !== 'active') {
      setError('Hanya pemilik aktif yang dapat melihat detail laporan operasional.');
      setReport(null);
      setWorkerNames({});
      return;
    }

    setError(null);

    const [reportResult, workersResult] = await Promise.all([
      getOperationalReportDetail({ operationalReportId: normalizedReportId }),
      getActiveWorkers(farmId),
    ]);

    if (reportResult.error) {
      setError(reportResult.error.message);
      setReport(null);
    } else {
      setReport(reportResult.data);
    }

    if (workersResult.error) {
      setWorkerNames({});
    } else {
      setWorkerNames(
        Object.fromEntries(
          workersResult.data.map((worker: WorkerMembership) => [worker.userId, worker.fullName])
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
    if (!report || status === report.status) {
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
      <Screen footer={<Button title="Kembali" variant="secondary" onPress={() => router.replace('/owner/reports')} />}>
        <PageIntro title="Detail Laporan" subtitle="Data laporan tidak dapat dimuat." />
        <ErrorBanner message={error} />
        <EmptyState title="Laporan tidak ditemukan" subtitle="Laporan mungkin tidak tersedia atau akses ditolak." />
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <>
          <Button
            title="Buat Tugas Tindak Lanjut"
            onPress={() => router.push(`/owner/reports/${report.id}/task`)}
          />
          <Button title="Kembali ke Laporan" variant="secondary" onPress={() => router.replace('/owner/reports')} />
        </>
      }
    >
      <PageIntro
        title={formatOperationalReportCategory(report.category)}
        subtitle="Detail laporan operasional kebun."
      />
      <ErrorBanner message={error} />

      <Card>
        <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'space-between' }}>
          <View style={{ flex: 1, gap: 5 }}>
            <Text selectable style={{ color: '#1E2A24', fontSize: 17, fontWeight: '700' }}>
              {formatOperationalReportCategory(report.category)}
            </Text>
            <Text selectable style={{ color: '#68746D', lineHeight: 20 }}>
              {formatOperationalReportStatus(report.status)}
            </Text>
          </View>
          <SmallBadge label={formatOperationalReportStatus(report.status)} />
        </View>
        <MetaRow label="Pelapor" value={workerNames[report.reportedBy] ?? 'Pelapor tidak tersedia'} />
        <MetaRow label="Tanggal dibuat" value={formatDateTime(report.createdAt)} />
        <MetaRow label="Lokasi" value={report.locationNote} />
      </Card>

      <Card>
        <Text selectable style={{ color: '#1E2A24', fontSize: 17, fontWeight: '700' }}>
          Deskripsi
        </Text>
        <Text selectable style={{ color: '#68746D', lineHeight: 21 }}>
          {report.description || 'Deskripsi belum diisi.'}
        </Text>
      </Card>

      <Card>
        <Text selectable style={{ color: '#1E2A24', fontSize: 17, fontWeight: '700' }}>
          Perbarui Status
        </Text>
        <View style={{ gap: 8 }}>
          {operationalReportStatusOptions.map((status) => (
            <Button
              key={status}
              title={formatOperationalReportStatus(status)}
              disabled={Boolean(updatingStatus)}
              loading={updatingStatus === status}
              variant={report.status === status ? 'primary' : 'secondary'}
              onPress={() => handleStatusUpdate(status)}
            />
          ))}
        </View>
      </Card>
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

  return (
    <Screen
      footer={
        <>
          <Button title="Buat Tugas" loading={submitting} onPress={handleSubmit} />
          <Button title="Batal" variant="secondary" disabled={submitting} onPress={() => router.back()} />
        </>
      }
    >
      <PageIntro title="Buat Tugas Tindak Lanjut" subtitle="Buat tugas tindak lanjut untuk pekerja aktif." />
      <ErrorBanner message={error} />

      {report ? (
        <Card>
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

      <Field
        label="Tanggal jatuh tempo *"
        onChangeText={setDueDate}
        placeholder="YYYY-MM-DD"
        value={dueDate}
      />

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

function OperationalReportCard({
  onPress,
  report,
  reporterName,
}: {
  onPress?: () => void;
  report: OperationalReport;
  reporterName?: string;
}) {
  const content = (
    <Card>
      <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'space-between' }}>
        <View style={{ flex: 1, gap: 5 }}>
          <Text selectable style={{ color: '#1E2A24', fontSize: 17, fontWeight: '700' }}>
            {formatOperationalReportCategory(report.category)}
          </Text>
          <Text selectable style={{ color: '#68746D', lineHeight: 20 }}>
            {formatReportSummary(report)}
          </Text>
        </View>
        <SmallBadge label={formatOperationalReportStatus(report.status)} />
      </View>
      <MetaRow label="Tanggal" value={formatDate(report.createdAt)} />
      {reporterName ? <MetaRow label="Pelapor" value={reporterName} /> : null}
      {report.locationNote ? <MetaRow label="Lokasi" value={report.locationNote} /> : null}
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
      <View style={{ gap: 8 }}>
        {filters.map((status) => (
          <Button
            key={status}
            title={status === 'all' ? 'Semua' : formatOperationalReportStatus(status)}
            variant={selectedStatus === status ? 'primary' : 'secondary'}
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
      <View style={{ gap: 8 }}>
        {filters.map((category) => (
          <Button
            key={category}
            title={category === 'all' ? 'Semua' : formatOperationalReportCategory(category)}
            variant={selectedCategory === category ? 'primary' : 'secondary'}
            onPress={() => onSelect(category)}
          />
        ))}
      </View>
    </View>
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
                  title={`${tree.treeCode} - ${formatTreeLocation(tree)}`}
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

function SmallBadge({ label }: { label: string }) {
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: '#E7F6EC',
        borderColor: '#A6D9B8',
        borderCurve: 'continuous',
        borderRadius: 8,
        borderWidth: 1,
        paddingHorizontal: 10,
        paddingVertical: 5,
      }}
    >
      <Text selectable style={{ color: '#2F6F4E', fontSize: 12, fontWeight: '700' }}>
        {label}
      </Text>
    </View>
  );
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
