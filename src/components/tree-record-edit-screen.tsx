import { router } from 'expo-router';
import React from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';

import { colors, radius, spacing, typography } from '../constants/theme';
import {
  getConditionReportDetail,
  updateOwnConditionReport,
} from '../services/conditionReportService';
import {
  getGrowthPhaseRecordDetail,
  updateOwnGrowthPhaseRecord,
} from '../services/growthPhaseService';
import {
  getHarvestRecordDetail,
  updateOwnHarvestRecord,
} from '../services/harvestService';
import {
  getManualCareRecordDetail,
  updateOwnManualCareRecord,
} from '../services/manualCareService';
import { getTreeDetail } from '../services/treeService';
import type {
  CareCategory,
  GrowthPhase,
  TargetType,
  Tree,
  TreeConditionStatus,
  UUID,
} from '../types/domain';
import { formatCareCategory } from '../utils/displayFormat';
import { formatGrowthPhase, formatTreeConditionStatus, formatTreeDisplayCode, formatTreeLocation } from '../utils/treeFormat';
import { careCategoryOptions } from './care-sop-components';
import type { TreeRecordRouteType } from './tree-record-detail-screen';
import {
  Button,
  Card,
  DateField,
  EmptyState,
  ErrorBanner,
  FormSection,
  LoadingState,
  MetaRow,
  Screen,
  TopAppBar,
} from './ui';

type TreeRecordEditScreenProps = {
  basePath: '/owner/trees' | '/worker/trees';
  recordId?: string;
  recordType?: string;
  treeId?: string;
};

const conditionOptions: TreeConditionStatus[] = [
  'healthy',
  'needs_attention',
  'pest_attacked',
  'disease_indicated',
  'damaged',
  'dead',
];

const phaseOptions: GrowthPhase[] = [
  'initial_planting',
  'vegetative',
  'flowering',
  'fruiting',
  'harvesting',
];

