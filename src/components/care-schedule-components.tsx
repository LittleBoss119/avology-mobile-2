import React from 'react';
import DateTimePicker, { type DateTimePickerChangeEvent } from '@react-native-community/datetimepicker';
import { Platform, Pressable, Text, TextInput, View, type LayoutChangeEvent } from 'react-native';

import type {
  CareSchedule,
  CareTask,
  TargetType,
  TaskStatus,
  Tree,
  WorkerMembership,
} from '../types/domain';
import {
  formatCareCategory,
  formatTargetType,
  formatTaskStatus,
  formatTreeTargetFallback,
} from '../utils/displayFormat';
import { formatTreeDisplayCode } from '../utils/treeFormat';
import { colors, radius, spacing } from '../constants/theme';
import { appTheme, Badge, Card, CompactMetaItem, MetaRow } from './ui';
import { Icon } from './icons';
import { careCategoryOptions } from './care-sop-components';

export type ManualScheduleFormValues = {
  assignedWorkerId: string;
  category: '' | (typeof careCategoryOptions)[number];
  customTargetNote: string;
  instruction: string;
  requiresPhoto: boolean;
  scheduledDate: string;
  targetColumn: string;
  targetRow: string;
  targetTreeId: string;
  targetType: TargetType;
  title: string;
};

export const careScheduleTargetOptions: TargetType[] = [
  'farm',
  'row',
  'column',
  'tree',
  'custom',
];

export function CareScheduleCard({
  assignedWorkerNames,
  onPress,
  schedule,
  statusLabel,
  statusTone = 'muted',
}: {
  assignedWorkerNames?: string[];
  onPress?: () => void;
  schedule: CareSchedule;
  statusLabel?: string;
  statusTone?: 'danger' | 'muted' | 'success' | 'warning';
}) {
  const content = (
    <Card>
      <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'space-between' }}>
        <View style={{ flex: 1, gap: 5 }}>
          <Text selectable style={{ color: '#1E2A24', fontSize: 18, fontWeight: '700', lineHeight: 24 }}>
            {schedule.title}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
            <Badge label={formatCareCategory(schedule.category)} tone="success" />
            <Badge label={schedule.careSopId ? 'Dari SOP' : 'Manual'} tone={schedule.careSopId ? 'warning' : 'muted'} />
            {schedule.isCancelled ? (
              <Badge label="Dibatalkan" tone="danger" />
            ) : statusLabel ? (
              <Badge label={statusLabel} tone={statusTone} />
            ) : null}
          </View>
        </View>
      </View>
      <View style={{ backgroundColor: appTheme.primarySoft, borderRadius: 12, gap: 8, padding: 12 }}>
        <MetaRow label="Target pekerjaan" value={formatCareTarget(schedule)} />
        <MetaRow label="Jatuh tempo" value={formatDate(schedule.scheduledDate)} />
        {assignedWorkerNames && assignedWorkerNames.length > 0 ? (
          <MetaRow label="Pekerja" value={assignedWorkerNames.join(', ')} />
        ) : null}
      </View>
    </Card>
  );

  if (!onPress) {
    return content;
  }

  return <Pressable onPress={onPress}>{content}</Pressable>;
}

export function CareTaskSummaryCard({
  assignedWorkerName,
  onPress,
  showAssignedWorker = true,
  task,
}: {
  assignedWorkerName?: string;
  onPress?: () => void;
  showAssignedWorker?: boolean;
  task: CareTask;
}) {
  const content = (
    <Card>
      <View style={{ gap: 8 }}>
        <View style={{ alignItems: 'flex-start', flexDirection: 'row', gap: 8, justifyContent: 'space-between' }}>
          <Text
            selectable
            ellipsizeMode="tail"
            numberOfLines={1}
            style={{ color: '#065F2E', flex: 1, fontSize: 17, fontWeight: '700', lineHeight: 23 }}
          >
            {task.title}
          </Text>
          <Badge label={formatTaskStatus(task.status)} maxWidth={96} tone={getTaskTone(task.status)} />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
          <Badge label={formatTaskSource(task)} maxWidth={100} tone="muted" />
          <Badge label={task.category ? formatCareCategory(task.category) : 'Tanpa kategori'} maxWidth={128} tone="success" />
          {task.requiresPhoto ? <Badge label="Butuh bukti" tone="warning" /> : null}
        </View>
        {task.instruction ? (
          <Text selectable ellipsizeMode="tail" numberOfLines={2} style={{ color: '#68746D', fontSize: 13, lineHeight: 18 }}>
            {task.instruction}
          </Text>
        ) : null}
        <View style={{ gap: 4 }}>
          <View style={{ alignItems: 'center', flexDirection: 'row', gap: 10 }}>
            <CompactMetaItem icon="calendar" label={formatDate(task.dueDate)} />
            <CompactMetaItem icon="target" label={formatCareTarget(task)} />
          </View>
          {showAssignedWorker ? (
            <CompactMetaItem icon="user" label={assignedWorkerName ?? 'Pekerja tidak tersedia'} />
          ) : null}
        </View>
      </View>
    </Card>
  );

  if (!onPress) {
    return content;
  }

  return <Pressable onPress={onPress}>{content}</Pressable>;
}

