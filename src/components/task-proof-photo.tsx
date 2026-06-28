import React from 'react';
import { Image, Modal, Pressable, Text, View } from 'react-native';

import type { PickedPhotoAsset, TaskProofPhoto } from '../types/media';
import { colors, radius, spacing, typography } from '../constants/theme';
import { Badge, Button } from './ui';

export function TaskProofPhotoPicker({
  disabled,
  onCameraPress,
  onGalleryPress,
  onRemove,
  photo,
  required,
}: {
  disabled: boolean;
  onCameraPress: () => void;
  onGalleryPress: () => void;
  onRemove: () => void;
  photo: PickedPhotoAsset | null;
  required: boolean;
}) {
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
            Bukti Foto
          </Text>
          {required ? <Badge label="Wajib" tone="warning" /> : null}
        </View>
        <Text selectable style={{ color: colors.textMuted, lineHeight: typography.small.lineHeight }}>
          {required
            ? 'Foto wajib diunggah sebelum tugas dapat diselesaikan.'
            : 'Opsional, untuk menambahkan bukti realisasi tugas.'}
        </Text>
      </View>

      {photo ? (
        <View style={{ gap: 10 }}>
          <Image
            resizeMode="cover"
            source={{ uri: photo.uri }}
            style={{
              borderRadius: radius.lg,
              height: 150,
              width: '100%',
            }}
          />
          <Button disabled={disabled} title="Hapus Foto" variant="secondary" onPress={onRemove} />
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Button disabled={disabled} title="Ambil Foto" variant="secondary" onPress={onCameraPress} />
        </View>
        <View style={{ flex: 1 }}>
          <Button disabled={disabled} title="Pilih Galeri" variant="secondary" onPress={onGalleryPress} />
        </View>
      </View>
    </View>
  );
}

export function TaskProofPhotoPreview({
  emptyText,
  photo,
}: {
  emptyText?: string;
  photo?: TaskProofPhoto | null;
}) {
  const [imageFailed, setImageFailed] = React.useState(false);
  const [previewOpen, setPreviewOpen] = React.useState(false);

  React.useEffect(() => {
    setImageFailed(false);
    setPreviewOpen(false);
  }, [photo?.signedUrl]);

  if (!photo) {
    if (!emptyText) {
      return null;
    }

    return (
      <Text selectable style={{ color: colors.textMuted, lineHeight: 20 }}>
        {emptyText}
      </Text>
    );
  }

  if (imageFailed) {
    return (
      <View
        style={{
          alignItems: 'center',
          backgroundColor: colors.primarySoft,
          borderColor: colors.primaryBorder,
          borderRadius: radius.lg,
          borderWidth: 1,
          minHeight: 96,
          justifyContent: 'center',
          padding: spacing.md,
        }}
      >
        <Text selectable style={{ color: colors.textMuted, lineHeight: 20, textAlign: 'center' }}>
          Bukti foto belum dapat dimuat.
        </Text>
      </View>
    );
  }

  return (
    <>
      <Pressable accessibilityRole="imagebutton" onPress={() => setPreviewOpen(true)}>
        <Image
          resizeMode="cover"
          source={{ uri: photo.signedUrl }}
          onError={() => setImageFailed(true)}
          style={{
            borderRadius: radius.lg,
            height: 118,
            width: '100%',
          }}
        />
      </Pressable>

      <Modal
        animationType="fade"
        onRequestClose={() => setPreviewOpen(false)}
        transparent
        visible={previewOpen}
      >
        <View style={{ backgroundColor: 'rgba(18, 28, 22, 0.78)', flex: 1, justifyContent: 'center', padding: 20 }}>
          <Pressable accessibilityRole="button" onPress={() => setPreviewOpen(false)} style={{ flex: 1, justifyContent: 'center' }}>
            <Image
              resizeMode="contain"
              source={{ uri: photo.signedUrl }}
              style={{
                borderRadius: radius.lg,
                height: '82%',
                width: '100%',
              }}
            />
          </Pressable>
        </View>
      </Modal>
    </>
  );
}
