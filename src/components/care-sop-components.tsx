import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import type {
  CareCategory,
  CareSOP,
  CareSOPDefaultTargetType,
  CareSOPNextScheduleReference,
  Tree,
} from '../types/domain';
import {
  formatCareCategory,
  formatTargetType,
  formatTreeTargetFallback,
} from '../utils/displayFormat';
import { formatTreeLocation } from '../utils/treeFormat';
import { appTheme, Badge, Button, Card, EmptyState, Field, MetaRow, SectionTitle } from './ui';

export type CareSOPFormValues = {
  name: string;
  category: CareCategory | '';
  intervalDays: string;
  defaultInstruction: string;
  defaultTargetType: CareSOPDefaultTargetType;
  defaultTargetRow: string;
  defaultTargetColumn: string;
  defaultTargetTreeId: string;
};

export const careCategoryOptions: CareCategory[] = [
  'watering',
  'fertilizing',
  'spraying',
  'weeding',
  'other',
];

export const careSopTargetOptions: CareSOPDefaultTargetType[] = [
  'farm',
  'row',
  'column',
  'tree',
];

export function CareSOPCard({
  onPress,
  reference,
  sop,
}: {
  onPress?: () => void;
  reference?: CareSOPNextScheduleReference | null;
  sop: CareSOP;
}) {
  const content = (
    <Card>
      <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'space-between' }}>
        <View style={{ flex: 1, gap: 5 }}>
          <Text selectable style={{ color: '#1E2A24', fontSize: 18, fontWeight: '900', lineHeight: 24 }}>
            {sop.name}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
            <Badge label={formatCareCategory(sop.category)} tone="success" />
            <Badge label={sop.isActive ? 'Aktif' : 'Nonaktif'} tone={sop.isActive ? 'success' : 'muted'} />
          </View>
        </View>
      </View>
      {sop.defaultInstruction ? (
        <Text selectable numberOfLines={2} style={{ color: '#68746D', lineHeight: 20 }}>
          {sop.defaultInstruction}
        </Text>
      ) : null}
      <View style={{ backgroundColor: appTheme.primarySoft, borderRadius: 12, gap: 8, padding: 12 }}>
        <MetaRow label="Periode" value={formatIntervalDays(sop.intervalDays)} />
        <MetaRow label="Target bawaan" value={formatCareSOPTarget(sop)} />
      </View>
      {reference ? <ScheduleReferenceSummary reference={reference} compact /> : null}
    </Card>
  );

  if (!onPress) {
    return content;
  }

  return <Pressable onPress={onPress}>{content}</Pressable>;
}

export function CareSOPForm({
  onChange,
  trees,
  values,
}: {
  onChange: (values: CareSOPFormValues) => void;
  trees: Tree[];
  values: CareSOPFormValues;
}) {
  function updateValue(field: keyof CareSOPFormValues, value: string) {
    onChange({
      ...values,
      [field]: value,
    });
  }

  function updateTargetType(targetType: CareSOPDefaultTargetType) {
    onChange({
      ...values,
      defaultTargetType: targetType,
      defaultTargetRow: targetType === 'row' ? values.defaultTargetRow : '',
      defaultTargetColumn: targetType === 'column' ? values.defaultTargetColumn : '',
      defaultTargetTreeId: targetType === 'tree' ? values.defaultTargetTreeId : '',
    });
  }

  return (
    <View style={{ gap: 14 }}>
      <Card>
        <SectionTitle title="Template Perawatan" subtitle="Simpan nama, kategori, dan periode kerja yang sering berulang." />
        <Field
          label="Nama SOP *"
          onChangeText={(value) => updateValue('name', value)}
          placeholder="Contoh: Pemupukan NPK"
          value={values.name}
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
          keyboardType="number-pad"
          label="Periode perawatan (hari)"
          onChangeText={(value) => updateValue('intervalDays', value)}
          placeholder="Contoh: 14"
          value={values.intervalDays}
        />
      </Card>

      <Card>
        <TextArea
          label="Instruksi untuk pekerja"
          onChangeText={(value) => updateValue('defaultInstruction', value)}
          placeholder="Tulis instruksi ringkas untuk pekerja"
          value={values.defaultInstruction}
        />
      </Card>

      <Card>
        <SectionTitle title="Target Bawaan" subtitle="Target ini masih bisa disesuaikan saat membuat jadwal." />
        <OptionGroup
          label="Cakupan target *"
          options={careSopTargetOptions.map((targetType) => ({
            label: formatTargetType(targetType),
            value: targetType,
          }))}
          selectedValue={values.defaultTargetType}
          onSelect={(value) => updateTargetType(value as CareSOPDefaultTargetType)}
        />

        {values.defaultTargetType === 'row' ? (
          <Field
            label="Baris target *"
            onChangeText={(value) => updateValue('defaultTargetRow', value)}
            placeholder="Contoh: A"
            value={values.defaultTargetRow}
          />
        ) : null}

        {values.defaultTargetType === 'column' ? (
          <Field
            label="Kolom target *"
            onChangeText={(value) => updateValue('defaultTargetColumn', value)}
            placeholder="Contoh: 1"
            value={values.defaultTargetColumn}
          />
        ) : null}

        {values.defaultTargetType === 'tree' ? (
          <TreeTargetPicker
            selectedTreeId={values.defaultTargetTreeId}
            trees={trees}
            onSelect={(treeId) => updateValue('defaultTargetTreeId', treeId)}
          />
        ) : null}
      </Card>
    </View>
  );
}

