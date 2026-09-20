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
import { colors as palette } from '../theme/tokens';
import type { TreePlantingEndReason } from '../types/domain';
import { getTodayIsoDate } from '../utils/taskDueDate';
import { BottomSheet } from './bottom-sheet';
import { Icon } from './icons';
import {
  Button,
  DateField,
  ErrorBanner,
  Field,
  StatusMarker,
  type StatusMarkerShape,
} from './ui';

export type EndTreePlantingFormValues = {
  endReason: TreePlantingEndReason;
  endedAt: string;
};

export type StartTreePlantingFormValues = {
  variety: string;
  plantedAt: string;
};

// KETIGA ALASAN, dan penanda bentuknya.
//
// PENANDANYA BERWARNA NETRAL, DAN ITU PEMBEDA YANG PALING PENTING DI BERKAS
// INI. Badge kondisi pohon memakai penanda bentuk BERWARNA STATUS — silang
// statusMati untuk kondisi 'Mati', segitiga statusPerhatian untuk 'Perhatian',
// dan seterusnya. Penanda di sini memakai bentuk yang sama sekali tidak
// berwarna status, karena ketiganya BUKAN keadaan pohon melainkan SEBAB
// siklusnya ditutup.
//
// Kenapa itu penting: aplikasi ini punya dua hal bernama "Mati" yang artinya
// jauh berbeda, dan keduanya hanya berjarak dua ketukan.
//
//   KONDISI 'Mati' (Catat kondisi)   pohonnya MASIH BERDIRI di posisinya. Sel
//                                    denah tetap terisi, riwayatnya berjalan
//                                    terus, dan ia masih dapat jadwal
//                                    perawatan. Ia laporan keadaan.
//   ALASAN 'Mati' (lembar ini)       siklus tanamnya DITUTUP. Sel denah jadi
//                                    kosong, kondisinya direset, fasenya
//                                    dikosongkan. Ia penutupan.
//
// Selain warna penanda, yang membedakan keduanya di layar adalah KALIMAT
// deskripsi di bawah tiap judul — lihat teks 'mati' di bawah, yang menyebut
// "sudah tidak berdiri" secara harfiah.
const END_REASON_OPTIONS: Array<{
  description: string;
  markerShape: StatusMarkerShape;
  title: string;
  value: TreePlantingEndReason;
}> = [
  {
    // Kalimat ini SENGAJA menyebut "sudah tidak berdiri", bukan sekadar
    // "pohon mati". Pemilik yang baru saja mencatat kondisi 'Mati' di layar
    // lain harus bisa membaca baris ini dan tahu bahwa yang ini berbeda —
    // yang satu mencatat keadaan, yang ini mengosongkan posisinya.
    description: 'Pohonnya sudah tidak berdiri lagi di posisi ini.',
    markerShape: 'cross',
    title: 'Mati',
    value: 'mati',
  },
  {
    description: 'Sengaja dicabut, misalnya karena tidak produktif.',
    markerShape: 'square',
    title: 'Dibongkar',
    value: 'dibongkar',
  },
  {
    description: 'Batangnya disambung varietas lain.',
    markerShape: 'circle-outline',
    title: 'Diganti',
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

  // Isian dikosongkan tiap sheet DIBUKA, bukan tiap ditutup. Sheet yang gagal
  // menyimpan tetap terbuka dengan pilihan pemilik masih utuh; yang berikutnya
  // dibuka selalu mulai bersih dengan tanggal hari ini.
  React.useEffect(() => {
    if (visible) {
      setEndReason(null);
      setEndedAt(getTodayIsoDate());
    }
  }, [visible]);

  function handleSubmit() {
    // Penjaga terakhir. Tombolnya sudah nonaktif tanpa alasan terpilih, jadi
    // baris ini tidak seharusnya pernah tercapai — tapi kalau ia tercapai,
    // mendiamkannya jauh lebih baik daripada mengirim alasan kosong ke RPC
    // yang menutup siklus tanam.
    if (!endReason) {
      return;
    }

    onSubmit({ endReason, endedAt });
  }

  return (
    <BottomSheet
      onClose={onClose}
      // "Posisi tetap tercatat", BUKAN "posisi akan menjadi kosong". Keduanya
      // benar, tapi yang pertama menjawab kekhawatiran yang sebenarnya dibawa
      // pemilik ke lembar ini: apakah saya kehilangan sesuatu. Tidak — yang
      // hilang hanya pohonnya, dan itu memang sudah terjadi di kebun sebelum
      // ia membuka lembar ini.
      subtitle="Posisi tetap tercatat. Riwayat pohon ini tersimpan."
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
              markerShape={option.markerShape}
              onPress={() => setEndReason(option.value)}
              selected={endReason === option.value}
              title={option.title}
            />
          ))}
        </View>

        <DateField label="Tanggal" onChangeDate={setEndedAt} value={endedAt} />

        {/* Klaim soal jadwal perawatan berlaku sejak migrasi 057 — lihat
            catatan lengkapnya di EmptyPositionNotice (tree-detail-screen).

            Kalimatnya TIDAK memakai kata "hapus" maupun "arsip", dan itu
            bukan kehati-hatian berlebihan: tidak satu pun baris data dihapus
            oleh aksi ini, dan tidak ada jalur arsip di antarmuka ini sama
            sekali. Memakai salah satu kata itu akan membuat pemilik percaya
            ia sedang membuang riwayat pohonnya. */}
        <SheetNoticeBox
          text="Setelah ditandai, posisi ini tidak mendapat jadwal perawatan sampai ditanami lagi. Catatan yang sudah ada tetap tersimpan."
        />

        <View style={{ gap: tokens.space.sm }}>
          {/* NONAKTIF SAMPAI SATU ALASAN DIPILIH, bukan aktif lalu menolak.
              Bedanya: tombol yang menolak baru mengajarkan syaratnya SETELAH
              pemilik menekan tombol merah — dan detik di antara tekanan dan
              penolakan itu adalah detik ia mengira siklus tanamnya baru saja
              ditutup. Tombol yang nonaktif mengajarkan syaratnya sebelum ada
              yang bisa salah.

              Itu juga yang mencabut reasonError beserta barisnya: pesan galat
              untuk keadaan yang tidak bisa lagi terjadi hanya kode yang tidak
              pernah dibaca siapa pun. */}
          <Button
            disabled={!endReason}
            loading={loading}
            onPress={handleSubmit}
            title="Tandai"
            variant="danger"
          />
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

