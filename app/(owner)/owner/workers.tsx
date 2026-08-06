import { useFocusEffect } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { MemberRow } from '../../../src/components/member-row';
import { EmptyState, ErrorBanner, LoadingState, Screen } from '../../../src/components/ui';
import {
  FARM_ACCESS_EVENT_LABELS,
  isFarmAccessEvent,
} from '../../../src/constants/membership';
import { colors } from '../../../src/constants/theme';
import { useAuth } from '../../../src/context/auth-context';
import { getFarmAccessEvents } from '../../../src/services/memberService';
import type { FarmAccessEventEntry } from '../../../src/types/domain';

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

  return (
    <Screen applyTopInset>
      <ErrorBanner message={error} />
      {events.length === 0 ? (
        <EmptyState title="Belum ada riwayat akses." />
      ) : (
        // Tanpa kartu pembungkus: baris langsung di atas latar, dipisah garis
        // tipis — sama seperti daftar anggota dan pengajuan di tab Kebun.
        <View>
          {events.map((entry, index) => (
            <View
              key={entry.id}
              style={index > 0 ? { borderTopColor: colors.divider, borderTopWidth: 1 } : undefined}
            >
              <MemberRow name={entry.fullName} meta={buildEventMeta(entry)} tone="neutral" />
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}

// Label diambil dari src/constants/membership.ts, bukan ditulis ulang di sini.
// 'left' dan 'removed' sengaja punya label berbeda: selama ini keduanya tampil
// sebagai "Dinonaktifkan", sehingga pemilik melihat pekerja yang keluar sendiri
// seolah dia yang mengeluarkannya (temuan R-12).
//
// Nama pelaku TIDAK ditampilkan di baris ini. RPC-nya tetap mengembalikan
// actor_name untuk dipakai fase berikutnya.
function buildEventMeta(entry: FarmAccessEventEntry): string {
  return `${resolveEventLabel(entry.event)} · ${formatDate(entry.createdAt)}`;
}

// Nilai event yang belum dikenal aplikasi tidak boleh membuat seluruh baris
// tampil rusak — jatuhkan ke nilai mentahnya saja. Pola yang sama dipakai
// normalizeOperationalReportCategory di src/constants/operationalReport.ts.
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
