import React from 'react';
import { ActivityIndicator, Alert, Image, Pressable, Text, View } from 'react-native';

import { pickImageFromGallery, takePhotoFromCamera } from '../../lib/media';
import type { PickedPhotoAsset } from '../../types/media';
import { colors, radius, spacing, typography } from '../../constants/theme';
import { Badge, Button, CameraGlyph, ErrorBanner } from '../ui';

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
  const sourceActions = [
    allowCamera ? { label: takePhotoLabel, source: 'camera' as const } : null,
    allowGallery ? { label: choosePhotoLabel, source: 'gallery' as const } : null,
  ].filter((action): action is { label: string; source: 'camera' | 'gallery' } => Boolean(action));

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

  function handleCardPress() {
    if (busy || sourceActions.length === 0) {
      return;
    }

    if (sourceActions.length === 1) {
      void runPick(sourceActions[0].source);
      return;
    }

    Alert.alert('Tambah foto', 'Pilih sumber foto.', [
      ...sourceActions.map((action) => ({
        text: action.label,
        onPress: () => {
          void runPick(action.source);
        },
      })),
      { style: 'cancel' as const, text: 'Batal' },
    ]);
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

      <Pressable
        accessibilityRole="button"
        disabled={busy || sourceActions.length === 0}
        onPress={handleCardPress}
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
              <CameraGlyph color={colors.primary} />
            </View>
            <Text selectable={false} style={{ color: colors.text, fontWeight: '800', textAlign: 'center' }}>
              Tambah foto
            </Text>
            <Text selectable={false} style={{ color: colors.textMuted, fontSize: 13, textAlign: 'center' }}>
              Ketuk area ini untuk memilih sumber foto.
            </Text>
          </View>
        )}
        {onRemove && imageUri ? (
          <Pressable
            accessibilityLabel={removeLabel}
            accessibilityRole="button"
            disabled={busy}
            onPress={onRemove}
            style={({ pressed }) => ({
              alignItems: 'center',
              backgroundColor: colors.danger,
              borderColor: colors.surface,
              borderRadius: radius.round,
              borderWidth: 1,
              height: 34,
              justifyContent: 'center',
              opacity: pressed ? 0.78 : 1,
              position: 'absolute',
              right: spacing.sm,
              top: spacing.sm,
              width: 34,
            })}
          >
            <Text selectable={false} style={{ color: colors.surface, fontSize: 18, fontWeight: '900', lineHeight: 20 }}>
              x
            </Text>
          </Pressable>
        ) : null}
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
      </Pressable>

      <ErrorBanner message={visibleError} />

      {!imageUri && sourceActions.length > 1 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {allowCamera ? (
          <Button disabled={busy} size="small" title={takePhotoLabel} variant="quiet" onPress={() => runPick('camera')} />
        ) : null}
        {allowGallery ? (
          <Button disabled={busy} size="small" title={choosePhotoLabel} variant="quiet" onPress={() => runPick('gallery')} />
        ) : null}
        </View>
      ) : null}
    </View>
  );
}
