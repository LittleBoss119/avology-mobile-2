import React from 'react';
import { Image, Modal, Pressable, Text, View } from 'react-native';

import type { PickedPhotoAsset, TaskProofPhoto } from '../types/media';
import { appTheme, Button } from './ui';

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
        backgroundColor: '#FFFFFF',
        borderColor: required ? '#D7A33D' : '#DCE7D5',
        borderRadius: 12,
        borderWidth: 1,
        gap: 12,
        padding: 14,
      }}
    >
      <View style={{ gap: 5 }}>
        <Text selectable style={{ color: '#1E2A24', fontSize: 16, fontWeight: '800' }}>
          Bukti Foto
        </Text>
        <Text selectable style={{ color: '#68746D', lineHeight: 20 }}>
          {required
            ? 'Tugas ini membutuhkan bukti foto sebelum diselesaikan.'
            : 'Opsional, untuk menambahkan bukti realisasi tugas.'}
        </Text>
      </View>

      {photo ? (
        <View style={{ gap: 10 }}>
          <Image
            resizeMode="cover"
            source={{ uri: photo.uri }}
            style={{
              borderRadius: 12,
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
      <Text selectable style={{ color: '#68746D', lineHeight: 20 }}>
        {emptyText}
      </Text>
    );
  }

  if (imageFailed) {
    return (
      <View
        style={{
          alignItems: 'center',
          backgroundColor: appTheme.primarySoft,
          borderColor: '#D7E5D3',
          borderRadius: 12,
          borderWidth: 1,
          minHeight: 96,
          justifyContent: 'center',
          padding: 12,
        }}
      >
        <Text selectable style={{ color: '#68746D', lineHeight: 20, textAlign: 'center' }}>
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
            borderRadius: 12,
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
                borderRadius: 12,
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