const SHEET_CHOICE_ROW_HEIGHT = 60;

// Baris pilihan berketerangan di dalam sheet.
//
// Bentuknya sengaja meminjam SheetActionRow (kartu, tebal garis, radius, dan
// jarak yang sama) supaya isi sheet terbaca satu keluarga. Yang berbeda hanya
// apa yang dilakukannya: SheetActionRow membawa pergi ke layar lain dan
// berujung chevron, baris ini MEMILIH dan berujung tanda centang. Karena itu ia
// tidak bisa dipakai ulang apa adanya.
function SheetChoiceRow({
  description,
  markerShape,
  onPress,
  selected,
  title,
}: {
  description: string;
  /**
   * Penanda BENTUK di kiri baris, berwarna NETRAL.
   *
   * Warnanya sengaja tidak pernah warna status — lihat catatan panjang pada
   * END_REASON_OPTIONS. Bentuknya yang membedakan ketiga alasan satu sama
   * lain; warnanya yang membedakan seluruh kelompok ini dari badge kondisi
   * pohon, yang memakai bentuk serupa dengan warna status.
   */
  markerShape: StatusMarkerShape;
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
        borderColor: selected ? palette.accent : tokens.color.line.card,
        borderCurve: 'continuous',
        borderRadius: tokens.radius.cardInner,
        borderWidth: 1,
        flexDirection: 'row',
        gap: tokens.space.md,
        // 60, naik dari tapTarget (44). Baris pilihan BERKETERANGAN memuat dua
        // baris teks; 44 memaksa keduanya berhimpit tanpa napas, dan baris yang
        // berhimpit paling sulit dibaca justru oleh pengguna yang jadi alasan
        // seluruh aturan ukuran ini ada.
        minHeight: SHEET_CHOICE_ROW_HEIGHT,
        padding: tokens.space.md,
      }}
    >
      {/* Slot berlebar tetap, supaya judul ketiga baris punya satu garis rata
          yang sama walau bentuk penandanya berbeda lebar. */}
      <View style={{ alignItems: 'center', width: tokens.icon.md }}>
        <StatusMarker
          color={selected ? palette.accent : palette.textMuted}
          shape={markerShape}
        />
      </View>
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
