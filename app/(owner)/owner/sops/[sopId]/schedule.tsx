import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Alert, Text, TextInput, View } from 'react-native';

import {
  careSopTargetOptions,
  formatCareCategory,
  formatCareSOPTarget,
  ScheduleReferenceSummary,
} from '../../../../../src/components/care-sop-components';
import { ProofRequirementToggle } from '../../../../../src/components/care-schedule-components';
import {
  Badge,
  Button,
  DateField,
  EmptyState,
  ErrorBanner,
  Field,
  FormSection,
  LoadingState,
  MetaRow,
  Screen,
  TopAppBar,
} from '../../../../../src/components/ui';
import { colors, radius, spacing } from '../../../../../src/constants/theme';
import { useAuth } from '../../../../../src/context/auth-context';
import { createScheduleFromSOP } from '../../../../../src/services/careScheduleService';
import {
  getCareSOPDetail,
  getCareSOPNextScheduleReference,
} from '../../../../../src/services/careSopService';
import { getActiveWorkers } from '../../../../../src/services/memberService';
import { getTrees } from '../../../../../src/services/treeService';
import type {
  CareSOP,
  CareSOPDefaultTargetType,
  CareSOPNextScheduleReference,
  Tree,
  WorkerMembership,
} from '../../../../../src/types/domain';
import { formatTargetType } from '../../../../../src/utils/displayFormat';
import { formatTreeLocation } from '../../../../../src/utils/treeFormat';

type ScheduleFormValues = {
  assignedWorkerId: string;
  instruction: string;
  requiresPhoto: boolean;
  scheduledDate: string;
  targetColumn: string;
  targetRow: string;
  targetTreeId: string;
  targetType: CareSOPDefaultTargetType;
};

const initialValues: ScheduleFormValues = {
  assignedWorkerId: '',
  instruction: '',
  requiresPhoto: false,
  scheduledDate: '',
  targetColumn: '',
  targetRow: '',
  targetTreeId: '',
  targetType: 'farm',
};

