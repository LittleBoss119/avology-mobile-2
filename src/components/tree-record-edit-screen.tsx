import { router } from 'expo-router';
import React from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';

import {
  GRADE_PANEN,
  GRADE_PANEN_LABELS,
  MAX_BERAT_PANEN_KG,
  type GradePanen,
} from '../constants/gradePanen';
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
import { getTreeDetail } from '../services/treeService';
import type {
  GrowthPhase,
  Tree,
  TreeConditionStatus,
  UUID,
} from '../types/domain';
import { MAX_ANGKA_DESIMAL, parseDecimalInput, sanitizeDecimalInput } from '../utils/decimalInput';
import { formatGrowthPhase, formatTreeConditionStatus, formatTreeDisplayCode, formatTreeLocation } from '../utils/treeFormat';
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
  OptionGroup,
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
  const [conditionStatus, setConditionStatus] = React.useState<TreeConditionStatus | ''>('');
  const [eventDate, setEventDate] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [grade, setGrade] = React.useState<GradePanen | null>(null);
  const [beratKg, setBeratKg] = React.useState('');
  const [fruitCount, setFruitCount] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [note, setNote] = React.useState('');
  const [phase, setPhase] = React.useState<GrowthPhase | ''>('');
  const [submitting, setSubmitting] = React.useState(false);
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
      // Dulu `String(result.data.fruitCount)`. Sejak kolomnya nullable, itu
      // menghasilkan teks "null" di dalam field — bukan field kosong.
      setGrade(result.data.fruitCondition);
      setBeratKg(result.data.harvestWeightKg === null ? '' : String(result.data.harvestWeightKg));
      setFruitCount(result.data.fruitCount === null ? '' : String(result.data.fruitCount));
      setNote(result.data.note ?? '');
      return;
    }

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
      // Aturan yang sama persis dengan form catat panen: minimal salah satu
      // dari berat atau jumlah buah, dan batas atas berat dijaga di klien
      // supaya pesannya terbaca.
      const beratTeks = beratKg.trim();
      const jumlahTeks = fruitCount.trim();

      if (!beratTeks && !jumlahTeks) {
        return 'Isi berat panen atau jumlah buah, minimal salah satu.';
      }

      if (beratTeks) {
        const berat = parseDecimalInput(beratTeks);

        if (berat === null) {
          return 'Berat panen harus lebih dari 0.';
        }

        if (berat > MAX_BERAT_PANEN_KG) {
          return 'Berat panen terlalu besar.';
        }
      }

      if (jumlahTeks) {
        const jumlah = Number(jumlahTeks);

        if (!Number.isInteger(jumlah) || jumlah <= 0) {
          return 'Jumlah buah harus lebih dari 0.';
        }
      }

      const result = await updateOwnHarvestRecord({
        fruitCondition: grade,
        fruitCount: jumlahTeks ? Number(jumlahTeks) : null,
        harvestWeightKg: parseDecimalInput(beratKg),
        harvestedAt: eventDate,
        note,
        recordId: id,
      });
      return result.error?.message ?? null;
    }

    return 'Jenis catatan tidak dikenal.';
  }

  if (loading) {
    // Judulnya BUKAN tebakan: normalizedType diturunkan dari parameter rute
    // (recordType), jadi ia sudah diketahui sebelum satu pun permintaan jalan —
    // judul saat memuat persis sama dengan judul setelah selesai memuat.
    // Cadangan 'Edit catatan' hanya untuk tipe rute yang tidak dikenali, dan
    // teksnya sama dengan cabang yang menangani keadaan itu di bawah.
    return (
      <LoadingState
        header={
          <TopAppBar
            title={normalizedType ? getEditTitle(normalizedType) : 'Edit catatan'}
            onBack={() => router.back()}
          />
        }
        message="Memuat catatan..."
      />
    );
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
          <Text selectable style={{ color: colors.text, fontSize: typography.h3.fontSize, fontWeight: '700' }}>
            Konteks Pohon
          </Text>
          <MetaRow label="Kode pohon" value={formatTreeDisplayCode(tree)} />
          <MetaRow label="Lokasi" value={formatTreeLocation(tree)} />
          <MetaRow label="Varietas" value={tree.activePlanting?.variety ?? 'Belum diisi'} />
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
          {/* Berat di atas jumlah buah, sama dengan form catat panen. */}
          <InputField
            keyboardType="decimal-pad"
            label="Berat panen (kg)"
            onChangeText={(value) => setBeratKg(sanitizeDecimalInput(value, MAX_ANGKA_DESIMAL))}
            value={beratKg}
          />
          <InputField
            keyboardType="number-pad"
            label="Jumlah buah"
            onChangeText={(value) => setFruitCount(value.replace(/[^0-9]/g, ''))}
            value={fruitCount}
          />
          {/* Grade memakai OptionGroup yang sama dengan form catat panen supaya
              field ini terlihat identik di kedua layar. Menekan chip yang sudah
              aktif membatalkan pilihan — grade memang opsional. */}
          <OptionGroup
            label="Grade"
            options={GRADE_PANEN.map((option) => ({
              disabled: submitting,
              label: GRADE_PANEN_LABELS[option],
              value: option,
            }))}
            value={grade}
            onChange={(value) => setGrade(grade === value ? null : (value as GradePanen))}
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

}

function normalizeRecordType(value?: string): TreeRecordRouteType | null {
  if (value === 'condition' || value === 'phase' || value === 'harvest') {
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
      <Text selectable style={{ color: active ? colors.white : colors.text, fontSize: 14, fontWeight: '700' }}>
        {label}
      </Text>
    </Pressable>
  );
}

function InputField({
  keyboardType,
  label,
  onChangeText,
  value,
}: {
  // 'decimal-pad' ditambahkan untuk field berat panen: pemisah desimal harus
  // ada di papan tombol, dan 'number-pad' tidak menyediakannya.
  keyboardType?: 'default' | 'decimal-pad' | 'number-pad';
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
