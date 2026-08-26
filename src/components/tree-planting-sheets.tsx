// Dua sheet siklus tanam: menutup siklus yang berjalan, dan menanami posisi
// yang sudah kosong. Keduanya pintu masuk ke RPC end_tree_planting dan
// start_tree_planting (migrasi 055), yang sebelum ini hidup tanpa jalan masuk
// dari antarmuka.
//
// Keduanya PRESENTASIONAL: menyimpan isian formnya sendiri, tapi tidak memanggil
// service dan tidak tahu apa-apa soal muat ulang. Panggilan RPC, penanganan
// galat, dan penyegaran data tinggal di layar detail pohon — pola yang sama
// dengan ManageScheduleSheet di layar detail jadwal.

import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { tokens } from '../constants/theme';
import type { TreePlantingEndReason } from '../types/domain';
import { getTodayIsoDate } from '../utils/taskDueDate';
import { BottomSheet } from './bottom-sheet';
import { Icon } from './icons';
import { Button, DateField, ErrorBanner, Field } from './ui';

export type EndTreePlantingFormValues = {
  endReason: TreePlantingEndReason;
  endedAt: string;
};

export type StartTreePlantingFormValues = {
  variety: string;
  plantedAt: string;
};

const END_REASON_OPTIONS: Array<{
  description: string;
  title: string;
  value: TreePlantingEndReason;
}> = [
  {
    description: 'Pohon mati karena hama, penyakit, atau sebab lain.',
    title: 'Mati',
    value: 'mati',
  },
  {
    description: 'Sengaja dicabut, misalnya karena tidak produktif.',
    title: 'Dibongkar',
    value: 'dibongkar',
  },
  {
    description: 'Batangnya disambung varietas lain.',
    title: 'Diganti varietas',
    value: 'diganti',
  },
];

export function EndTreePlantingSheet({
  error,
  loading,
  onClose,
  onSubmit,
  visible,
}: {
  error?: string | null;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (values: EndTreePlantingFormValues) => void;
  visible: boolean;
}) {
  const [endReason, setEndReason] = React.useState<TreePlantingEndReason | null>(null);
  const [endedAt, setEndedAt] = React.useState(getTodayIsoDate());
  const [reasonError, setReasonError] = React.useState<string | undefined>(undefined);

  // Isian dikosongkan tiap sheet DIBUKA, bukan tiap ditutup. Sheet yang gagal
  // menyimpan tetap terbuka dengan pilihan pemilik masih utuh; yang berikutnya
  // dibuka selalu mulai bersih dengan tanggal hari ini.
  React.useEffect(() => {
    if (visible) {
      setEndReason(null);
      setEndedAt(getTodayIsoDate());
      setReasonError(undefined);
    }
  }, [visible]);

  function handleSubmit() {
    if (!endReason) {
      setReasonError('Pilih alasan terlebih dahulu.');
      return;
    }

    onSubmit({ endReason, endedAt });
  }

  return (
    <BottomSheet
      onClose={onClose}
      subtitle="Posisi ini akan menjadi kosong. Riwayat pohon ini tetap tersimpan."
      title="Tandai pohon sudah tidak ada"
      visible={visible}
    >
      <View style={{ gap: tokens.space.lg }}>
        <ErrorBanner message={error} />

        <View style={{ gap: tokens.space.sm }}>
          <Text selectable style={{ ...tokens.type.label, color: tokens.color.text.primary }}>
            Alasan
          </Text>
          {END_REASON_OPTIONS.map((option) => (
            <SheetChoiceRow
              key={option.value}
              description={option.description}
              onPress={() => {
                setEndReason(option.value);
                setReasonError(undefined);
              }}
              selected={endReason === option.value}
              title={option.title}
            />
          ))}
          {reasonError ? (
            <Text
              selectable
              style={{
                color: tokens.color.status.danger.text,
                fontSize: tokens.type.meta.fontSize,
                lineHeight: tokens.type.meta.lineHeight,
              }}
            >
              {reasonError}
            </Text>
          ) : null}
        </View>

        <DateField label="Tanggal" onChangeDate={setEndedAt} value={endedAt} />

        {/* Klaim soal jadwal perawatan berlaku sejak migrasi 057 — lihat
            catatan lengkapnya di EmptyPositionNotice (tree-detail-screen). */}
        <SheetNoticeBox
          text="Setelah ditandai, posisi ini tidak mendapat jadwal perawatan sampai ditanami lagi. Catatan yang sudah ada tidak terhapus."
        />

        <View style={{ gap: tokens.space.sm }}>
          <Button loading={loading} onPress={handleSubmit} title="Tandai" variant="danger" />
          <Button disabled={loading} onPress={onClose} title="Batal" variant="secondary" />
        </View>
      </View>
    </BottomSheet>
  );
}

