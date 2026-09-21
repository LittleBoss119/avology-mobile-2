import { useFocusEffect } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { StatusMarker } from '../../../src/components/status-marker';
import { EmptyState, ErrorBanner, LoadingState, Screen } from '../../../src/components/ui';
import {
  FARM_ACCESS_EVENT_LABELS,
  isFarmAccessEvent,
  type FarmAccessEvent,
} from '../../../src/constants/membership';
import { tokens } from '../../../src/constants/theme';
import { colors as palette } from '../../../src/theme/tokens';
import { useAuth } from '../../../src/context/auth-context';
import { getFarmAccessEvents } from '../../../src/services/memberService';
import type { FarmAccessEventEntry } from '../../../src/types/domain';
// Pembantu tanggal yang SUDAH ADA, dipakai apa adanya:
//   toWibIsoDate             -- timestamptz -> tanggal WIB 'YYYY-MM-DD'
//   formatAgendaSectionTitle -- 'Hari ini · 27 Jun 2026' / 'Senin, 29 Jun 2026'
//   getTodayIsoDate          -- tanggal hari ini menurut WIB
// Ketiganya sudah dipakai layar jadwal pemilik dan layar tugas pekerja untuk
// judul section per tanggal, jadi layar ini memakai bentuk judul yang sama
// persis alih-alih mengarang bentuk keempat.
import {
  formatAgendaSectionTitle,
  getTodayIsoDate,
  toWibIsoDate,
} from '../../../src/utils/taskDueDate';

// Sumber datanya tabel append-only farm_access_events (migration 036), bukan
// filter status atas farm_members. Pergeseran ini harus mendahului tombol
// pembatalan/penutupan pemberitahuan di Fase 3, karena tombol-tombol itu
// menghapus baris farm_members — kalau layar ini masih membaca tabel tersebut,
// pemilik akan kehilangan riwayat yang terlihat (temuan R-02).
//
// Konsekuensi yang disengaja: layar ini menampilkan SELURUH jenis event, bukan
// cuma yang negatif. Namanya "Riwayat akses" — isinya akhirnya jujur.
//
// BENTUKNYA TIMELINE SEJAK BATCH 7B (§42), menggantikan kartu per tanggal
// berisi baris <MemberRow> beravatar. Dua hal yang berubah, dan keduanya soal
// apa yang sedang dibaca:
//
//   * Avatar dicabut. Lingkaran inisial menamai ORANG, dan layar ini bukan
//     daftar orang — satu orang yang sama muncul tiga kali di sini (mengajukan,
//     diterima, dinonaktifkan) dan tiga lingkaran identik di tiga baris berbeda
//     hanya mengajari mata untuk mengabaikannya.
//   * Penanda bulat menurut JENIS KEJADIAN menggantikannya, di atas rel garis
//     1px. Yang membedakan satu baris dari baris lain di sini adalah apa yang
//     terjadi, bukan kepada siapa.
//
// PENANDANYA SELALU LINGKARAN, dan warnanya yang berbeda. Kosakata BENTUK milik
// CONDITION_BADGE — segitiga, kotak, silang — sengaja TIDAK dipinjam ke sini:
// bentuk-bentuk itu menamai kondisi POHON, dan memakainya kembali untuk
// keanggotaan orang berarti satu bahasa bentuk yang berarti dua hal berbeda di
// dua layar. StatusMarker tetap dipakai sebagai primitif gambarnya, hanya dengan
// satu bentuk saja.

