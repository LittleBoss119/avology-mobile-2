import { router } from 'expo-router';
import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import {
  canCreateTaskFromReportStatus,
  getClosedReportTaskMessage,
} from '../constants/operationalReport';
import { colors, radius, spacing, tokens } from '../constants/theme';
import { useAuth } from '../context/auth-context';
import { getActiveWorkers } from '../services/memberService';
import {
  getOperationalReportDetail,
  resolveReportWithTask,
} from '../services/operationalReportService';
import { getTrees } from '../services/treeService';
import type {
  CareCategory,
  OperationalReport,
  ResolveReportWithTaskInput,
  TargetType,
  Tree,
  WorkerMembership,
} from '../types/domain';
import { formatOperationalReportCategory, formatTargetType } from '../utils/displayFormat';
import { formatTreeLocation } from '../utils/treeFormat';
import { ProofRequirementToggle } from './care-schedule-components';
import { careCategoryOptions, formatCareCategory } from './care-sop-components';
import { Icon } from './icons';
import { useSnackbar } from './snackbar';
import {
  Button,
  Card,
  DateField,
  EmptyState,
  ErrorBanner,
  Field,
  FormSection,
  LoadingState,
  OptionGroup,
  Screen,
  TopAppBar,
  type OptionItem,
} from './ui';

const targetTypeOptions: TargetType[] = ['farm', 'row', 'column', 'tree', 'custom'];