export type ScheduleFormErrors = {
  title?: string;
  category?: string;
  scheduledDate?: string;
  assignedWorkerId?: string;
  targetType?: string;
  targetDetail?: string;
};

// Urutan field untuk "scroll ke error pertama" (RF §3.6).
export const scheduleFormFieldOrder = [
  'title',
  'category',
  'scheduledDate',
  'assignedWorkerId',
  'targetType',
  'targetDetail',
] as const;

// Form datar (tanpa judul section), gaya mengikuti Tambah Pohon. Validasi inline
// per-field (border/ label merah + pesan 11px); ErrorBanner hanya untuk error
// jaringan (ditangani layar pemanggil). `onFieldLayout` melaporkan posisi Y tiap
// field ke pemanggil supaya bisa auto-scroll ke error pertama.
export function ManualScheduleForm({
  errors,
  onChange,
  onFieldLayout,
  trees,
  values,
  workers,
}: {
  errors?: ScheduleFormErrors;
  onChange: (values: ManualScheduleFormValues) => void;
  onFieldLayout?: (key: string, y: number) => void;
  trees: Tree[];
  values: ManualScheduleFormValues;
  workers: WorkerMembership[];
}) {
  function updateValue(field: keyof ManualScheduleFormValues, value: string) {
    onChange({
      ...values,
      [field]: value,
    });
  }

  function updateTargetType(targetType: TargetType) {
    onChange({
      ...values,
      customTargetNote: targetType === 'custom' ? values.customTargetNote : '',
      targetColumn: targetType === 'column' ? values.targetColumn : '',
      targetRow: targetType === 'row' ? values.targetRow : '',
      targetTreeId: targetType === 'tree' ? values.targetTreeId : '',
      targetType,
    });
  }

  function reportLayout(key: string) {
    return (event: LayoutChangeEvent) => onFieldLayout?.(key, event.nativeEvent.layout.y);
  }

  const showTargetDetail =
    values.targetType === 'row' ||
    values.targetType === 'column' ||
    values.targetType === 'tree' ||
    values.targetType === 'custom';

  return (
    <View style={{ gap: spacing['2xl'] }}>
      <View onLayout={reportLayout('title')}>
        <FormTextField
          error={errors?.title}
          label="Judul *"
          onChangeText={(value) => updateValue('title', value)}
          placeholder="Contoh: Pemupukan blok A"
          value={values.title}
        />
      </View>

      <View onLayout={reportLayout('category')}>
        <FormChipGroup
          error={errors?.category}
          label="Kategori *"
          options={careCategoryOptions.map((category) => ({ label: formatCareCategory(category), value: category }))}
          selectedValue={values.category}
          onSelect={(value) => updateValue('category', value)}
        />
      </View>

      <View onLayout={reportLayout('scheduledDate')}>
        <FormDateField
          error={errors?.scheduledDate}
          label="Tanggal *"
          value={values.scheduledDate}
          onChangeDate={(value) => updateValue('scheduledDate', value)}
        />
      </View>

      <View onLayout={reportLayout('assignedWorkerId')}>
        <FormChipGroup
          emptyText="Belum ada pekerja aktif. Setujui pekerja dulu sebelum membuat tugas."
          error={errors?.assignedWorkerId}
          label="Pekerja *"
          options={workers.map((worker) => ({ label: worker.fullName, value: worker.userId }))}
          selectedValue={values.assignedWorkerId}
          onSelect={(value) => updateValue('assignedWorkerId', value)}
        />
      </View>

      <View onLayout={reportLayout('targetType')}>
        <FormChipGroup
          error={errors?.targetType}
          label="Target *"
          options={careScheduleTargetOptions.map((targetType) => ({ label: formatTargetType(targetType), value: targetType }))}
          selectedValue={values.targetType}
          onSelect={(value) => updateTargetType(value as TargetType)}
        />
      </View>

      {showTargetDetail ? (
        <View onLayout={reportLayout('targetDetail')}>
          {values.targetType === 'row' ? (
            <FormTextField
              error={errors?.targetDetail}
              label="Baris *"
              onChangeText={(value) => updateValue('targetRow', value)}
              placeholder="Contoh: A"
              value={values.targetRow}
            />
          ) : null}
          {values.targetType === 'column' ? (
            <FormTextField
              error={errors?.targetDetail}
              label="Kolom *"
              onChangeText={(value) => updateValue('targetColumn', value)}
              placeholder="Contoh: 1"
              value={values.targetColumn}
            />
          ) : null}
          {values.targetType === 'tree' ? (
            <FormChipGroup
              emptyText="Belum ada pohon aktif. Tambahkan pohon dulu."
              error={errors?.targetDetail}
              label="Pohon *"
              options={trees.map((tree) => ({ label: formatTreeDisplayCode(tree), value: tree.id }))}
              selectedValue={values.targetTreeId}
              onSelect={(value) => updateValue('targetTreeId', value)}
            />
          ) : null}
          {values.targetType === 'custom' ? (
            <FormTextField
              error={errors?.targetDetail}
              label="Target khusus *"
              multiline
              onChangeText={(value) => updateValue('customTargetNote', value)}
              placeholder="Contoh: Area dekat gudang pupuk"
              value={values.customTargetNote}
            />
          ) : null}
        </View>
      ) : null}

      <View onLayout={reportLayout('instruction')}>
        <FormTextField
          label="Instruksi · opsional"
          multiline
          onChangeText={(value) => updateValue('instruction', value)}
          placeholder="Contoh: Pupuk merata di sekitar tajuk"
          value={values.instruction}
        />
      </View>

      <View onLayout={reportLayout('requiresPhoto')}>
        <FormChipGroup
          label="Bukti foto"
          options={[
            { label: 'Tidak wajib', value: 'no' },
            { label: 'Wajib', value: 'yes' },
          ]}
          selectedValue={values.requiresPhoto ? 'yes' : 'no'}
          onSelect={(value) => onChange({ ...values, requiresPhoto: value === 'yes' })}
        />
      </View>
    </View>
  );
}

