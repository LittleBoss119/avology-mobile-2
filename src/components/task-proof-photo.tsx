import React from 'react';
import { Image, Modal, Pressable, Text, View } from 'react-native';

import type { PickedPhotoAsset, TaskProofPhoto } from '../types/media';
import { colors, radius, spacing } from '../constants/theme';
import { PhotoPickerCard } from './ui';

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
    <PhotoPickerCard
      choosePhotoLabel="Galeri"
      description={required ? 'Wajib untuk menyelesaikan tugas.' : 'Opsional untuk bukti realisasi.'}
      emptyLabel="Tambah bukti foto"
      imageUri={photo?.uri}
      loading={disabled}
      removeLabel="Hapus bukti foto"
      required={required}
      takePhotoLabel="Kamera"
      onChoosePhoto={onGalleryPress}
      onRemovePhoto={photo ? onRemove : undefined}
      onTakePhoto={onCameraPress}
    />
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