export function StartTreePlantingSheet({
  displayCode,
  error,
  loading,
  onClose,
  onSubmit,
  visible,
}: {
  displayCode: string;
  error?: string | null;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (values: StartTreePlantingFormValues) => void;
  visible: boolean;
}) {
  const [variety, setVariety] = React.useState('');
  const [plantedAt, setPlantedAt] = React.useState(getTodayIsoDate());
  const [varietyError, setVarietyError] = React.useState<string | undefined>(undefined);

  React.useEffect(() => {
    if (visible) {
      setVariety('');
      setPlantedAt(getTodayIsoDate());
      setVarietyError(undefined);
    }
  }, [visible]);

  function handleSubmit() {
    // Varietas diwajibkan supaya sepadan dengan form tambah dan edit pohon,
    // yang sudah menuntutnya lewat validateTreeForm. RPC-nya sendiri menerima
    // null — yang menutup bentuknya di sini adalah keseragaman antarlayar,
    // bukan database.
    if (!variety.trim()) {
      setVarietyError('Varietas wajib diisi.');
      return;
    }

    onSubmit({ plantedAt, variety });
  }

  return (
    <BottomSheet
      onClose={onClose}
      subtitle="Pohon baru punya riwayat sendiri. Riwayat pohon sebelumnya tetap tersimpan dan tidak tercampur."
      title={`Tanam pohon di posisi ${displayCode}`}
      visible={visible}
    >
      <View style={{ gap: tokens.space.lg }}>
        <ErrorBanner message={error} />

        <Field
          error={varietyError}
          label="Varietas"
          onChangeText={(value) => {
            setVariety(value);

            if (value.trim()) {
              setVarietyError(undefined);
            }
          }}
          placeholder="Contoh: Alpukat mentega"
          value={variety}
        />

        <DateField label="Tanggal tanam" onChangeDate={setPlantedAt} value={plantedAt} />

        <View style={{ gap: tokens.space.sm }}>
          <Button loading={loading} onPress={handleSubmit} title="Simpan" />
          <Button disabled={loading} onPress={onClose} title="Batal" variant="secondary" />
        </View>
      </View>
    </BottomSheet>
  );
}

// Baris pilihan berketerangan di dalam sheet.
//
// Bentuknya sengaja meminjam SheetActionRow (kartu, tebal garis, radius, dan
// jarak yang sama) supaya isi sheet terbaca satu keluarga. Yang berbeda hanya
// apa yang dilakukannya: SheetActionRow membawa pergi ke layar lain dan
// berujung chevron, baris ini MEMILIH dan berujung tanda centang. Karena itu ia
// tidak bisa dipakai ulang apa adanya.
function SheetChoiceRow({
  description,
  onPress,
  selected,
  title,
}: {
  description: string;
  onPress: () => void;
  selected: boolean;
  title: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        alignItems: 'center',
        backgroundColor: selected ? tokens.color.brand.soft : tokens.color.surface.card,
        borderColor: selected ? tokens.color.brand.base : tokens.color.line.card,
        borderCurve: 'continuous',
        borderRadius: tokens.radius.cardInner,
        borderWidth: 1,
        flexDirection: 'row',
        gap: tokens.space.md,
        minHeight: tokens.layout.tapTarget,
        padding: tokens.space.md,
      }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text selectable={false} style={{ ...tokens.type.bodyStrong, color: tokens.color.text.primary }}>
          {title}
        </Text>
        <Text selectable={false} style={{ ...tokens.type.meta, color: tokens.color.text.secondary }}>
          {description}
        </Text>
      </View>
      {selected ? (
        <Icon name="check" size={tokens.icon.md} color={tokens.color.brand.base} />
      ) : null}
    </Pressable>
  );
}

// Kotak peringatan di dalam sheet. Nada 'warning', bukan 'danger': menutup
// siklus tidak menghapus apa pun, jadi memerahkannya akan melebih-lebihkan
// akibatnya.
function SheetNoticeBox({ text }: { text: string }) {
  return (
    <View
      style={{
        backgroundColor: tokens.color.status.warning.bg,
        borderColor: tokens.color.status.warning.border,
        borderCurve: 'continuous',
        borderRadius: tokens.radius.cardInner,
        borderWidth: 1,
        flexDirection: 'row',
        gap: tokens.space.sm,
        padding: tokens.space.md,
      }}
    >
      <Icon name="alert-triangle" size={tokens.icon.md} color={tokens.color.status.warning.text} />
      <Text
        selectable
        style={{
          ...tokens.type.bodySmall,
          color: tokens.color.status.warning.text,
          flex: 1,
        }}
      >
        {text}
      </Text>
    </View>
  );
}
