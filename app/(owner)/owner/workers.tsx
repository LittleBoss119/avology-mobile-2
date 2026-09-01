import { useFocusEffect } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { MemberRow } from '../../../src/components/member-row';
import { Card, EmptyState, ErrorBanner, LoadingState, Screen } from '../../../src/components/ui';
import {
  FARM_ACCESS_EVENT_LABELS,
  isFarmAccessEvent,
} from '../../../src/constants/membership';
import { tokens } from '../../../src/constants/theme';
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
// lagi filter status atas farm_members. Pergeseran ini harus mendahului tombol
// pembatalan/penutupan pemberitahuan di Fase 3, karena tombol-tombol itu
// menghapus baris farm_members — kalau layar ini masih membaca tabel tersebut,
// pemilik akan kehilangan riwayat yang terlihat (temuan R-02).
//
// Konsekuensi yang disengaja: layar ini sekarang menampilkan SELURUH jenis
// event, bukan cuma yang negatif. Namanya "Riwayat akses" — isinya akhirnya
// jujur.

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
        <EmptyState title="Belum ada riwayat akses." />
      ) : (
        <View style={styles.groups}>
          {groupByDate(events).map((group) => (
            <View key={group.key} style={styles.group}>
              <Text selectable style={styles.groupTitle}>
                {group.title}
              </Text>
              {/* Kartu per kelompok, bukan baris polos di atas latar seperti
                  sebelumnya. Kartu itulah yang membuat batas kelompok terlihat:
                  tanpanya, judul tanggal hanya melayang di antara baris-baris
                  yang bentuknya sama dan tidak jelas mana milik siapa. */}
              <Card padding={tokens.layout.cardPadding}>
                <View>
                  {group.entries.map((entry, index) => (
                    <View key={entry.id} style={index > 0 ? styles.rowDivider : undefined}>
                      {/* Tanggal DICABUT dari meta baris — ia sudah jadi judul
                          kelompoknya, dan mengulangnya di tiap baris justru
                          yang membuat "kapan terjadi apa" tenggelam. Yang
                          tersisa katanya saja. */}
                      <MemberRow
                        name={entry.fullName}
                        meta={resolveEventLabel(entry.event)}
                        tone="neutral"
                      />
                    </View>
                  ))}
                </View>
              </Card>
            </View>
          ))}
        </View>
      )}
    </Screen>
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

// Label diambil dari src/constants/membership.ts, bukan ditulis ulang di sini.
// 'left' dan 'removed' sengaja punya label berbeda: selama ini keduanya tampil
// sebagai "Dinonaktifkan", sehingga pemilik melihat pekerja yang keluar sendiri
// seolah dia yang mengeluarkannya (temuan R-12).
//
// Nama pelaku TIDAK ditampilkan di baris ini. RPC-nya tetap mengembalikan
// actor_name untuk dipakai fase berikutnya.
//
// TIDAK LAGI DIPAKAI sejak tanggal pindah jadi judul kelompok — baris kini
// memakai resolveEventLabel langsung. Dibiarkan, tidak dihapus.
function buildEventMeta(entry: FarmAccessEventEntry): string {
  return `${resolveEventLabel(entry.event)} · ${formatDate(entry.createdAt)}`;
}

// Nilai event yang belum dikenal aplikasi tidak boleh membuat seluruh baris
// tampil rusak — jatuhkan ke nilai mentahnya saja. Pola yang sama dipakai
// toNullableSatuanBahan (careActivityShared.ts) dan mapper grade panen
// (harvestService.ts), walau keduanya jatuh ke null alih-alih nilai mentah.
function resolveEventLabel(event: string): string {
  return isFarmAccessEvent(event) ? FARM_ACCESS_EVENT_LABELS[event] : event;
}

function formatDate(value: string | null): string {
  if (!value) {
    return '-';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

const styles = StyleSheet.create({
  groups: { gap: tokens.layout.sectionGap },
  group: { gap: tokens.space.sm },
  // Rata KIRI: ia judul kelompok daftar, dan aturan desain hanya memusatkan
  // keadaan kosong di layar ini.
  groupTitle: { ...tokens.type.label, color: tokens.color.text.secondary },
  rowDivider: {
    borderTopColor: tokens.color.line.hairline,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
