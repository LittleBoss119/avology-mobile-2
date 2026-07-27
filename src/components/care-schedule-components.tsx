import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

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
import { appTheme, Badge, Button, Card, ChipButton, CompactMetaItem, DateField, EmptyState, Field, FormSection, MetaRow } from './ui';
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

export function ManualScheduleForm({
  onChange,
  trees,
  values,
  workers,
}: {
  onChange: (values: ManualScheduleFormValues) => void;
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

  function updateRequiresPhoto() {
    onChange({
      ...values,
      requiresPhoto: !values.requiresPhoto,
    });
  }

  return (
    <View style={{ gap: spacing['2xl'] }}>
      <ScheduleFormSection title="Rencana Perawatan">
        <Field
          label="Judul *"
          onChangeText={(value) => updateValue('title', value)}
          placeholder="Contoh: Penyiraman area barat"
          value={values.title}
        />

        <OptionGroup
          label="Kategori *"
          options={careCategoryOptions.map((category) => ({
            label: formatCareCategory(category),
            value: category,
          }))}
          selectedValue={values.category}
          onSelect={(value) => updateValue('category', value)}
        />

        <DateField
          label="Tanggal *"
          onChangeDate={(value) => updateValue('scheduledDate', value)}
          placeholder="Pilih tanggal jadwal"
          value={values.scheduledDate}
        />
      </ScheduleFormSection>

      <ScheduleFormSection title="Pekerja">
        <WorkerPicker
          selectedWorkerId={values.assignedWorkerId}
          workers={workers}
          onSelect={(workerId) => updateValue('assignedWorkerId', workerId)}
        />
      </ScheduleFormSection>

      <ScheduleFormSection title="Target">
        <TargetPicker
          onTargetTypeChange={updateTargetType}
          onValueChange={updateValue}
          trees={trees}
          values={values}
        />
      </ScheduleFormSection>

      <ScheduleFormSection title="Instruksi">
        <TextArea
          label="Instruksi"
          onChangeText={(value) => updateValue('instruction', value)}
          placeholder="Instruksi kerja untuk pekerja"
          value={values.instruction}
        />
      </ScheduleFormSection>

      <ProofRequirementToggle
        enabled={values.requiresPhoto}
        onToggle={updateRequiresPhoto}
      />
    </View>
  );
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
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {workers.map((worker) => (
            <ChipButton
              key={worker.userId}
              active={selectedWorkerId === worker.userId}
              label={worker.fullName}
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
  onTargetTypeChange: (targetType: TargetType) => void;
  onValueChange: (field: keyof ManualScheduleFormValues, value: string) => void;
  trees: Tree[];
  values: ManualScheduleFormValues;
}) {
  return (
    <View style={{ gap: 12 }}>
      <OptionGroup
        label="Target Jadwal *"
        options={careScheduleTargetOptions.map((targetType) => ({
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
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {trees.map((tree) => (
                <ChipButton
                  key={tree.id}
                  active={values.targetTreeId === tree.id}
                  label={formatTreeDisplayCode(tree)}
                  onPress={() => onValueChange('targetTreeId', tree.id)}
                />
              ))}
            </View>
          )}
        </View>
      ) : null}

      {values.targetType === 'custom' ? (
        <TextArea
          label="Catatan target khusus *"
          onChangeText={(value) => onValueChange('customTargetNote', value)}
          placeholder="Contoh: Area dekat gudang pupuk"
          value={values.customTargetNote}
        />
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
  selectedValue: TValue | '';
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text selectable style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>
        {label}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {options.map((option) => (
          <ChipButton
            key={option.value}
            active={selectedValue === option.value}
            label={option.label}
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
