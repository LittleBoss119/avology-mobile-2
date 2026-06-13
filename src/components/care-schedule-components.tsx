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
import { formatTreeLocation } from '../utils/treeFormat';
import { Button, Card, EmptyState, Field, MetaRow } from './ui';
import { careCategoryOptions, formatCareCategory } from './care-sop-components';

export type ManualScheduleFormValues = {
  assignedWorkerId: string;
  category: '' | (typeof careCategoryOptions)[number];
  customTargetNote: string;
  instruction: string;
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
  onPress,
  schedule,
}: {
  onPress?: () => void;
  schedule: CareSchedule;
}) {
  const content = (
    <Card>
      <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'space-between' }}>
        <View style={{ flex: 1, gap: 5 }}>
          <Text selectable style={{ color: '#1E2A24', fontSize: 18, fontWeight: '700' }}>
            {schedule.title}
          </Text>
          <Text selectable style={{ color: '#68746D', lineHeight: 20 }}>
            {formatCareCategory(schedule.category)}
          </Text>
        </View>
        <SmallBadge label={schedule.careSopId ? 'SOP' : 'Manual'} />
      </View>
      <MetaRow label="Tanggal" value={schedule.scheduledDate} />
      <MetaRow label="Target" value={formatCareTarget(schedule)} />
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
      <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'space-between' }}>
        <View style={{ flex: 1, gap: 5 }}>
          <Text selectable style={{ color: '#1E2A24', fontSize: 17, fontWeight: '700' }}>
            {task.title}
          </Text>
          <Text selectable style={{ color: '#68746D', lineHeight: 20 }}>
            {task.category ? formatCareCategory(task.category) : 'Tanpa kategori'}
          </Text>
        </View>
        <SmallBadge label={formatTaskStatus(task.status)} />
      </View>
      {showAssignedWorker ? (
        <MetaRow label="Worker" value={assignedWorkerName ?? task.assignedTo} />
      ) : null}
      <MetaRow label="Jatuh tempo" value={task.dueDate} />
      <MetaRow label="Target" value={formatCareTarget(task)} />
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

  return (
    <View style={{ gap: 14 }}>
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

      <Field
        label="Tanggal jadwal *"
        onChangeText={(value) => updateValue('scheduledDate', value)}
        placeholder="YYYY-MM-DD"
        value={values.scheduledDate}
      />

      <WorkerPicker
        selectedWorkerId={values.assignedWorkerId}
        workers={workers}
        onSelect={(workerId) => updateValue('assignedWorkerId', workerId)}
      />

      <TargetPicker
        onTargetTypeChange={updateTargetType}
        onValueChange={updateValue}
        trees={trees}
        values={values}
      />

      <TextArea
        label="Instruksi"
        onChangeText={(value) => updateValue('instruction', value)}
        placeholder="Instruksi kerja untuk worker"
        value={values.instruction}
      />
    </View>
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
    return input.targetTreeId ? `Pohon ${input.targetTreeId}` : 'Pohon belum dipilih';
  }

  return input.customTargetNote ?? 'Target custom belum diisi';
}

export function formatTaskStatus(status: TaskStatus): string {
  const labels: Record<TaskStatus, string> = {
    completed: 'Selesai',
    pending: 'Pending',
    postponed: 'Ditunda',
  };

  return labels[status];
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
        Worker aktif *
      </Text>
      {workers.length === 0 ? (
        <EmptyState title="Belum ada worker aktif" subtitle="Setujui worker terlebih dahulu sebelum membuat tugas." />
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
                  title={`${tree.treeCode} - ${formatTreeLocation(tree)}`}
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
          label="Catatan target custom *"
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

function SmallBadge({ label }: { label: string }) {
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: '#F2F4F7',
        borderColor: '#D0D5DD',
        borderRadius: 999,
        borderWidth: 1,
        paddingHorizontal: 10,
        paddingVertical: 5,
      }}
    >
      <Text selectable style={{ color: '#475467', fontSize: 12, fontWeight: '700' }}>
        {label}
      </Text>
    </View>
  );
}

function formatTargetType(targetType: TargetType): string {
  const labels: Record<TargetType, string> = {
    column: 'Kolom',
    custom: 'Custom',
    farm: 'Seluruh kebun',
    row: 'Baris',
    tree: 'Pohon',
  };

  return labels[targetType];
}
