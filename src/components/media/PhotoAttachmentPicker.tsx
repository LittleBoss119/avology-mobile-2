import React from 'react';
import { ActivityIndicator, Image, Text, View } from 'react-native';

import { pickImageFromGallery, takePhotoFromCamera } from '../../lib/media';
import type { PickedPhotoAsset } from '../../types/media';
import { colors, radius, spacing, typography } from '../../constants/theme';
import { Badge, Button, ErrorBanner } from '../ui';

export type PhotoAttachmentPickerProps = {
  allowCamera?: boolean;
  allowGallery?: boolean;
  choosePhotoLabel?: string;
  disabled?: boolean;
  error?: string | null;
  existingPhotoUrl?: string | null;
  helperText?: string;
  label?: string;
  loading?: boolean;
  onError?: (message: string) => void;
  onRemove?: () => void;
  onSelect: (asset: PickedPhotoAsset) => void;
  removeLabel?: string;
  required?: boolean;
  selectedPhoto?: PickedPhotoAsset | null;
  selectedUri?: string | null;
  takePhotoLabel?: string;
};

export function PhotoAttachmentPicker({
  allowCamera = true,
  allowGallery = true,
  choosePhotoLabel = 'Pilih Galeri',
  disabled = false,
  error,
  existingPhotoUrl,
  helperText,
  label = 'Foto',
  loading = false,
  onError,
  onRemove,
  onSelect,
  removeLabel = 'Hapus Foto',
  required = false,
  selectedPhoto,
  selectedUri,
  takePhotoLabel = 'Ambil Foto',
}: PhotoAttachmentPickerProps) {
  const [localError, setLocalError] = React.useState<string | null>(null);
  const busy = disabled || loading;
  const imageUri = selectedUri ?? selectedPhoto?.uri ?? existingPhotoUrl ?? null;
  const visibleError = error ?? localError;

  async function runPick(source: 'camera' | 'gallery') {
    setLocalError(null);

    const result = source === 'camera'
      ? await takePhotoFromCamera()
      : await pickImageFromGallery();

    if (result.error) {
      setLocalError(result.error.message);
      onError?.(result.error.message);
      return;
    }

    if (result.data) {
      onSelect(result.data);
    }
  }

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderColor: required ? colors.warningBorder : colors.border,
        borderCurve: 'continuous',
        borderRadius: radius.xl,
        borderWidth: 1,
        gap: spacing.md,
        padding: spacing.lg,
      }}
    >
      <View style={{ gap: spacing.xs }}>
        <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' }}>
          <Text selectable style={{ color: colors.text, flex: 1, fontSize: 16, fontWeight: '800' }}>
            {label}
          </Text>
          {required ? <Badge label="Wajib" tone="warning" /> : null}
        </View>
        {helperText ? (
          <Text selectable style={{ color: colors.textMuted, lineHeight: typography.small.lineHeight }}>
            {helperText}
          </Text>
        ) : null}
      </View>

      <View
        style={{
          alignItems: 'center',
          backgroundColor: colors.photoPlaceholder,
          borderColor: colors.border,
          borderCurve: 'continuous',
          borderRadius: radius.lg,
          borderWidth: 1,
          justifyContent: 'center',
          minHeight: 180,
          overflow: 'hidden',
        }}
      >
        {imageUri ? (
          <Image resizeMode="cover" source={{ uri: imageUri }} style={{ height: 180, width: '100%' }} />
        ) : (
          <View style={{ alignItems: 'center', gap: spacing.sm, padding: spacing.xl }}>
            <View
              style={{
                alignItems: 'center',
                backgroundColor: colors.surface,
                borderColor: colors.primaryBorder,
                borderRadius: radius.round,
                borderWidth: 1,
                height: 52,
                justifyContent: 'center',
                width: 52,
              }}
            >
              <Text selectable style={{ color: colors.primary, fontSize: 24, fontWeight: '900' }}>
                +
              </Text>
            </View>
            <Text selectable style={{ color: colors.textMuted, fontWeight: '700', textAlign: 'center' }}>
              Foto belum dipilih
            </Text>
          </View>
        )}
        {loading ? (
          <View
            style={{
              alignItems: 'center',
              backgroundColor: 'rgba(16,32,22,0.28)',
              bottom: 0,
              justifyContent: 'center',
              left: 0,
              position: 'absolute',
              right: 0,
              top: 0,
            }}
          >
            <ActivityIndicator color={colors.surface} />
          </View>
        ) : null}
      </View>

      <ErrorBanner message={visibleError} />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
        {allowCamera ? (
          <View style={{ flexBasis: 132, flexGrow: 1 }}>
            <Button disabled={busy} title={takePhotoLabel} variant="secondary" onPress={() => runPick('camera')} />
          </View>
        ) : null}
        {allowGallery ? (
          <View style={{ flexBasis: 132, flexGrow: 1 }}>
            <Button disabled={busy} title={choosePhotoLabel} variant="secondary" onPress={() => runPick('gallery')} />
          </View>
        ) : null}
        {onRemove && imageUri ? (
          <View style={{ flexBasis: 132, flexGrow: 1 }}>
            <Button disabled={busy} title={removeLabel} variant="danger" onPress={onRemove} />
          </View>
        ) : null}
      </View>
    </View>
  );
}