export function TreeRecordEditScreen({
  basePath,
  recordId,
  recordType,
  treeId,
}: TreeRecordEditScreenProps) {
  const normalizedType = normalizeRecordType(recordType);
  const [canEdit, setCanEdit] = React.useState(false);
  const [category, setCategory] = React.useState<CareCategory | ''>('');
  const [conditionStatus, setConditionStatus] = React.useState<TreeConditionStatus | ''>('');
  const [customTargetNote, setCustomTargetNote] = React.useState('');
  const [eventDate, setEventDate] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [fruitCondition, setFruitCondition] = React.useState('');
  const [fruitCount, setFruitCount] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [note, setNote] = React.useState('');
  const [phase, setPhase] = React.useState<GrowthPhase | ''>('');
  const [submitting, setSubmitting] = React.useState(false);
  const [targetColumn, setTargetColumn] = React.useState('');
  const [targetRow, setTargetRow] = React.useState('');
  const [targetTreeId, setTargetTreeId] = React.useState<string | null>(null);
  const [targetType, setTargetType] = React.useState<TargetType>('tree');
  const [tree, setTree] = React.useState<Tree | null>(null);

  const loadRecord = React.useCallback(async () => {
    if (!treeId || !recordId || !normalizedType) {
      setError('Catatan tidak ditemukan.');
      setCanEdit(false);
      setTree(null);
      return;
    }

    setError(null);
    const treeResult = await getTreeDetail({ treeId });

    if (treeResult.error) {
      setError(treeResult.error.message);
      setTree(null);
    } else {
      setTree(treeResult.data);
    }

    if (normalizedType === 'condition') {
      const result = await getConditionReportDetail({ reportId: recordId });

      if (result.error) {
        setError(result.error.message);
        setCanEdit(false);
        return;
      }

      setCanEdit(result.data.canEdit === true);
      setConditionStatus(result.data.conditionStatus);
      setEventDate(toDateInput(result.data.reportedAt));
      setNote(result.data.note ?? '');
      return;
    }

    if (normalizedType === 'phase') {
      const result = await getGrowthPhaseRecordDetail({ recordId });

      if (result.error) {
        setError(result.error.message);
        setCanEdit(false);
        return;
      }

      setCanEdit(result.data.canEdit === true);
      setEventDate(toDateInput(result.data.recordedAt));
      setNote(result.data.note ?? '');
      setPhase(result.data.phase);
      return;
    }

    if (normalizedType === 'harvest') {
      const result = await getHarvestRecordDetail({ recordId });

      if (result.error) {
        setError(result.error.message);
        setCanEdit(false);
        return;
      }

      setCanEdit(result.data.canEdit === true);
      setEventDate(toDateInput(result.data.harvestedAt));
      setFruitCondition(result.data.fruitCondition ?? '');
      setFruitCount(String(result.data.fruitCount));
      setNote(result.data.note ?? '');
      return;
    }

    const result = await getManualCareRecordDetail({ recordId });

    if (result.error) {
      setError(result.error.message);
      setCanEdit(false);
      return;
    }

    setCanEdit(result.data.canEdit === true);
    setCategory(result.data.category);
    setCustomTargetNote(result.data.customTargetNote ?? '');
    setEventDate(toDateInput(result.data.performedAt));
    setNote(result.data.note ?? '');
    setTargetColumn(result.data.targetColumn ?? '');
    setTargetRow(result.data.targetRow ?? '');
    setTargetTreeId(result.data.targetTreeId ?? treeId);
    setTargetType(result.data.targetType);
  }, [normalizedType, recordId, treeId]);

  React.useEffect(() => {
    setLoading(true);
    loadRecord().finally(() => setLoading(false));
  }, [loadRecord]);

  async function handleSubmit() {
    if (!recordId || !normalizedType) {
      setError('Catatan tidak ditemukan.');
      return;
    }

    if (!eventDate) {
      setError('Tanggal catatan wajib diisi.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const result = await submitRecordUpdate(normalizedType, recordId);

    if (result) {
      setError(result);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    Alert.alert('Catatan berhasil diperbarui.', '', [
      {
        text: 'OK',
        onPress: () => router.replace(`${basePath}/${treeId}/records/${normalizedType}/${recordId}`),
      },
    ]);
  }

  async function submitRecordUpdate(type: TreeRecordRouteType, id: UUID): Promise<string | null> {
    if (type === 'condition') {
      if (!conditionStatus) {
        return 'Status kondisi wajib dipilih.';
      }

      const result = await updateOwnConditionReport({
        conditionStatus,
        note,
        reportedAt: eventDate,
        reportId: id,
      });
      return result.error?.message ?? null;
    }

    if (type === 'phase') {
      if (!phase) {
        return 'Fase pertumbuhan wajib dipilih.';
      }

      const result = await updateOwnGrowthPhaseRecord({
        note,
        phase,
        recordedAt: eventDate,
        recordId: id,
      });
      return result.error?.message ?? null;
    }

    if (type === 'harvest') {
      const parsedFruitCount = Number(fruitCount);

      if (!fruitCount.trim()) {
        return 'Jumlah buah wajib diisi.';
      }

      if (!Number.isInteger(parsedFruitCount) || parsedFruitCount <= 0) {
        return 'Jumlah buah harus lebih dari 0.';
      }

      const result = await updateOwnHarvestRecord({
        fruitCondition,
        fruitCount: parsedFruitCount,
        harvestedAt: eventDate,
        note,
        recordId: id,
      });
      return result.error?.message ?? null;
    }

    if (!category) {
      return 'Jenis perawatan wajib dipilih.';
    }

    const normalizedTarget = normalizeManualCareTarget();

    if (normalizedTarget instanceof Error) {
      return normalizedTarget.message;
    }

    const result = await updateOwnManualCareRecord({
      category,
      customTargetNote: normalizedTarget.customTargetNote,
      note,
      performedAt: eventDate,
      recordId: id,
      targetColumn: normalizedTarget.targetColumn,
      targetRow: normalizedTarget.targetRow,
      targetTreeId: normalizedTarget.targetTreeId,
      targetType,
    });
    return result.error?.message ?? null;
  }

  if (loading) {
    return <LoadingState message="Memuat catatan..." />;
  }

  if (!normalizedType || !recordId) {
    return (
      <Screen>
        <TopAppBar title="Edit catatan" onBack={() => router.back()} />
        <EmptyState title="Catatan tidak ditemukan" subtitle="Buka kembali catatan dari timeline pohon." />
      </Screen>
    );
  }

  if (!canEdit) {
    return (
      <Screen>
        <TopAppBar title={getEditTitle(normalizedType)} onBack={() => router.back()} />
        <ErrorBanner message={error} />
        <EmptyState title="Tidak bisa diedit" subtitle="Catatan ini hanya bisa diubah oleh pelapor." />
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <>
          <Button title="Simpan perubahan" loading={submitting} onPress={handleSubmit} />
          <Button title="Batal" variant="secondary" disabled={submitting} onPress={() => router.back()} />
        </>
      }
    >
      <TopAppBar title={getEditTitle(normalizedType)} onBack={() => router.back()} />
      <ErrorBanner message={error} />

      {tree ? (
        <Card variant="highlight">
          <Text selectable style={{ color: colors.text, fontSize: typography.h3.fontSize, fontWeight: '800' }}>
            Konteks Pohon
          </Text>
          <MetaRow label="Kode pohon" value={formatTreeDisplayCode(tree)} />
          <MetaRow label="Lokasi" value={formatTreeLocation(tree)} />
          <MetaRow label="Varietas" value={tree.variety ?? 'Belum diisi'} />
        </Card>
      ) : null}

      {normalizedType === 'condition' ? (
        <FormSection title="Status kondisi">
          <DateField label="Tanggal catatan *" onChangeDate={setEventDate} value={eventDate} />
          <OptionList
            options={conditionOptions}
            selected={conditionStatus}
            formatLabel={formatTreeConditionStatus}
            onSelect={(value) => setConditionStatus(value)}
          />
          <TextArea label="Catatan" onChangeText={setNote} value={note} />
        </FormSection>
      ) : null}

      {normalizedType === 'phase' ? (
        <FormSection title="Fase pertumbuhan">
          <DateField label="Tanggal catatan *" onChangeDate={setEventDate} value={eventDate} />
          <OptionList
            options={phaseOptions}
            selected={phase}
            formatLabel={formatGrowthPhase}
            onSelect={(value) => setPhase(value)}
          />
          <TextArea label="Catatan" onChangeText={setNote} value={note} />
        </FormSection>
      ) : null}

      {normalizedType === 'harvest' ? (
        <FormSection title="Hasil panen">
          <DateField label="Tanggal panen *" onChangeDate={setEventDate} value={eventDate} />
          <InputField
            keyboardType="number-pad"
            label="Jumlah buah *"
            onChangeText={(value) => setFruitCount(value.replace(/[^0-9]/g, ''))}
            value={fruitCount}
          />
          <InputField label="Kondisi buah" onChangeText={setFruitCondition} value={fruitCondition} />
          <TextArea label="Catatan" onChangeText={setNote} value={note} />
        </FormSection>
      ) : null}

      {normalizedType === 'manual-care' ? (
        <FormSection title="Catatan perawatan">
          <DateField label="Tanggal perawatan *" onChangeDate={setEventDate} value={eventDate} />
          <Text selectable style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>
            Jenis perawatan *
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {careCategoryOptions.map((option) => (
              <OptionChip
                key={option}
                active={category === option}
                label={formatCareCategory(option)}
                onPress={() => setCategory(option)}
              />
            ))}
          </View>
          <ManualCareTargetFields
            customTargetNote={customTargetNote}
            targetColumn={targetColumn}
            targetRow={targetRow}
            targetType={targetType}
            onCustomTargetNoteChange={setCustomTargetNote}
            onTargetColumnChange={setTargetColumn}
            onTargetRowChange={setTargetRow}
            onTargetTypeChange={setTargetType}
          />
          <TextArea label="Catatan" onChangeText={setNote} value={note} />
        </FormSection>
      ) : null}

      <Card variant="info">
        <Text selectable style={{ color: colors.textMuted, lineHeight: 21 }}>
          Foto yang sudah tersimpan tetap dipertahankan. Penggantian foto catatan tidak termasuk dalam batch ini.
        </Text>
      </Card>
    </Screen>
  );

  function normalizeManualCareTarget():
    | {
        customTargetNote: string | null;
        targetColumn: string | null;
        targetRow: string | null;
        targetTreeId: string | null;
      }
    | Error {
    if (targetType === 'farm') {
      return { customTargetNote: null, targetColumn: null, targetRow: null, targetTreeId: null };
    }

    if (targetType === 'row') {
      const value = targetRow.trim();
      return value ? { customTargetNote: null, targetColumn: null, targetRow: value, targetTreeId: null } : new Error('Baris target wajib diisi.');
    }

    if (targetType === 'column') {
      const value = targetColumn.trim();
      return value ? { customTargetNote: null, targetColumn: value, targetRow: null, targetTreeId: null } : new Error('Kolom target wajib diisi.');
    }

    if (targetType === 'custom') {
      const value = customTargetNote.trim();
      return value ? { customTargetNote: value, targetColumn: null, targetRow: null, targetTreeId: null } : new Error('Catatan target khusus wajib diisi.');
    }

    return {
      customTargetNote: null,
      targetColumn: null,
      targetRow: null,
      targetTreeId: targetTreeId ?? treeId ?? null,
    };
  }
}

function normalizeRecordType(value?: string): TreeRecordRouteType | null {
  if (value === 'condition' || value === 'phase' || value === 'harvest' || value === 'manual-care') {
    return value;
  }

  return null;
}

function getEditTitle(recordType: TreeRecordRouteType): string {
  if (recordType === 'condition') {
    return 'Edit catatan kondisi';
  }

  if (recordType === 'phase') {
    return 'Edit catatan fase';
  }

  if (recordType === 'harvest') {
    return 'Edit catatan panen';
  }

  return 'Edit catatan perawatan';
}

function toDateInput(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10);
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function OptionList<T extends string>({
  formatLabel,
  onSelect,
  options,
  selected,
}: {
  formatLabel: (value: T) => string;
  onSelect: (value: T) => void;
  options: T[];
  selected: T | '';
}) {
  return (
    <View style={{ gap: spacing.sm }}>
      {options.map((option) => (
        <OptionChip
          key={option}
          active={selected === option}
          label={formatLabel(option)}
          onPress={() => onSelect(option)}
        />
      ))}
    </View>
  );
}

function OptionChip({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: active ? colors.primary : colors.surface,
        borderColor: active ? colors.primary : colors.border,
        borderCurve: 'continuous',
        borderRadius: radius.md,
        borderWidth: 1,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
      }}
    >
      <Text selectable style={{ color: active ? colors.white : colors.text, fontSize: 14, fontWeight: '800' }}>
        {label}
      </Text>
    </Pressable>
  );
}

function ManualCareTargetFields({
  customTargetNote,
  onCustomTargetNoteChange,
  onTargetColumnChange,
  onTargetRowChange,
  onTargetTypeChange,
  targetColumn,
  targetRow,
  targetType,
}: {
  customTargetNote: string;
  onCustomTargetNoteChange: (value: string) => void;
  onTargetColumnChange: (value: string) => void;
  onTargetRowChange: (value: string) => void;
  onTargetTypeChange: (value: TargetType) => void;
  targetColumn: string;
  targetRow: string;
  targetType: TargetType;
}) {
  const options: TargetType[] = ['tree', 'farm', 'row', 'column', 'custom'];

  return (
    <View style={{ gap: spacing.sm }}>
      <Text selectable style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>
        Target perawatan *
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {options.map((option) => (
          <OptionChip
            key={option}
            active={targetType === option}
            label={formatTargetLabel(option)}
            onPress={() => onTargetTypeChange(option)}
          />
        ))}
      </View>
      {targetType === 'tree' ? (
        <Text selectable style={{ color: colors.textMuted, lineHeight: 20 }}>
          Target tetap pohon dari timeline ini.
        </Text>
      ) : null}
      {targetType === 'row' ? <InputField label="Baris target *" onChangeText={onTargetRowChange} value={targetRow} /> : null}
      {targetType === 'column' ? <InputField label="Kolom target *" onChangeText={onTargetColumnChange} value={targetColumn} /> : null}
      {targetType === 'custom' ? <InputField label="Catatan target khusus *" onChangeText={onCustomTargetNoteChange} value={customTargetNote} /> : null}
    </View>
  );
}

function formatTargetLabel(targetType: TargetType): string {
  if (targetType === 'tree') {
    return 'Pohon ini';
  }

  if (targetType === 'farm') {
    return 'Seluruh kebun';
  }

  if (targetType === 'row') {
    return 'Baris';
  }

  if (targetType === 'column') {
    return 'Kolom';
  }

  return 'Khusus';
}

function InputField({
  keyboardType,
  label,
  onChangeText,
  value,
}: {
  keyboardType?: 'default' | 'number-pad';
  label: string;
  onChangeText: (value: string) => void;
  value: string;
}) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Text selectable style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>
        {label}
      </Text>
      <TextInput
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholder="Opsional"
        placeholderTextColor={colors.textSoft}
        style={{
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderCurve: 'continuous',
          borderRadius: radius.md,
          borderWidth: 1,
          color: colors.text,
          fontSize: 16,
          minHeight: 54,
          paddingHorizontal: spacing.lg,
        }}
        value={value}
      />
    </View>
  );
}

function TextArea({
  label,
  onChangeText,
  value,
}: {
  label: string;
  onChangeText: (value: string) => void;
  value: string;
}) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Text selectable style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>
        {label}
      </Text>
      <TextInput
        multiline
        onChangeText={onChangeText}
        placeholder="Opsional"
        placeholderTextColor={colors.textSoft}
        style={{
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderCurve: 'continuous',
          borderRadius: radius.md,
          borderWidth: 1,
          color: colors.text,
          fontSize: 16,
          minHeight: 96,
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          textAlignVertical: 'top',
        }}
        value={value}
      />
    </View>
  );
}