// Validasi bersama Buat & Edit: tandai semua field wajib yang belum valid sekaligus.
export function validateScheduleForm(values: ManualScheduleFormValues): ScheduleFormErrors {
  const errors: ScheduleFormErrors = {};

  if (!values.title.trim()) {
    errors.title = 'Judul wajib diisi.';
  }

  if (!values.category) {
    errors.category = 'Pilih kategori.';
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(values.scheduledDate.trim())) {
    errors.scheduledDate = 'Pilih tanggal.';
  }

  if (!values.assignedWorkerId.trim()) {
    errors.assignedWorkerId = 'Pilih satu pekerja.';
  }

  if (!values.targetType) {
    errors.targetType = 'Pilih target.';
  }

  if (values.targetType === 'row' && !values.targetRow.trim()) {
    errors.targetDetail = 'Baris wajib diisi.';
  } else if (values.targetType === 'column' && !values.targetColumn.trim()) {
    errors.targetDetail = 'Kolom wajib diisi.';
  } else if (values.targetType === 'tree' && !values.targetTreeId.trim()) {
    errors.targetDetail = 'Pohon wajib dipilih.';
  } else if (values.targetType === 'custom' && !values.customTargetNote.trim()) {
    errors.targetDetail = 'Target khusus wajib diisi.';
  }

  return errors;
}

