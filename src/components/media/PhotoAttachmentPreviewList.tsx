import React from 'react';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '../../constants/theme';
import type { PhotoAttachmentPreviewItem } from '../../types/media';
import { Icon } from '../icons';
import { PhotoViewerModal } from './PhotoViewerModal';

export type PhotoAttachmentPreviewListProps = {
  disabled?: boolean;
  emptyText?: string;
  loading?: boolean;
  onDeletePhoto?: (photo: PhotoAttachmentPreviewItem) => void;
  photos: PhotoAttachmentPreviewItem[];
};

export function PhotoAttachmentPreviewList({
  disabled = false,
  emptyText,
  loading = false,
  onDeletePhoto,
  photos,
}: PhotoAttachmentPreviewListProps) {
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  // Signed URL foto hanya berumur 10 menit. Layar yang dibuka lama akan
  // menampilkan gambar rusak, jadi kegagalan muat ditangkap per foto dan
  // diganti placeholder — bukan ikon gambar pecah bawaan platform.
  const [failedUrls, setFailedUrls] = React.useState<string[]>([]);

  React.useEffect(() => {
    setFailedUrls([]);
  }, [photos]);

  function markFailed(url: string) {
    setFailedUrls((current) => (current.includes(url) ? current : [...current, url]));
  }

  if (loading) {
    return (
      <View style={{ alignItems: 'center', gap: spacing.sm, padding: spacing.lg }}>
        <ActivityIndicator color={colors.primary} />
        <Text selectable style={{ color: colors.textMuted, lineHeight: typography.small.lineHeight }}>
          Memuat foto...
        </Text>
      </View>
    );
  }

  if (photos.length === 0) {
    if (!emptyText) {
      return null;
    }

    return (
      <Text selectable style={{ color: colors.textMuted, lineHeight: typography.small.lineHeight }}>
        {emptyText}
      </Text>
    );
  }

  return (
    <>
      <View style={{ gap: spacing.md }}>
        {photos.map((photo, index) => (
          <View
            key={photo.id ?? `${photo.url}-${index}`}
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderCurve: 'continuous',
              borderRadius: radius.lg,
              borderWidth: 1,
              gap: spacing.md,
              overflow: 'hidden',
              padding: spacing.md,
            }}
          >
            <View>
              {failedUrls.includes(photo.url) ? (
                <View
                  style={{
                    alignItems: 'center',
                    backgroundColor: colors.photoPlaceholder,
                    borderColor: colors.border,
                    borderRadius: radius.md,
                    borderWidth: 1,
                    height: 156,
                    justifyContent: 'center',
                    padding: spacing.md,
                    width: '100%',
                  }}
                >
                  <Text
                    selectable
                    style={{
                      color: colors.textMuted,
                      lineHeight: typography.small.lineHeight,
                      textAlign: 'center',
                    }}
                  >
                    Foto belum dapat dimuat.
                  </Text>
                </View>
              ) : (
                <Pressable accessibilityRole="imagebutton" onPress={() => setPreviewUrl(photo.url)}>
                  <Image
                    resizeMode="cover"
                    source={{ uri: photo.url }}
                    onError={() => markFailed(photo.url)}
                    style={{ borderRadius: radius.md, height: 156, width: '100%' }}
                  />
                </Pressable>
              )}
              {onDeletePhoto ? (
                <Pressable
                  accessibilityLabel="Hapus Foto"
                  accessibilityRole="button"
                  disabled={disabled}
                  onPress={() => onDeletePhoto(photo)}
                  style={({ pressed }) => ({
                    alignItems: 'center',
                    backgroundColor: colors.danger,
                    borderColor: colors.surface,
                    borderRadius: radius.round,
                    borderWidth: 1,
                    height: 32,
                    justifyContent: 'center',
                    opacity: disabled ? 0.5 : pressed ? 0.78 : 1,
                    position: 'absolute',
                    right: spacing.sm,
                    top: spacing.sm,
                    width: 32,
                  })}
                >
                  <Icon name="x" size={16} color={colors.surface} />
                </Pressable>
              ) : null}
            </View>
            {photo.caption ? (
              <Text selectable style={{ color: colors.textMuted, lineHeight: typography.small.lineHeight }}>
                {photo.caption}
              </Text>
            ) : null}
          </View>
        ))}
      </View>

      <PhotoViewerModal
        onClose={() => setPreviewUrl(null)}
        photoUrl={previewUrl}
        visible={Boolean(previewUrl)}
      />
    </>
  );
}
