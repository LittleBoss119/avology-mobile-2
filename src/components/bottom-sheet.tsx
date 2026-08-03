import React from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tokens } from '../constants/theme';
import { Icon, type IconName } from './icons';

export type SheetIconTone = 'condition' | 'phase' | 'harvest' | 'care' | 'brand' | 'neutral';

// Wadah bottom sheet bersama: hanya tahu chrome (backdrop, grabber, judul,
// safe-area, scroll), tak tahu isinya. Pakai RN Modal (tanpa dependency).
export function BottomSheet({
  children,
  onClose,
  subtitle,
  title,
  visible,
}: {
  children: React.ReactNode;
  onClose: () => void;
  subtitle?: string;
  title: string;
  visible: boolean;
}) {
  const insets = useSafeAreaInsets();
  // paddingBottom bergantung safe-area (runtime), jadi dihitung di sini lalu
  // digabung dengan style statis; tanpa safe-area hasilnya 20 + 12 = 32.
  const sheetStyle = [
    styles.sheet,
    { paddingBottom: tokens.space.xl + Math.max(insets.bottom, tokens.space.md) },
  ];

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View style={styles.root}>
        <Pressable
          accessibilityLabel="Tutup"
          accessibilityRole="button"
          onPress={onClose}
          style={styles.backdrop}
        />
        <View style={sheetStyle}>
          <View style={styles.grabber} />
          <View style={styles.header}>
            <Text selectable style={styles.title}>
              {title}
            </Text>
            {subtitle ? (
              <Text selectable style={styles.subtitle}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// Satu baris aksi di dalam sheet: mengikuti RecordActivityRow (acuan) +
// prop `description` opsional untuk sheet "Tambah jadwal".
export function SheetActionRow({
  description,
  icon,
  iconTone,
  onPress,
  title,
}: {
  description?: string;
  icon: IconName;
  iconTone: SheetIconTone;
  onPress: () => void;
  title: string;
}) {
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <View style={[styles.iconCircle, toneCircle[iconTone]]}>
        <Icon name={icon} size={tokens.icon.md} color={toneIconColor[iconTone]} />
      </View>
      <View style={styles.rowMain}>
        <Text selectable style={styles.rowTitle}>
          {title}
        </Text>
        {description ? (
          <Text selectable style={styles.rowDescription}>
            {description}
          </Text>
        ) : null}
      </View>
      <Icon name="chevron-right" size={tokens.icon.md} color={tokens.color.text.tertiary} />
    </Pressable>
  );
}

// Sheet sumber foto bersama: kamera / galeri, plus Hapus opsional saat sudah
// ada foto. Label & judul bisa dioverride agar cocok di beberapa konteks (foto
// pohon di detail, bukti tugas, foto kondisi); default menjaga tampilan lama.
export function PhotoSourceSheet({
  cameraLabel = 'Ambil Foto',
  deleteLabel = 'Hapus Foto',
  galleryLabel = 'Pilih Galeri',
  hasPhoto,
  onCameraPress,
  onClose,
  onDeletePhoto,
  onGalleryPress,
  subtitle = 'Pilih sumber foto.',
  title,
  visible,
}: {
  cameraLabel?: string;
  deleteLabel?: string;
  galleryLabel?: string;
  hasPhoto: boolean;
  onCameraPress: () => void;
  onClose: () => void;
  onDeletePhoto: () => void;
  onGalleryPress: () => void;
  subtitle?: string;
  title?: string;
  visible: boolean;
}) {
  return (
    <BottomSheet
      onClose={onClose}
      subtitle={subtitle}
      title={title ?? (hasPhoto ? 'Foto pohon' : 'Tambah foto')}
      visible={visible}
    >
      <View style={{ gap: tokens.space.sm }}>
        <SheetActionRow icon="camera" iconTone="brand" title={cameraLabel} onPress={onCameraPress} />
        <SheetActionRow icon="file-text" iconTone="neutral" title={galleryLabel} onPress={onGalleryPress} />
        {hasPhoto ? (
          <SheetActionRow icon="x" iconTone="neutral" title={deleteLabel} onPress={onDeletePhoto} />
        ) : null}
      </View>
    </BottomSheet>
  );
}

// Dialog konfirmasi terpusat (overlay, satu file dengan BottomSheet). Aksi
// konfirmasi sengaja di ATAS supaya posisi paling gampang dijangkau jempol diisi
// aksi konfirmasi; "Kembali" (aman) di bawah.
export function ConfirmDialog({
  cancelLabel = 'Kembali',
  confirmLabel,
  loading = false,
  message,
  onCancel,
  onConfirm,
  title,
  tone = 'default',
  visible,
}: {
  cancelLabel?: string;
  confirmLabel: string;
  loading?: boolean;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
  tone?: 'danger' | 'default';
  visible: boolean;
}) {
  const isDanger = tone === 'danger';
  const iconName: IconName = isDanger ? 'alert-triangle' : 'check';
  const iconBg = isDanger ? tokens.color.status.danger.bg : tokens.color.brand.soft;
  const iconColor = isDanger ? tokens.color.status.danger.text : tokens.color.brand.base;
  const confirmBg = isDanger ? tokens.color.status.danger.bg : tokens.color.brand.base;
  const confirmBorder = isDanger ? tokens.color.status.danger.border : tokens.color.brand.base;
  const confirmText = isDanger ? tokens.color.status.danger.text : tokens.color.brand.on;

  return (
    <Modal
      animationType="fade"
      onRequestClose={loading ? undefined : onCancel}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View style={confirmStyles.root}>
        <Pressable
          accessibilityLabel="Tutup"
          accessibilityRole="button"
          disabled={loading}
          onPress={onCancel}
          style={confirmStyles.backdrop}
        />
        <View style={confirmStyles.card}>
          <View style={[confirmStyles.iconBox, { backgroundColor: iconBg }]}>
            <Icon name={iconName} size={tokens.icon.md} color={iconColor} />
          </View>
          <Text selectable style={confirmStyles.title}>
            {title}
          </Text>
          <Text selectable style={confirmStyles.message}>
            {message}
          </Text>
          <View style={confirmStyles.actions}>
            <Pressable
              accessibilityRole="button"
              disabled={loading}
              onPress={onConfirm}
              style={[confirmStyles.confirmButton, { backgroundColor: confirmBg, borderColor: confirmBorder }]}
            >
              {loading ? (
                <ActivityIndicator color={confirmText} />
              ) : (
                <Text selectable={false} style={[confirmStyles.confirmText, { color: confirmText }]}>
                  {confirmLabel}
                </Text>
              )}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={loading}
              onPress={onCancel}
              style={confirmStyles.cancelButton}
            >
              <Text selectable={false} style={confirmStyles.cancelText}>
                {cancelLabel}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const confirmStyles = StyleSheet.create({
  root: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: tokens.space.xl },
  backdrop: {
    backgroundColor: tokens.color.overlay.scrim,
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  card: {
    backgroundColor: tokens.color.surface.card,
    borderRadius: 16,
    gap: tokens.space.md,
    maxWidth: 360,
    padding: 18,
    width: '100%',
  },
  iconBox: { alignItems: 'center', borderRadius: 11, height: 38, justifyContent: 'center', width: 38 },
  title: { ...tokens.type.bodyStrong, color: tokens.color.text.primary },
  message: { color: tokens.color.text.secondary, fontSize: 12, lineHeight: 19 },
  actions: { gap: tokens.space.sm },
  confirmButton: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 52,
  },
  confirmText: { fontSize: 16, fontWeight: '700' },
  cancelButton: { alignItems: 'center', justifyContent: 'center', minHeight: 52 },
  cancelText: { color: tokens.color.text.primary, fontSize: 16, fontWeight: '700' },
});

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    backgroundColor: tokens.color.overlay.scrim,
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  sheet: {
    backgroundColor: tokens.color.surface.card,
    borderTopLeftRadius: tokens.radius.sheet,
    borderTopRightRadius: tokens.radius.sheet,
    gap: 0,
    maxHeight: '80%',
    paddingHorizontal: tokens.space.xl,
    paddingTop: tokens.space.md,
  },
  grabber: {
    alignSelf: 'center',
    backgroundColor: tokens.color.line.card,
    borderRadius: tokens.radius.pill,
    height: 5,
    marginBottom: tokens.space.xs,
    width: 44,
  },
  header: { gap: tokens.space.xs, marginBottom: tokens.space.md },
  title: { ...tokens.type.heading, color: tokens.color.text.primary },
  subtitle: { ...tokens.type.bodySmall, color: tokens.color.text.secondary },
  scroll: { flexShrink: 1 },

  row: {
    alignItems: 'center',
    backgroundColor: tokens.color.surface.card,
    borderColor: tokens.color.line.card,
    borderCurve: 'continuous',
    borderRadius: tokens.radius.cardInner,
    borderWidth: 1,
    flexDirection: 'row',
    gap: tokens.space.md,
    padding: tokens.space.md,
  },
  iconCircle: {
    alignItems: 'center',
    borderRadius: tokens.radius.pill,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  iconCircleCondition: { backgroundColor: tokens.color.record.condition.bg },
  iconCirclePhase: { backgroundColor: tokens.color.record.phase.bg },
  iconCircleHarvest: { backgroundColor: tokens.color.record.harvest.bg },
  iconCircleCare: { backgroundColor: tokens.color.record.care.bg },
  iconCircleBrand: { backgroundColor: tokens.color.brand.soft },
  iconCircleNeutral: { backgroundColor: tokens.color.surface.subtle },
  rowMain: { flex: 1 },
  rowTitle: { ...tokens.type.bodyStrong, color: tokens.color.text.primary },
  rowDescription: { ...tokens.type.meta, color: tokens.color.text.secondary },
});

const toneCircle = {
  condition: styles.iconCircleCondition,
  phase: styles.iconCirclePhase,
  harvest: styles.iconCircleHarvest,
  care: styles.iconCircleCare,
  brand: styles.iconCircleBrand,
  neutral: styles.iconCircleNeutral,
};

const toneIconColor: Record<SheetIconTone, string> = {
  condition: tokens.color.record.condition.text,
  phase: tokens.color.record.phase.text,
  harvest: tokens.color.record.harvest.text,
  care: tokens.color.record.care.text,
  brand: tokens.color.brand.base,
  neutral: tokens.color.text.secondary,
};