export function hasScheduleFormErrors(errors: ScheduleFormErrors): boolean {
  return Boolean(
    errors.title ||
      errors.category ||
      errors.scheduledDate ||
      errors.assignedWorkerId ||
      errors.targetType ||
      errors.targetDetail
  );
}

// Hapus error field yang sudah terisi (dipakai saat nilai berubah); tak pernah
// menambah error baru supaya pesan tidak muncul sambil mengetik.
export function clearResolvedScheduleFormErrors(
  errors: ScheduleFormErrors,
  values: ManualScheduleFormValues
): ScheduleFormErrors {
  if (!hasScheduleFormErrors(errors)) {
    return errors;
  }

  return {
    title: values.title.trim() ? undefined : errors.title,
    category: values.category ? undefined : errors.category,
    scheduledDate: /^\d{4}-\d{2}-\d{2}$/.test(values.scheduledDate.trim()) ? undefined : errors.scheduledDate,
    assignedWorkerId: values.assignedWorkerId.trim() ? undefined : errors.assignedWorkerId,
    targetType: values.targetType ? undefined : errors.targetType,
    targetDetail: isTargetDetailValid(values) ? undefined : errors.targetDetail,
  };
}

function isTargetDetailValid(values: ManualScheduleFormValues): boolean {
  if (values.targetType === 'row') {
    return Boolean(values.targetRow.trim());
  }

  if (values.targetType === 'column') {
    return Boolean(values.targetColumn.trim());
  }

  if (values.targetType === 'tree') {
    return Boolean(values.targetTreeId.trim());
  }

  if (values.targetType === 'custom') {
    return Boolean(values.customTargetNote.trim());
  }

  return true;
}

// ---- Primitive field datar (label "*" merah, error inline 11px) ----
function FormLabel({ error = false, text }: { error?: boolean; text: string }) {
  const required = text.endsWith(' *');
  const optional = text.endsWith(' · opsional');
  const base = required
    ? text.slice(0, -2)
    : optional
      ? text.slice(0, -' · opsional'.length)
      : text;

  return (
    <Text selectable style={{ color: error ? colors.danger : colors.text, fontSize: 14, fontWeight: '700' }}>
      {base}
      {required ? <Text style={{ color: colors.danger }}> *</Text> : null}
      {optional ? <Text style={{ color: colors.textMuted, fontWeight: '400' }}> · opsional</Text> : null}
    </Text>
  );
}

function FormError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return (
    <Text selectable style={{ color: colors.danger, fontSize: 13, lineHeight: 18 }}>
      {message}
    </Text>
  );
}

function FormTextField({
  error,
  label,
  multiline = false,
  onChangeText,
  placeholder,
  value,
}: {
  error?: string;
  label: string;
  multiline?: boolean;
  onChangeText: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  return (
    <View style={{ gap: spacing.sm }}>
      <FormLabel text={label} />
      <TextInput
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSoft}
        style={{
          backgroundColor: colors.surface,
          borderColor: error ? colors.danger : colors.border,
          borderCurve: 'continuous',
          borderRadius: radius.md,
          borderWidth: 1,
          color: colors.text,
          fontSize: 16,
          minHeight: multiline ? 104 : 54,
          paddingHorizontal: spacing.lg,
          ...(multiline ? { paddingTop: spacing.md, textAlignVertical: 'top' } : null),
        }}
        value={value}
      />
      <FormError message={error} />
    </View>
  );
}

function FormChipGroup({
  emptyText,
  error,
  label,
  onSelect,
  options,
  selectedValue,
}: {
  emptyText?: string;
  error?: string;
  label: string;
  onSelect: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  selectedValue: string;
}) {
  return (
    <View style={{ gap: spacing.sm }}>
      <FormLabel error={Boolean(error)} text={label} />
      {options.length === 0 && emptyText ? (
        <Text selectable style={{ color: colors.textMuted, fontSize: 13, lineHeight: 18 }}>
          {emptyText}
        </Text>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {options.map((option) => (
            <FormChip
              key={option.value}
              active={selectedValue === option.value}
              error={Boolean(error)}
              label={option.label}
              onPress={() => onSelect(option.value)}
            />
          ))}
        </View>
      )}
      <FormError message={error} />
    </View>
  );
}