export function OwnerCreateTaskFromOperationalReportScreen({ reportId }: { reportId?: string }) {
  const { currentFarm } = useAuth();
  const showSnackbar = useSnackbar();

  const [assignedWorkerId, setAssignedWorkerId] = React.useState('');
  const [category, setCategory] = React.useState<CareCategory | null>(null);
  const [customTargetNote, setCustomTargetNote] = React.useState('');
  const [dueDate, setDueDate] = React.useState(getTodayIsoDate());
  const [error, setError] = React.useState<string | null>(null);
  const [instruction, setInstruction] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [ownerResponseNote, setOwnerResponseNote] = React.useState('');
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
        // Catatan owner di-prefill dari catatan yang sudah ada supaya keputusan
        // sebelumnya tidak hilang saat form ini disimpan.
        setOwnerResponseNote(reportResult.data.ownerResponseNote ?? '');

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

    if (!category) {
      setError('Kategori perawatan wajib dipilih.');
      return;
    }

    if (targetType === 'row' && !targetRow.trim()) {
      setError('Baris target wajib diisi.');
      return;
    }

    if (targetType === 'column' && !targetColumn.trim()) {
      setError('Kolom target wajib diisi.');
      return;
    }

    if (targetType === 'tree' && !targetTreeId) {
      setError('Pohon target wajib dipilih.');
      return;
    }

    if (targetType === 'custom' && !customTargetNote.trim()) {
      setError('Catatan target khusus wajib diisi.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const payload: ResolveReportWithTaskInput = {
      assignedWorkerId,
      category,
      customTargetNote: targetType === 'custom' ? customTargetNote : null,
      dueDate,
      instruction,
      operationalReportId: report.id,
      // Field catatan ADA di form ini, jadi isinya dikirim apa adanya.
      // Kosong berarti owner memang ingin menghapus catatan lama.
      ownerResponseNote,
      requiresPhoto,
      targetColumn: targetType === 'column' ? targetColumn : null,
      targetRow: targetType === 'row' ? targetRow : null,
      targetTreeId: targetType === 'tree' ? targetTreeId : null,
      targetType,
      title,
    };

    const result = await resolveReportWithTask(payload);

    if (result.error) {
      setError(result.error.message);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    showSnackbar('Tugas tindak lanjut dibuat.');
    router.replace(`/owner/tasks/${result.data.taskId}`);
  }

  if (loading) {
    return <LoadingState message="Memuat form tindak lanjut..." />;
  }

  const canSubmitFollowUpTask = report ? canCreateTaskFromReportStatus(report.status) : false;

  const workerOptions: OptionItem[] = workers.map((worker) => ({
    label: worker.fullName,
    value: worker.userId,
  }));

  const treeOptions: OptionItem[] = trees.map((tree) => ({
    label: formatTreeLocation(tree),
    value: tree.id,
  }));

  return (
    <Screen
      header={<TopAppBar title="Tugas Tindak Lanjut" onBack={() => router.back()} />}
      stickyFooter={
        <Button
          title="Simpan tugas"
          disabled={!canSubmitFollowUpTask || !category}
          loading={submitting}
          onPress={handleSubmit}
        />
      }
    >
      <ErrorBanner message={error} />

      {report ? <ReportContextRow report={report} /> : null}

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

        <OptionGroup
          label="Kategori perawatan *"
          options={careCategoryOptions.map((option) => ({
            label: formatCareCategory(option),
            value: option,
          }))}
          value={category}
          onChange={(value) => setCategory(value as CareCategory)}
        />

        {workers.length === 0 ? (
          <EmptyState
            title="Belum ada pekerja aktif"
            subtitle="Setujui pekerja terlebih dahulu sebelum membuat tugas."
          />
        ) : (
          <OptionGroup
            label="Pekerja aktif *"
            options={workerOptions}
            value={assignedWorkerId}
            onChange={setAssignedWorkerId}
          />
        )}
      </FormSection>

      <FormSection title="Target Tugas" description="Pilih area atau pohon yang perlu dikerjakan.">
        <OptionGroup
          label="Target tugas *"
          options={targetTypeOptions.map((option) => ({
            label: formatTargetType(option),
            value: option,
          }))}
          value={targetType}
          onChange={(value) => updateTargetType(value as TargetType)}
        />

        {targetType === 'row' ? (
          <Field
            label="Baris target *"
            onChangeText={setTargetRow}
            placeholder="Contoh: A"
            value={targetRow}
          />
        ) : null}

        {targetType === 'column' ? (
          <Field
            label="Kolom target *"
            onChangeText={setTargetColumn}
            placeholder="Contoh: 1"
            value={targetColumn}
          />
        ) : null}

        {targetType === 'tree' ? (
          trees.length === 0 ? (
            <EmptyState
              title="Belum ada pohon aktif"
              subtitle="Tambahkan pohon sebelum membuat tugas per pohon."
            />
          ) : (
            <OptionGroup
              label="Pohon target *"
              options={treeOptions}
              value={targetTreeId}
              onChange={setTargetTreeId}
            />
          )
        ) : null}

        {targetType === 'custom' ? (
          <TextArea
            label="Catatan target khusus *"
            onChangeText={setCustomTargetNote}
            placeholder="Contoh: Area dekat gudang pupuk"
            value={customTargetNote}
          />
        ) : null}
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

      <FormSection
        title="Catatan Keputusan"
        description="Catatan ini tersimpan di laporan, bukan di tugas."
      >
        <TextArea
          label="Catatan owner · opsional"
          onChangeText={setOwnerResponseNote}
          placeholder="Contoh: Sudah saya cek, perlu diganti minggu ini"
          value={ownerResponseNote}
        />
      </FormSection>
    </Screen>
  );
}

// Konteks laporan diringkas jadi satu baris. Tap = kembali ke detail laporan;
// sengaja router.back() dan bukan push, karena layar ini hanya bisa dicapai
// dari detail laporan itu sendiri — push akan menumpuk instance yang sama.
function ReportContextRow({ report }: { report: OperationalReport }) {
  const description = report.description?.trim();

  return (
    <Pressable accessibilityRole="button" onPress={() => router.back()}>
      <Card padding={spacing.md}>
        <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.sm }}>
          <Text
            selectable={false}
            ellipsizeMode="tail"
            numberOfLines={1}
            style={{ color: colors.textMuted, flex: 1, fontSize: 13, lineHeight: 18 }}
          >
            {`Dari laporan: ${description || formatOperationalReportCategory(report.category)}`}
          </Text>
          <Icon name="chevron-right" size={tokens.icon.sm} color={colors.textSoft} />
        </View>
      </Card>
    </Pressable>
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
      <Text selectable style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>
        {label}
      </Text>
      <TextInput
        multiline
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSoft}
        style={{
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderCurve: 'continuous',
          borderRadius: radius.md,
          borderWidth: 1,
          color: colors.text,
          fontSize: 16,
          minHeight: 104,
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          textAlignVertical: 'top',
        }}
        value={value}
      />
    </View>
  );
}

function getTodayIsoDate(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}
