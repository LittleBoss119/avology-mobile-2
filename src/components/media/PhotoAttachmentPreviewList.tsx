import React from 'react';
import { ActivityIndicator, Image, Modal, Pressable, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '../../constants/theme';
import type { PhotoAttachmentPreviewItem } from '../../types/media';

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
              <Pressable accessibilityRole="imagebutton" onPress={() => setPreviewUrl(photo.url)}>
                <Image
                  resizeMode="cover"
                  source={{ uri: photo.url }}
                  style={{ borderRadius: radius.md, height: 156, width: '100%' }}
                />
              </Pressable>
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
                  <Text selectable={false} style={{ color: colors.surface, fontSize: 17, fontWeight: '900', lineHeight: 19 }}>
                    x
                  </Text>
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

      <Modal
        animationType="fade"
        onRequestClose={() => setPreviewUrl(null)}
        transparent
        visible={Boolean(previewUrl)}
      >
        <View style={{ backgroundColor: 'rgba(18, 28, 22, 0.78)', flex: 1, justifyContent: 'center', padding: 20 }}>
          <Pressable accessibilityRole="button" onPress={() => setPreviewUrl(null)} style={{ flex: 1, justifyContent: 'center' }}>
            {previewUrl ? (
              <Image
                resizeMode="contain"
                source={{ uri: previewUrl }}
                style={{ borderRadius: radius.lg, height: '82%', width: '100%' }}
              />
            ) : null}
          </Pressable>
        </View>
      </Modal>
    </>
  );
}