function FormChip({
  active,
  error = false,
  label,
  onPress,
}: {
  active: boolean;
  error?: boolean;
  label: string;
  onPress: () => void;
}) {
  const borderColor = active ? colors.primary : error ? colors.danger : colors.border;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{
        backgroundColor: active ? colors.primary : colors.surface,
        borderColor,
        borderCurve: 'continuous',
        borderRadius: radius.round,
        borderWidth: 1,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm + 1,
      }}
    >
      <Text selectable={false} style={{ color: active ? '#FFFFFF' : colors.text, fontSize: 14, fontWeight: '700' }}>
        {label}
      </Text>
    </Pressable>
  );
}

function FormDateField({
  error,
  label,
  onChangeDate,
  value,
}: {
  error?: string;
  label: string;
  onChangeDate: (value: string) => void;
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

  return (
    <View style={{ gap: spacing.sm }}>
      <FormLabel text={label} />
      <Pressable
        accessibilityRole="button"
        onPress={() => setShowPicker(true)}
        style={{
          alignItems: 'center',
          backgroundColor: colors.surface,
          borderColor: error ? colors.danger : colors.border,
          borderCurve: 'continuous',
          borderRadius: radius.md,
          borderWidth: 1,
          flexDirection: 'row',
          gap: spacing.md,
          justifyContent: 'center',
          minHeight: 54,
          paddingHorizontal: spacing.lg,
        }}
      >
        <Icon name="calendar" size={20} color={colors.primary} />
        <Text selectable style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>
          {formatFriendlyDate(value)}
        </Text>
      </Pressable>
      <FormError message={error} />
      {showPicker ? (
        <DateTimePicker
          display="default"
          mode="date"
          onDismiss={() => setShowPicker(false)}
          onNeutralButtonPress={() => setShowPicker(false)}
          onValueChange={handleValueChange}
          value={selectedDate}
        />
      ) : null}
    </View>
  );
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

  return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function ProofRequirementToggle({
  enabled,
  onToggle,
}: {
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <ScheduleFormSection title="Bukti Foto">
      <View
        style={{
          backgroundColor: colors.surfaceMuted,
          borderColor: colors.border,
          borderRadius: radius.lg,
          borderWidth: 1,
          flexDirection: 'row',
          gap: spacing.sm,
          padding: spacing.xs,
        }}
      >
        <ProofOptionButton active={!enabled} label="Tidak Wajib" onPress={enabled ? onToggle : undefined} />
        <ProofOptionButton active={enabled} label="Wajib" onPress={!enabled ? onToggle : undefined} />
      </View>
    </ScheduleFormSection>
  );
}

function ScheduleFormSection({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <View style={{ gap: spacing.md }}>
      <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: '700' }}>
        {title}
      </Text>
      <View style={{ gap: spacing.md }}>{children}</View>
    </View>
  );
}

function ProofOptionButton({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={!onPress}
      onPress={onPress}
      style={{
        alignItems: 'center',
        backgroundColor: active ? colors.primary : colors.surface,
        borderColor: active ? colors.primary : colors.border,
        borderRadius: radius.md,
        borderWidth: 1,
        flex: 1,
        justifyContent: 'center',
        minHeight: 44,
        paddingHorizontal: spacing.md,
      }}
    >
      <Text selectable style={{ color: active ? colors.surface : colors.text, fontSize: 14, fontWeight: '700' }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function formatCareTarget(input: {
  customTargetNote: string | null;
  targetColumn: string | null;
  targetRow: string | null;
  targetTreeId: string | null;
  targetType: TargetType;
}): string {
  if (input.targetType === 'farm') {
    return 'Seluruh kebun';
  }

  if (input.targetType === 'row') {
    return `Baris ${input.targetRow ?? '-'}`;
  }

  if (input.targetType === 'column') {
    return `Kolom ${input.targetColumn ?? '-'}`;
  }

  if (input.targetType === 'tree') {
    return formatTreeTargetFallback(input.targetTreeId);
  }

  return input.customTargetNote ?? 'Target khusus belum diisi';
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

function formatTaskSource(task: CareTask): string {
  if (task.careScheduleId) {
    return 'Dari Jadwal';
  }

  if (task.operationalReportId) {
    return 'Dari Laporan';
  }

  return 'Manual';
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

export { formatTaskSource, formatTaskStatus };
