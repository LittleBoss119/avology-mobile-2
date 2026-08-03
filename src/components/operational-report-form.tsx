import React from 'react';
import { Text, TextInput, View } from 'react-native';

import { OPERATIONAL_REPORT_CATEGORIES } from '../constants/operationalReport';
import { colors, radius, spacing } from '../constants/theme';
import type { OperationalReportCategory } from '../types/domain';
import type { PickedPhotoAsset } from '../types/media';
import { formatOperationalReportCategory } from '../utils/displayFormat';
import {
  OperationalReportPhotoField,
  type ReportPhotoItem,
} from './operational-report-photo-field';
import { ChipButton, FormSection } from './ui';

// Form laporan bersama untuk Buat dan Edit. Sebelumnya dua salinan ~85% sama;
// kalau tidak disatukan, setiap penambahan field (mis. foto) harus dikerjakan
// dua kali dan pasti divergen.
//
// Validasi per-field mengikuti gaya ManualScheduleForm (objek error, bukan satu
// string yang berhenti di error pertama) tapi TIDAK memakai komponennya —
// bentuk datanya beda dan ManualScheduleForm menyentuh 6 layar jadwal.

export type OperationalReportFormValues = {
  category: OperationalReportCategory | null;
  description: string;
  locationNote: string;
};

export type OperationalReportFormErrors = {
  category?: string;
  description?: string;
};

export const operationalReportFormFieldOrder = ['category', 'description'] as const;

export const EMPTY_OPERATIONAL_REPORT_FORM: OperationalReportFormValues = {
  category: null,
  description: '',
  locationNote: '',
};

export function validateOperationalReportForm(
  values: OperationalReportFormValues
): OperationalReportFormErrors {
  const errors: OperationalReportFormErrors = {};

  if (!values.category) {
    errors.category = 'Pilih kategori laporan.';
  }

  // Deskripsi WAJIB, lokasi opsional. Aturan lama "salah satu dari keduanya"
  // sudah tidak berlaku sejak tahap 3.
  if (!values.description.trim()) {
    errors.description = 'Deskripsi wajib diisi.';
  }

  return errors;
}

export function hasOperationalReportFormErrors(errors: OperationalReportFormErrors): boolean {
  return Boolean(errors.category || errors.description);
}

// Hapus error field yang sudah terisi. Tidak pernah menambah error baru supaya
// pesan tidak muncul sambil mengetik.
export function clearResolvedOperationalReportFormErrors(
  errors: OperationalReportFormErrors,
  values: OperationalReportFormValues
): OperationalReportFormErrors {
  if (!hasOperationalReportFormErrors(errors)) {
    return errors;
  }

  return {
    category: values.category ? undefined : errors.category,
    description: values.description.trim() ? undefined : errors.description,
  };
}

export function OperationalReportForm({
  errors,
  onAddPhoto,
  onChange,
  onRemovePhoto,
  photoBusy,
  photoError,
  photos,
  values,
}: {
  errors?: OperationalReportFormErrors;
  // Bagian foto hanya dirender kalau pemanggil menyediakan handler-nya.
  // Buat dan Edit menanganinya dengan cara berbeda: Buat menahan foto di
  // memori sampai laporannya ada (RLS), Edit langsung unggah/hapus.
  onAddPhoto?: (asset: PickedPhotoAsset) => void;
  onChange: (values: OperationalReportFormValues) => void;
  onRemovePhoto?: (item: ReportPhotoItem) => void;
  photoBusy?: boolean;
  photoError?: string | null;
  photos?: ReportPhotoItem[];
  values: OperationalReportFormValues;
}) {
  return (
    <>
      <FormSection title="Kategori" description="Pilih satu kategori yang paling mendekati.">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {OPERATIONAL_REPORT_CATEGORIES.map((option) => (
            <ChipButton
              key={option}
              active={values.category === option}
              label={formatOperationalReportCategory(option)}
              onPress={() => onChange({ ...values, category: option })}
            />
          ))}
        </View>
        <FieldError message={errors?.category} />
      </FormSection>

      <FormSection
        title="Isi Laporan"
        description="Jelaskan kondisi lapangan yang perlu diketahui pemilik."
      >
        <FormTextArea
          error={errors?.description}
          label="Deskripsi *"
          onChangeText={(description) => onChange({ ...values, description })}
          placeholder="Contoh: Selang penyemprot pecah di dekat pompa"
          value={values.description}
        />

        <FormTextField
          label="Lokasi · opsional"
          onChangeText={(locationNote) => onChange({ ...values, locationNote })}
          placeholder="Contoh: Gudang alat atau Baris A"
          value={values.locationNote}
        />

        {onAddPhoto && onRemovePhoto ? (
          <OperationalReportPhotoField
            busy={photoBusy}
            error={photoError}
            photos={photos ?? []}
            onAdd={onAddPhoto}
            onRemove={onRemovePhoto}
          />
        ) : null}
      </FormSection>
    </>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return (
    <Text selectable style={{ color: colors.danger, fontSize: 11, lineHeight: 16 }}>
      {message}
    </Text>
  );
}

function FormTextField({
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
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
        }}
        value={value}
      />
    </View>
  );
}

function FormTextArea({
  error,
  label,
  onChangeText,
  placeholder,
  value,
}: {
  error?: string;
  label: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  const hasError = Boolean(error);

  return (
    <View style={{ gap: 7 }}>
      <Text
        selectable
        style={{ color: hasError ? colors.danger : colors.text, fontSize: 14, fontWeight: '600' }}
      >
        {label}
      </Text>
      <TextInput
        multiline
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSoft}
        style={{
          backgroundColor: colors.surface,
          borderColor: hasError ? colors.danger : colors.border,
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
      <FieldError message={error} />
    </View>
  );
}