export default function WorkerAccessHistoryScreen() {
  const { currentFarm } = useAuth();
  const [events, setEvents] = React.useState<FarmAccessEventEntry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const farmId = currentFarm?.farmId;

  const loadEvents = React.useCallback(async () => {
    if (!farmId) {
      setError('Data kebun aktif tidak ditemukan.');
      setEvents([]);
      return;
    }

    setError(null);

    const result = await getFarmAccessEvents(farmId);

    if (result.error) {
      setError(result.error.message);
      setEvents([]);
    } else {
      setEvents(result.data);
    }
  }, [farmId]);

  useFocusEffect(
    React.useCallback(() => {
      setLoading(true);
      loadEvents().finally(() => setLoading(false));
    }, [loadEvents])
  );

  if (loading) {
    return <LoadingState message="Memuat riwayat akses..." />;
  }

  // TANPA applyTopInset, dan itu disengaja. Layar ini bukan tab root: ia
  // butuh tombol kembali, dan yang menyediakannya adalah header native dari
  // Stack.Screen "owner/workers" di app/(owner)/_layout.tsx — yang sengaja
  // TIDAK menyetel headerShown:false. Header itu sudah menerapkan safe-area
  // atas sendiri, jadi applyTopInset di sini menghitungnya untuk kedua kali.
  return (
    <Screen>
      <ErrorBanner message={error} />
      {events.length === 0 ? (
        <EmptyState
          title="Belum ada riwayat akses"
          subtitle="Pengajuan, persetujuan, dan pencabutan akses akan tercatat di sini."
        />
      ) : (
        <View style={styles.groups}>
          {groupByDate(events).map((group) => (
            <View key={group.key} style={styles.group}>
              <Text selectable style={styles.groupTitle}>
                {group.title}
              </Text>
              {/* Kartu pembungkus DICABUT. Rel garis di kiri sudah mengikat
                  baris-baris satu kelompok jadi satu benda — itu pekerjaan yang
                  dulu dibebankan ke bingkai kartu, dan dua pengikat untuk satu
                  kelompok berarti satu di antaranya menganggur. */}
              <View>
                {group.entries.map((entry, index) => (
                  <AccessEventRow
                    key={entry.id}
                    entry={entry}
                    isFirst={index === 0}
                    isLast={index === group.entries.length - 1}
                  />
                ))}
              </View>
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}

// Satu baris timeline: rel di kiri, isi di kanan.
//
// RELNYA TIDAK MENYAMBUNG ANTAR KELOMPOK TANGGAL, dan itu disengaja: judul
// tanggal berdiri di antaranya, dan garis yang menembusnya akan mengabarkan
// kesinambungan yang justru sedang dipotong oleh judul itu. Karena itu potongan
// atas rel tidak digambar pada baris pertama, dan potongan bawah tidak digambar
// pada baris terakhir.
function AccessEventRow({
  entry,
  isFirst,
  isLast,
}: {
  entry: FarmAccessEventEntry;
  isFirst: boolean;
  isLast: boolean;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rail}>
        <View style={[styles.railLine, isFirst ? styles.railLineHidden : null]} />
        <StatusMarker color={resolveEventColor(entry.event)} shape="circle-filled" />
        <View style={[styles.railLine, isLast ? styles.railLineHidden : null]} />
      </View>
      <View style={styles.rowBody}>
        {/* JENIS KEJADIAN DI ATAS NAMA, bukan sebaliknya. Yang dicari pemilik
            saat membuka layar ini adalah "apa yang terjadi pada akses kebun
            saya"; nama orangnya keterangan dari kejadian itu, bukan judulnya.
            Susunannya karena itu sama dengan timeline riwayat pohon: label
            jenis huruf besar, lalu isinya. */}
        <Text selectable style={styles.eventLabel}>
          {resolveEventLabel(entry.event).toUpperCase()}
        </Text>
        <Text numberOfLines={1} selectable style={styles.name}>
          {entry.fullName}
        </Text>
      </View>
    </View>
  );
}

type AccessEventGroup = {
  entries: FarmAccessEventEntry[];
  key: string;
  title: string;
};

// Pengelompokan per tanggal, DI KOMPONEN LAYAR. RPC get_farm_access_events
// sudah mengembalikan barisnya `order by created_at desc` (migrasi 037), jadi
// urutannya tinggal DIPERTAHANKAN — tidak ada pengurutan ulang di sini, dan
// kelompoknya lahir menurut urutan kemunculan baris pertamanya.
//
// Kunci kelompoknya lewat toWibIsoDate, BUKAN potongan string createdAt.
// created_at adalah timestamptz, sedangkan seluruh klasifikasi tanggal di
// aplikasi ini dipatok WIB; toWibIsoDate (taskDueDate.ts) satu-satunya jembatan
// resmi antara keduanya, dan memakainya berarti layar ini tidak menghitung
// offset WIB sendiri.
function groupByDate(events: FarmAccessEventEntry[]): AccessEventGroup[] {
  const groups: AccessEventGroup[] = [];
  const todayIso = getTodayIsoDate();
  // Peta indeks, bukan pencarian linear ke dalam `groups`: barisnya bisa
  // puluhan sampai ratusan dan kelompoknya sama banyaknya pada kasus terburuk.
  const indexByKey = new Map<string, number>();

  for (const entry of events) {
    const iso = toWibIsoDate(entry.createdAt);
    // null berarti timestamp-nya tidak bisa diurai. Barisnya TETAP DITAMPILKAN
    // — riwayat akses adalah jejak, dan menyembunyikan satu baris karena
    // tanggalnya rusak menghilangkan kejadian yang benar-benar terjadi. Yang
    // dikatakan hanya bahwa tanggalnya tidak diketahui, bukan tanggal karangan.
    const key = iso ?? 'unknown';
    const existingIndex = indexByKey.get(key);

    if (existingIndex === undefined) {
      indexByKey.set(key, groups.length);
      groups.push({
        entries: [entry],
        key,
        title: iso ? formatAgendaSectionTitle(iso, todayIso) : 'Tanggal tidak diketahui',
      });
      continue;
    }

    groups[existingIndex].entries.push(entry);
  }

  return groups;
}

// Warna penanda menurut jenis kejadian. TIGA keluarga, bukan enam warna:
//
//   accent      -> kejadian yang MEMBERI akses ('approved'). Satu-satunya.
//   statusBuruk -> kejadian yang MENCABUT akses atas keputusan pemilik
//                  ('rejected', 'removed').
//   statusMati  -> kejadian yang mengakhiri hubungan tanpa ada yang salah
//                  ('left' — pekerja pergi sendiri) .
//   textMuted   -> kejadian yang belum memutuskan apa pun ('requested') atau
//                  yang ditarik oleh pemohonnya sendiri ('cancelled').
//
// 'left' dan 'removed' SENGAJA berbeda warna, sama seperti labelnya sudah
// berbeda sejak temuan R-12: pekerja yang keluar sendiri tidak boleh terbaca
// seperti pekerja yang dikeluarkan pemiliknya.
const EVENT_COLOR: Record<FarmAccessEvent, string> = {
  approved: palette.accent,
  cancelled: palette.textMuted,
  left: palette.statusMati,
  rejected: palette.statusBuruk,
  removed: palette.statusBuruk,
  requested: palette.textMuted,
};

function resolveEventColor(event: string): string {
  return isFarmAccessEvent(event) ? EVENT_COLOR[event] : palette.textMuted;
}

// Label diambil dari src/constants/membership.ts, bukan ditulis ulang di sini.
// 'left' dan 'removed' sengaja punya label berbeda: selama ini keduanya tampil
// sebagai "Dinonaktifkan", sehingga pemilik melihat pekerja yang keluar sendiri
// seolah dia yang mengeluarkannya (temuan R-12).
//
// Nama pelaku TIDAK ditampilkan di baris ini. RPC-nya tetap mengembalikan
// actor_name untuk dipakai fase berikutnya.
//
// Nilai event yang belum dikenal aplikasi tidak boleh membuat seluruh baris
// tampil rusak — jatuhkan ke nilai mentahnya saja. Pola yang sama dipakai
// toNullableSatuanBahan (careActivityShared.ts) dan mapper grade panen
// (harvestService.ts), walau keduanya jatuh ke null alih-alih nilai mentah.
function resolveEventLabel(event: string): string {
  return isFarmAccessEvent(event) ? FARM_ACCESS_EVENT_LABELS[event] : event;
}

// Lebar kolom rel. 20 adalah penanda 11px yang dipusatkan dengan sisa ruang
// yang cukup supaya garisnya tidak menyentuh teks di sebelahnya.
const RAIL_WIDTH = 20;

const styles = StyleSheet.create({
  groups: { gap: tokens.layout.sectionGap },
  group: { gap: tokens.space.sm },
  // Rata KIRI: ia judul kelompok daftar, dan aturan desain hanya memusatkan
  // keadaan kosong di layar ini.
  groupTitle: { ...tokens.type.label, color: tokens.color.text.secondary },
  row: { flexDirection: 'row', gap: tokens.space.md },
  rail: { alignItems: 'center', width: RAIL_WIDTH },
  // flex 1 pada kedua potongan garis: keduanya membagi sisa tinggi baris di
  // atas dan di bawah penanda, berapa pun tinggi isinya. Tanpa itu garisnya
  // harus diberi tinggi tetap yang akan meleset begitu nama membungkus.
  railLine: { backgroundColor: tokens.color.line.hairline, flex: 1, width: 1 },
  railLineHidden: { backgroundColor: 'transparent' },
  rowBody: { flex: 1, gap: 2, paddingBottom: tokens.space.lg },
  // 12/600 huruf besar, bentuk label jenis yang sama dengan timeline riwayat
  // pohon. Huruf besar dipakai lewat toUpperCase() pada nilainya, bukan lewat
  // textTransform: sebagian Android menerapkan textTransform sesudah pengukuran
  // teks dan menghasilkan baris yang terpotong satu huruf.
  eventLabel: {
    color: tokens.color.text.secondary,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.type.caption.fontWeight,
    letterSpacing: 0.6,
    lineHeight: tokens.type.caption.lineHeight,
  },
  name: {
    color: tokens.color.text.primary,
    fontSize: tokens.type.bodyStrong.fontSize,
    fontWeight: tokens.type.bodyStrong.fontWeight,
    lineHeight: tokens.type.bodyStrong.lineHeight,
  },
});
