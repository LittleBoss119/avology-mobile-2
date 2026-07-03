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
import { colors, radius, spacing } from '../constants/theme';
import { Badge, Button, Card, CompactMetaItem, EmptyState, Field, FormSection, MetaRow } from './ui';

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
      <View style={{ gap: spacing.sm }}>
        <View style={{ alignItems: 'flex-start', flexDirection: 'row', gap: 8, justifyContent: 'space-between' }}>
          <Text
            selectable
            ellipsizeMode="tail"
            numberOfLines={1}
            style={{ color: colors.primary, flex: 1, fontSize: 17, fontWeight: '900', lineHeight: 23 }}
          >
            {sop.name}
          </Text>
          <Badge label={sop.isActive ? 'Aktif' : 'Nonaktif'} maxWidth={86} tone={sop.isActive ? 'success' : 'muted'} />
        </View>

        <View style={{ alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          <Text selectable numberOfLines={1} style={{ color: colors.textMuted, fontSize: 13, fontWeight: '800' }}>
            {formatCareCategoryShort(sop.category)}
          </Text>
          {reference && isActionableReference(reference) ? (
            <Badge
              label={formatScheduleReferenceStatus(reference)}
              maxWidth={160}
              tone={getReferenceTone(reference)}
            />
          ) : null}
        </View>

        <View style={{ gap: spacing.xs }}>
          <View style={{ alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
            <CompactMetaItem icon="calendar" label={formatIntervalDays(sop.intervalDays)} />
            <CompactMetaItem icon="target" label={formatCareSOPTarget(sop)} />
          </View>
          <Text selectable ellipsizeMode="tail" numberOfLines={1} style={{ color: colors.textMuted, fontSize: 13, lineHeight: 18 }}>
            Acuan: {reference ? formatScheduleReferenceShortStatus(reference) : 'Belum tersedia'}
          </Text>
        </View>
      </View>
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
      <FormSection title="Informasi SOP" description="Simpan nama, kategori, dan periode kerja yang sering berulang.">
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
      </FormSection>

      <FormSection
        title="Instruksi Default"
        description="Instruksi ini akan menjadi acuan saat membuat jadwal dari SOP."
      >
        <TextArea
          label="Instruksi Default"
          onChangeText={(value) => updateValue('defaultInstruction', value)}
          placeholder="Tulis instruksi ringkas untuk pekerja"
          value={values.defaultInstruction}
        />
      </FormSection>

      <FormSection title="Target Bawaan" description="Target ini masih bisa disesuaikan saat membuat jadwal.">
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
      </FormSection>
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
      <Text selectable style={{ color: colors.textMuted, fontSize: 13 }}>
        Acuan jadwal berikutnya
      </Text>
      <Badge label={formatScheduleReferenceStatus(reference)} tone={getReferenceTone(reference)} />
      {!compact ? (
        <>
          <MetaRow label="Realisasi terakhir" value={formatDateTime(reference.lastPerformedAt)} />
          <MetaRow label="Tanggal acuan berikutnya" value={formatDateOnly(reference.nextDueDate ?? '')} />
          {reference.status === 'overdue' ? (
            <MetaRow label="Terlambat" value={`${reference.overdueDays ?? 0} hari`} />
          ) : null}
          {reference.status === 'upcoming' ? (
            <MetaRow label="Jatuh tempo dalam" value={`${reference.daysUntilDue ?? 0} hari`} />
          ) : null}
        </>
      ) : reference.nextDueDate ? (
        <Text selectable numberOfLines={1} style={{ color: colors.textMuted, fontSize: 13, lineHeight: 18 }}>
          {formatDateOnly(reference.nextDueDate)}
        </Text>
      ) : null}
    </View>
  );
}

export { formatCareCategory };

function formatCareCategoryShort(category: CareCategory): string {
  if (category === 'other') {
    return 'Lainnya';
  }

  if (category === 'weeding') {
    return 'Gulma';
  }

  return formatCareCategory(category);
}

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
  return intervalDays ? `Setiap ${intervalDays} hari` : 'Tidak ada interval';
}

export function formatScheduleReferenceStatus(
  reference: CareSOPNextScheduleReference
): string {
  if (reference.status === 'no_history') {
    return 'Belum ada realisasi';
  }

  if (reference.status === 'no_interval') {
    return 'Tidak ada interval';
  }

  if (reference.status === 'upcoming') {
    return 'Belum jatuh tempo';
  }

  if (reference.status === 'due_today') {
    return 'Jatuh tempo hari ini';
  }

  return 'Terlambat';
}

function formatScheduleReferenceShortStatus(reference: CareSOPNextScheduleReference): string {
  if (reference.status === 'no_history') {
    return 'Belum ada realisasi';
  }

  if (reference.status === 'no_interval') {
    return 'Tidak ada interval';
  }

  if (reference.status === 'upcoming') {
    if (reference.daysUntilDue !== undefined) {
      return `Belum jatuh tempo (${reference.daysUntilDue} hari)`;
    }

    return 'Belum jatuh tempo';
  }

  if (reference.status === 'due_today') {
    return 'Hari ini';
  }

  return reference.overdueDays !== undefined
    ? `Terlambat ${reference.overdueDays} hari`
    : 'Terlambat';
}

function isActionableReference(reference: CareSOPNextScheduleReference): boolean {
  return reference.status === 'overdue' || reference.status === 'due_today';
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
      <Text selectable style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>
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

function formatDateOnly(value: string): string {
  if (!value) {
    return 'Belum tersedia';
  }

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

type BadgeTone = 'danger' | 'info' | 'muted' | 'success' | 'warning';
