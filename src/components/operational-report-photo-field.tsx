import React from 'react';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';

import { colors, radius, spacing } from '../constants/theme';
import { pickImageFromGallery, takePhotoFromCamera } from '../lib/media';
import type { PhotoAttachmentPreviewItem, PickedPhotoAsset } from '../types/media';
import type { UUID } from '../types/domain';
import { PhotoSourceSheet } from './bottom-sheet';
import { Icon } from './icons';
import { PhotoAttachmentPreviewList } from './media';
import { Card, SectionHeader } from './ui';

// Pola disalin dari ProofPhotoField (worker/tasks/[taskId]/record.tsx), BUKAN
// diekstrak jadi komponen bersama: di sana satu slot foto tunggal dengan aturan
// wajib/rollback, di sini sampai tiga foto opsional. Menggeneralisasi keduanya
// akan mengubah alur bukti foto tugas, yang tidak boleh tersentuh.

export const MAX_OPERATIONAL_REPORT_PHOTOS = 3;

export type ReportPhotoItem =
  // Sudah terunggah (mode edit): punya id dan signed URL.
  | { kind: 'existing'; photoId: UUID; url: string }
  // Baru dipilih, belum terunggah (mode buat): tinggal di memori sampai
  // laporannya dibuat, karena RLS mensyaratkan laporan sudah ada.
  | { kind: 'pending'; asset: PickedPhotoAsset };

export function getReportPhotoKey(item: ReportPhotoItem): string {
  return item.kind === 'existing' ? item.photoId : item.asset.uri;
}

// Tampilan foto laporan di layar DETAIL (owner maupun pekerja): read-only,
// tanpa onDeletePhoto. Menambah/menghapus hanya lewat form edit — dan RLS pun
// hanya mengizinkannya selama laporan belum direspons.
// Tanpa foto, kartunya tidak dirender sama sekali, bukan empty state.
export function ReportPhotoCard({ photos }: { photos: PhotoAttachmentPreviewItem[] }) {
  if (photos.length === 0) {
    return null;
  }

  return (
    <Card>
      <SectionHeader title="Foto laporan" />
      <PhotoAttachmentPreviewList photos={photos} />
    </Card>
  );
}

export function OperationalReportPhotoField({
  busy = false,
  error,
  onAdd,
  onRemove,
  photos,
}: {
  busy?: boolean;
  error?: string | null;
  onAdd: (asset: PickedPhotoAsset) => void;
  onRemove: (item: ReportPhotoItem) => void;
  photos: ReportPhotoItem[];
}) {
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [pickError, setPickError] = React.useState<string | null>(null);
  const [failedKeys, setFailedKeys] = React.useState<string[]>([]);

  const isFull = photos.length >= MAX_OPERATIONAL_REPORT_PHOTOS;

  async function handlePick(source: 'camera' | 'gallery') {
    setSheetOpen(false);
    setPickError(null);

    const result = source === 'camera' ? await takePhotoFromCamera() : await pickImageFromGallery();

    if (result.error) {
      setPickError(result.error.message);
      return;
    }

    // null = pengguna membatalkan; bukan error.
    if (result.data) {
      onAdd(result.data);
    }
  }

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.sm }}>
        <Text selectable style={{ color: colors.text, flex: 1, fontSize: 14, fontWeight: '600' }}>
          Foto · opsional
        </Text>
        <Text selectable style={{ color: colors.textMuted, fontSize: 13 }}>
          {`${photos.length}/${MAX_OPERATIONAL_REPORT_PHOTOS}`}
        </Text>
      </View>

      <PhotoSourceSheet
        cameraLabel="Ambil foto"
        galleryLabel="Pilih galeri"
        hasPhoto={false}
        subtitle="Pilih sumber foto."
        title="Tambah foto laporan"
        visible={sheetOpen}
        onCameraPress={() => handlePick('camera')}
        onClose={() => setSheetOpen(false)}
        onDeletePhoto={() => setSheetOpen(false)}
        onGalleryPress={() => handlePick('gallery')}
      />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {photos.map((item) => {
          const key = getReportPhotoKey(item);
          const uri = item.kind === 'existing' ? item.url : item.asset.uri;
          const hasFailed = failedKeys.includes(key);

          return (
            <View
              key={key}
              style={{
                borderCurve: 'continuous',
                borderRadius: radius.md,
                height: 96,
                overflow: 'hidden',
                width: 96,
              }}
            >
              {hasFailed ? (
                <View
                  style={{
                    alignItems: 'center',
                    backgroundColor: colors.photoPlaceholder,
                    borderColor: colors.border,
                    borderRadius: radius.md,
                    borderWidth: 1,
                    flex: 1,
                    justifyContent: 'center',
                    padding: spacing.sm,
                  }}
                >
                  <Text
                    selectable={false}
                    style={{ color: colors.textMuted, fontSize: 11, textAlign: 'center' }}
                  >
                    Gagal dimuat
                  </Text>
                </View>
              ) : (
                <Image
                  resizeMode="cover"
                  source={{ uri }}
                  onError={() =>
                    setFailedKeys((current) =>
                      current.includes(key) ? current : [...current, key]
                    )
                  }
                  style={{ height: '100%', width: '100%' }}
                />
              )}

              <Pressable
                accessibilityLabel="Hapus foto"
                accessibilityRole="button"
                disabled={busy}
                onPress={() => onRemove(item)}
                style={{
                  alignItems: 'center',
                  backgroundColor: colors.danger,
                  borderColor: colors.surface,
                  borderRadius: radius.round,
                  borderWidth: 1,
                  height: 26,
                  justifyContent: 'center',
                  opacity: busy ? 0.5 : 1,
                  position: 'absolute',
                  right: 4,
                  top: 4,
                  width: 26,
                }}
              >
                <Icon name="x" size={14} color={colors.surface} />
              </Pressable>
            </View>
          );
        })}

        {isFull ? null : (
          <Pressable
            accessibilityLabel="Tambah foto"
            accessibilityRole="button"
            disabled={busy}
            onPress={() => setSheetOpen(true)}
            style={{
              alignItems: 'center',
              backgroundColor: colors.photoPlaceholder,
              borderColor: colors.border,
              borderCurve: 'continuous',
              borderRadius: radius.md,
              borderStyle: 'dashed',
              borderWidth: 1,
              gap: spacing.xs,
              height: 96,
              justifyContent: 'center',
              opacity: busy ? 0.6 : 1,
              width: 96,
            }}
          >
            {busy ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <>
                <Icon name="camera" size={22} color={colors.primary} />
                <Text selectable={false} style={{ color: colors.text, fontSize: 12, fontWeight: '600' }}>
                  Tambah
                </Text>
              </>
            )}
          </Pressable>
        )}
      </View>

      {pickError || error ? (
        <Text selectable style={{ color: colors.danger, fontSize: 11, lineHeight: 16 }}>
          {pickError ?? error}
        </Text>
      ) : null}
    </View>
  );
}