export default function CreateScheduleFromSOPScreen() {
  const { currentFarm } = useAuth();
  const { sopId } = useLocalSearchParams<{ sopId: string }>();
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [reference, setReference] = React.useState<CareSOPNextScheduleReference | null>(null);
  const [sop, setSop] = React.useState<CareSOP | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [trees, setTrees] = React.useState<Tree[]>([]);
  const [values, setValues] = React.useState<ScheduleFormValues>(initialValues);
  const [workers, setWorkers] = React.useState<WorkerMembership[]>([]);

  const farmId = currentFarm?.farmId;

  React.useEffect(() => {
    let isMounted = true;

    async function loadData() {
      const normalizedSopId = sopId?.trim();

      if (!farmId) {
        setError('Data kebun aktif tidak ditemukan.');
        setLoading(false);
        return;
      }

      if (!normalizedSopId) {
        setError('Data SOP tidak ditemukan.');
        setLoading(false);
        return;
      }

      setError(null);

      const sopResult = await getCareSOPDetail({ sopId: normalizedSopId });

      if (!isMounted) {
        return;
      }

      if (sopResult.error) {
        setError(sopResult.error.message);
        setLoading(false);
        return;
      }

      if (!sopResult.data.isActive) {
        setError('SOP nonaktif tidak dapat digunakan untuk membuat jadwal.');
      }

      setSop(sopResult.data);

      const [referenceResult, workersResult, treesResult] = await Promise.all([
        getCareSOPNextScheduleReference({ sopId: normalizedSopId }),
        getActiveWorkers(farmId),
        getTrees({
          archived: false,
          farmId,
        }),
      ]);

      if (!isMounted) {
        return;
      }

      if (referenceResult.error) {
        setReference(null);
      } else {
        setReference(referenceResult.data);
      }

      if (workersResult.error) {
        setError(workersResult.error.message);
        setWorkers([]);
      } else {
        setWorkers(workersResult.data);
      }

      if (treesResult.error) {
        setError(treesResult.error.message);
        setTrees([]);
      } else {
        setTrees(treesResult.data);
      }

      setValues({
        assignedWorkerId: '',
        instruction: sopResult.data.defaultInstruction ?? '',
        requiresPhoto: false,
        scheduledDate:
          referenceResult.error || !referenceResult.data.nextDueDate
            ? getTodayIsoDate()
            : referenceResult.data.nextDueDate,
        targetColumn: sopResult.data.defaultTargetColumn ?? '',
        targetRow: sopResult.data.defaultTargetRow ?? '',
        targetTreeId: sopResult.data.defaultTargetTreeId ?? '',
        targetType: sopResult.data.defaultTargetType,
      });
      setLoading(false);
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [farmId, sopId]);

  function updateValue(field: keyof ScheduleFormValues, value: string) {
    setValues((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updateTargetType(targetType: CareSOPDefaultTargetType) {
    setValues((current) => ({
      ...current,
      targetColumn: targetType === 'column' ? current.targetColumn : '',
      targetRow: targetType === 'row' ? current.targetRow : '',
      targetTreeId: targetType === 'tree' ? current.targetTreeId : '',
      targetType,
    }));
  }

  function selectWorker(workerId: string) {
    setValues((current) => ({
      ...current,
      assignedWorkerId: workerId,
    }));
  }

  function toggleRequiresPhoto() {
    setValues((current) => ({
      ...current,
      requiresPhoto: !current.requiresPhoto,
    }));
  }

  async function handleSubmit() {
    if (!farmId) {
      setError('Data kebun aktif tidak ditemukan.');
      return;
    }

    if (!sop) {
      setError('Data SOP tidak ditemukan.');
      return;
    }

    if (!sop.isActive) {
      setError('SOP nonaktif tidak dapat digunakan untuk membuat jadwal.');
      return;
    }

    const validation = validateValues(values);

    if (validation instanceof Error) {
      setError(validation.message);
      return;
    }

    setSubmitting(true);
    setError(null);

    const result = await createScheduleFromSOP({
      assignedWorkerIds: [values.assignedWorkerId],
      farmId,
      instruction: values.instruction,
      requiresPhoto: values.requiresPhoto,
      scheduledDate: values.scheduledDate,
      sopId: sop.id,
      targetColumn: values.targetType === 'column' ? values.targetColumn : null,
      targetRow: values.targetType === 'row' ? values.targetRow : null,
      targetTreeId: values.targetType === 'tree' ? values.targetTreeId : null,
      targetType: values.targetType,
    });

    if (result.error) {
      setError(result.error.message);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    Alert.alert(
      'Jadwal dibuat',
      `${result.data.taskIds.length} tugas pekerja berhasil dibuat dari SOP.`,
      [
        {
          text: 'OK',
          onPress: () => router.replace(`/owner/sops/${sop.id}`),
        },
      ]
    );
  }

  if (loading) {
    return <LoadingState message="Menyiapkan jadwal dari SOP..." />;
  }

  if (!sop) {
    return (
      <Screen>
        <TopAppBar title="Buat dari SOP" onBack={() => router.back()} />
        <ErrorBanner message={error} />
        <EmptyState title="SOP tidak ditemukan" subtitle="SOP mungkin tidak tersedia atau akses ditolak." />
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <View style={{ gap: 10 }}>
          <Button
            title="Simpan Jadwal"
            disabled={!sop.isActive}
            loading={submitting}
            onPress={handleSubmit}
          />
          <Button title="Batal" variant="secondary" onPress={() => router.back()} />
        </View>
      }
    >
      <TopAppBar title="Buat dari SOP" onBack={() => router.back()} />
      <ErrorBanner message={error} />

      <FormSection title="Pilih SOP" description="SOP yang dipilih menjadi dasar jadwal dan tugas pekerja.">
        <View style={{ gap: spacing.sm }}>
          <View style={{ alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' }}>
            <Text selectable style={{ color: colors.text, flex: 1, fontSize: 17, fontWeight: '700', lineHeight: 23 }}>
              {sop.name}
            </Text>
            <Badge label={sop.isActive ? 'Aktif' : 'Nonaktif'} maxWidth={92} tone={sop.isActive ? 'success' : 'muted'} />
          </View>
          <MetaRow label="Kategori" value={formatCareCategory(sop.category)} />
          <MetaRow label="Target SOP" value={formatCareSOPTarget(sop)} />
          <MetaRow label="Instruksi default" value={sop.defaultInstruction || 'Belum ada instruksi default.'} />
          <MetaRow label="Butuh bukti foto default" value="Tidak wajib" />
        </View>
      </FormSection>

      {reference ? (
        <FormSection title="Acuan Jadwal" description="Referensi jadwal berikutnya dari histori SOP.">
          <ScheduleReferenceSummary reference={reference} />
        </FormSection>
      ) : null}

      <FormSection title="Jadwal" description="Tentukan tanggal dan pekerja yang menerima tugas.">
        <DateField
          label="Tanggal Jadwal *"
          onChangeDate={(value) => updateValue('scheduledDate', value)}
          placeholder="Pilih tanggal jadwal"
          value={values.scheduledDate}
        />

        <WorkerPicker
          selectedWorkerId={values.assignedWorkerId}
          workers={workers}
          onSelect={selectWorker}
        />
      </FormSection>

      <FormSection title="Target" description="Target bawaan SOP masih bisa disesuaikan untuk jadwal ini.">
        <TargetPicker
          onTargetTypeChange={updateTargetType}
          onValueChange={updateValue}
          trees={trees}
          values={values}
        />
      </FormSection>

      <FormSection title="Instruksi Tambahan">
        <TextArea
          label="Instruksi"
          onChangeText={(value) => updateValue('instruction', value)}
          placeholder="Instruksi kerja untuk pekerja"
          value={values.instruction}
        />
      </FormSection>

      <ProofRequirementToggle
        enabled={values.requiresPhoto}
        onToggle={toggleRequiresPhoto}
      />
    </Screen>
  );
}

function WorkerPicker({
  onSelect,
  selectedWorkerId,
  workers,
}: {
  onSelect: (workerId: string) => void;
  selectedWorkerId: string;
  workers: WorkerMembership[];
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text selectable style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>
        Pekerja Aktif *
      </Text>
      {workers.length === 0 ? (
        <EmptyState title="Belum ada pekerja aktif" subtitle="Setujui pekerja terlebih dahulu sebelum membuat tugas." />
      ) : (
        <View style={{ gap: 8 }}>
          {workers.map((worker) => (
            <Button
              key={worker.userId}
              title={worker.fullName}
              variant={selectedWorkerId === worker.userId ? 'primary' : 'secondary'}
              onPress={() => onSelect(worker.userId)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function TargetPicker({
  onTargetTypeChange,
  onValueChange,
  trees,
  values,
}: {
  onTargetTypeChange: (targetType: CareSOPDefaultTargetType) => void;
  onValueChange: (field: keyof ScheduleFormValues, value: string) => void;
  trees: Tree[];
  values: ScheduleFormValues;
}) {
  return (
    <View style={{ gap: 12 }}>
      <OptionGroup
        label="Target Jadwal *"
        options={careSopTargetOptions.map((targetType) => ({
          label: formatTargetType(targetType),
          value: targetType,
        }))}
        selectedValue={values.targetType}
        onSelect={onTargetTypeChange}
      />

      {values.targetType === 'row' ? (
        <Field
          label="Baris target *"
          onChangeText={(value) => onValueChange('targetRow', value)}
          placeholder="Contoh: A"
          value={values.targetRow}
        />
      ) : null}

      {values.targetType === 'column' ? (
        <Field
          label="Kolom target *"
          onChangeText={(value) => onValueChange('targetColumn', value)}
          placeholder="Contoh: 1"
          value={values.targetColumn}
        />
      ) : null}

      {values.targetType === 'tree' ? (
        <View style={{ gap: 8 }}>
          <Text selectable style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>
            Pohon target *
          </Text>
          {trees.length === 0 ? (
            <EmptyState title="Belum ada pohon aktif" subtitle="Tambahkan pohon sebelum membuat jadwal per pohon." />
          ) : (
            <View style={{ gap: 8 }}>
              {trees.map((tree) => (
                <Button
                  key={tree.id}
                  title={formatTreeLocation(tree)}
                  variant={values.targetTreeId === tree.id ? 'primary' : 'secondary'}
                  onPress={() => onValueChange('targetTreeId', tree.id)}
                />
              ))}
            </View>
          )}
        </View>
      ) : null}
    </View>
  );
}

function OptionGroup<TValue extends string>({
  label,
  onSelect,
  options,
  selectedValue,
}: {
  label: string;
  onSelect: (value: TValue) => void;
  options: Array<{ label: string; value: TValue }>;
  selectedValue: TValue;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text selectable style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>
        {label}
      </Text>
      <View style={{ gap: 8 }}>
        {options.map((option) => (
          <Button
            key={option.value}
            title={option.label}
            variant={selectedValue === option.value ? 'primary' : 'secondary'}
            onPress={() => onSelect(option.value)}
          />
        ))}
      </View>
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
      <Text selectable style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>
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

function validateValues(values: ScheduleFormValues): Error | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(values.scheduledDate.trim())) {
    return new Error('Tanggal jadwal harus memakai format YYYY-MM-DD.');
  }

  if (!values.assignedWorkerId.trim()) {
    return new Error('Pilih satu pekerja aktif.');
  }

  if (values.targetType === 'row' && !values.targetRow.trim()) {
    return new Error('Baris target wajib diisi.');
  }

  if (values.targetType === 'column' && !values.targetColumn.trim()) {
    return new Error('Kolom target wajib diisi.');
  }

  if (values.targetType === 'tree' && !values.targetTreeId.trim()) {
    return new Error('Pohon target wajib dipilih.');
  }

  return null;
}

function getTodayIsoDate(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}