export function ScheduleReferenceSummary({
  compact,
  reference,
}: {
  compact?: boolean;
  reference: CareSOPNextScheduleReference;
}) {
  return (
    <View style={{ gap: compact ? 6 : 10 }}>
      <Text selectable style={{ color: '#68746D', fontSize: 13 }}>
        Acuan jadwal berikutnya
      </Text>
      <Badge label={formatScheduleReferenceStatus(reference)} tone={getReferenceTone(reference)} />
      {!compact ? (
        <>
          <MetaRow label="Realisasi terakhir" value={formatDateTime(reference.lastPerformedAt)} />
          <MetaRow label="Tanggal acuan" value={reference.nextDueDate} />
          {reference.status === 'overdue' ? (
            <MetaRow label="Terlambat" value={`${reference.overdueDays ?? 0} hari`} />
          ) : null}
        </>
      ) : reference.nextDueDate ? (
        <Text selectable style={{ color: '#68746D', lineHeight: 20 }}>
          {reference.nextDueDate}
        </Text>
      ) : null}
    </View>
  );
}

export { formatCareCategory };

export function formatCareSOPTarget(sop: CareSOP): string {
  if (sop.defaultTargetType === 'farm') {
    return 'Seluruh kebun';
  }

  if (sop.defaultTargetType === 'row') {
    return `Baris ${sop.defaultTargetRow ?? '-'}`;
  }

  if (sop.defaultTargetType === 'column') {
    return `Kolom ${sop.defaultTargetColumn ?? '-'}`;
  }

  return formatTreeTargetFallback(sop.defaultTargetTreeId);
}

export function formatIntervalDays(intervalDays: number | null): string {
  return intervalDays ? `${intervalDays} hari` : 'Belum diisi';
}

export function formatScheduleReferenceStatus(
  reference: CareSOPNextScheduleReference
): string {
  if (reference.status === 'no_history') {
    return 'Belum ada realisasi';
  }

  if (reference.status === 'no_interval') {
    return 'Interval belum diisi';
  }

  if (reference.status === 'upcoming') {
    return 'Belum jatuh tempo';
  }

  if (reference.status === 'due_today') {
    return 'Jatuh tempo hari ini';
  }

  return 'Terlambat';
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

function TreeTargetPicker({
  onSelect,
  selectedTreeId,
  trees,
}: {
  onSelect: (treeId: string) => void;
  selectedTreeId: string;
  trees: Tree[];
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text selectable style={{ color: '#1E2A24', fontSize: 14, fontWeight: '600' }}>
        Pohon target *
      </Text>
      {trees.length === 0 ? (
        <EmptyState title="Belum ada pohon aktif" subtitle="Tambahkan pohon sebelum membuat SOP per pohon." />
      ) : (
        <View style={{ gap: 8 }}>
          {trees.map((tree) => (
            <Button
              key={tree.id}
              title={`${formatTreeLocation(tree)}`}
              variant={selectedTreeId === tree.id ? 'primary' : 'secondary'}
              onPress={() => onSelect(tree.id)}
            />
          ))}
        </View>
      )}
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

function formatDateTime(value: string | null): string {
  if (!value) {
    return '-';
  }

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

function getReferenceTone(reference: CareSOPNextScheduleReference): BadgeTone {
  if (reference.status === 'overdue') {
    return 'danger';
  }

  if (reference.status === 'due_today') {
    return 'warning';
  }

  if (reference.status === 'upcoming') {
    return 'success';
  }

  return 'muted';
}

type BadgeTone = 'danger' | 'muted' | 'success' | 'warning';
