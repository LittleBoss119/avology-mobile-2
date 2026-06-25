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
import { formatTreeLocation } from '../utils/treeFormat';
import { appTheme, Badge, Button, Card, CompactMetaItem, DateField, EmptyState, Field, MetaRow, SectionTitle } from './ui';
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
          <Text selectable style={{ color: '#1E2A24', fontSize: 18, fontWeight: '900', lineHeight: 24 }}>
            {schedule.title}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
            <Badge label={formatCareCategory(schedule.category)} tone="success" />
            <Badge label={schedule.careSopId ? 'Dari SOP' : 'Manual'} tone={schedule.careSopId ? 'warning' : 'muted'} />
            {statusLabel ? <Badge label={statusLabel} tone={statusTone} /> : null}
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
            style={{ color: '#065F2E', flex: 1, fontSize: 17, fontWeight: '900', lineHeight: 23 }}
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
    <View style={{ gap: 14 }}>
      <Card>
        <SectionTitle title="Rencana Perawatan" subtitle="Isi pekerjaan utama yang akan menjadi tugas pekerja." />
        <Field
          label="Judul jadwal *"
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
          label="Tanggal jadwal *"
          onChangeDate={(value) => updateValue('scheduledDate', value)}
          value={values.scheduledDate}
        />
      </Card>

      <Card>
        <SectionTitle title="Pekerja" subtitle="Pilih pekerja aktif yang menerima tugas ini." />
        <WorkerPicker
          selectedWorkerId={values.assignedWorkerId}
          workers={workers}
          onSelect={(workerId) => updateValue('assignedWorkerId', workerId)}
        />
      </Card>

      <Card>
        <SectionTitle title="Target" subtitle="Tentukan cakupan pekerjaan di kebun." />
        <TargetPicker
          onTargetTypeChange={updateTargetType}
          onValueChange={updateValue}
          trees={trees}
          values={values}
        />
      </Card>

      <Card>
        <TextArea
          label="Instruksi"
          onChangeText={(value) => updateValue('instruction', value)}
          placeholder="Instruksi kerja untuk pekerja"
          value={values.instruction}
        />
      </Card>

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
    <Card>
      <View style={{ gap: 6 }}>
        <Text selectable style={{ color: '#1E2A24', fontSize: 16, fontWeight: '800' }}>
          Butuh bukti foto
        </Text>
        <Text selectable style={{ color: '#68746D', lineHeight: 20 }}>
          Pekerja wajib mengunggah foto saat menyelesaikan tugas.
        </Text>
      </View>
      <Button
        title={enabled ? 'Bukti Foto Wajib' : 'Bukti Foto Tidak Wajib'}
        variant={enabled ? 'primary' : 'secondary'}
        onPress={onToggle}
      />
    </Card>
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
  onTargetTypeChange: (targetType: TargetType) => void;
  onValueChange: (field: keyof ManualScheduleFormValues, value: string) => void;
  trees: Tree[];
  values: ManualScheduleFormValues;
}) {
  return (
    <View style={{ gap: 12 }}>
      <OptionGroup
        label="Target jadwal *"
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
          <Text selectable style={{ color: '#1E2A24', fontSize: 14, fontWeight: '600' }}>
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
      <Text selectable style={{ color: '#1E2A24', fontSize: 14, fontWeight: '600' }}>
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
