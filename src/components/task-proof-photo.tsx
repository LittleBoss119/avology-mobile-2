import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';

import type { PickedPhotoAsset, TaskProofPhoto } from '../types/media';
import { colors, radius, spacing } from '../constants/theme';
import { PhotoViewerModal } from './media';
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
      description={required ? 'Wajib untuk menyelesaikan tugas.' : 'Opsional untuk bukti kerja.'}
      emptyLabel="Tambah foto"
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
  borderRadius = radius.lg,
  emptyText,
  photo,
}: {
  borderRadius?: number;
  emptyText?: string;
  photo?: TaskProofPhoto | null;
}) {
  const [imageFailed, setImageFailed] = React.useState(false);
  const [previewOpen, setPreviewOpen] = React.useState(false);

  React.useEffect(() => {
    setImageFailed(false);
    setPreviewOpen(false);
  }, [photo?.signedUrl]);

  // TIDAK ADA early-return di sini, dan itu disengaja.
  //
  // Baik hilangnya foto maupun gagalnya foto dimuat hanya mengganti THUMBNAIL-
  // nya, tidak menghentikan render. Dulu keduanya early-return sehingga viewer
  // ikut ter-unmount: viewer yang sedang terbuka lenyap begitu saja di tengah
  // gerakan pengguna, bukan menutup dengan semestinya. Sejak ada cubit-zoom
  // orang memandangi satu foto jauh lebih lama daripada umur signed URL yang
  // cuma 10 menit, jadi viewer harus tetap berdiri sampai pengguna sendiri yang
  // menutupnya.
  return (
    <>
      {!photo ? (
        emptyText ? (
          <Text selectable style={{ color: colors.textMuted, lineHeight: 20 }}>
            {emptyText}
          </Text>
        ) : null
      ) : imageFailed ? (
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
      ) : (
        <Pressable accessibilityRole="imagebutton" onPress={() => setPreviewOpen(true)}>
          <Image
            resizeMode="cover"
            source={{ uri: photo.signedUrl }}
            onError={() => setImageFailed(true)}
            style={{
              borderRadius,
              height: 118,
              width: '100%',
            }}
          />
        </Pressable>
      )}

      {/*
        `visible` ikut menimbang ada-tidaknya foto, bukan hanya previewOpen.
        Efek di atas memang sudah menutup viewer saat foto hilang, tapi efek
        berjalan SESUDAH render -- tanpa penjaga ini ada satu bingkai di mana
        viewer masih terbuka dengan kotak kosong sebelum efeknya sempat jalan.
      */}
      <PhotoViewerModal
        onClose={() => setPreviewOpen(false)}
        photoUrl={photo?.signedUrl ?? null}
        visible={previewOpen && Boolean(photo)}
      />
    </>
  );
}
