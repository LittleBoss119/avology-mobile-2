import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { tokens } from '../constants/theme';
import type { CareActivity } from '../types/domain';
import type { TaskProofPhoto, TaskProofPhotoMap } from '../types/media';
import { formatActivityStatus, formatProdukDenganTakaran } from '../utils/displayFormat';
import { Icon } from './icons';
import { TaskProofPhotoPreview } from './task-proof-photo';
import { EmptyState } from './ui';

// Riwayat hasil kerja satu tugas — SATU bentuk, dipakai pekerja maupun owner.
//
// Owner harus melihat log yang sama persis dengan yang dilihat pekerja: di situ
// terlihat bahwa satu tugas sempat ditunda dua kali sebelum beres, dan merek
// bahan apa yang dipakai. Kalau kedua sisi punya komponennya sendiri, dua
// tampilan itu pelan-pelan berbeda dan owner berhenti mempercayai apa yang
// dilihatnya.
//
// Sebelum file ini ada, bentuknya disalin di tiga tempat: detail tugas pekerja,
// detail tugas owner, dan detail jadwal owner. Penyakit yang sama dengan
// mapCareActivity dulu — menambah kolom di satu salinan dan lupa di dua lainnya
// tetap lolos typecheck, dan baru ketahuan setelah dipakai.
//
// Perbedaan worker vs owner sengaja diungkap sebagai PROP, bukan sebagai
// varian bernama. Keduanya cuma dua beda kecil, dan prop membuatnya mustahil
// keliru: owner tidak bisa memunculkan aksi tulis hanya dengan salah menulis
// nama varian — dia harus benar-benar mengoper handler yang tidak dia punya.

export function WorkResultList({
  activities,
  emptySubtitle,
  emptyTitle = 'Belum dicatat',
  onFixLatestNote,
  performerNames,
  proofPhotoMap,
}: {
  activities: CareActivity[];
  emptySubtitle: string;
  emptyTitle?: string;
  // Hanya diisi sisi PEKERJA, dan hanya untuk baris terbaru. Owner sengaja
  // tidak mengopernya: memperbaiki catatan adalah hak pencatatnya, dan RPC
  // update_task_realization memang menolak siapa pun selain performed_by.
  // Tanpa handler ini, barisnya murni baca.
  onFixLatestNote?: (activity: CareActivity) => void;
  // Hanya diisi sisi OWNER. Pekerja tidak butuh melihat namanya sendiri di
  // setiap baris — dia satu-satunya yang bisa mencatat di tugasnya.
  performerNames?: Record<string, string>;
  proofPhotoMap: TaskProofPhotoMap;
}) {
  if (activities.length === 0) {
    return <EmptyState icon="clipboard" subtitle={emptySubtitle} title={emptyTitle} variant="dashed" />;
  }

  return (
    <View>
      {activities.map((activity, index) => (
        <WorkResultRow
          key={activity.id}
          activity={activity}
          isFirst={index === 0}
          isLatest={index === 0}
          onFixNote={index === 0 && onFixLatestNote ? () => onFixLatestNote(activity) : undefined}
          performerName={performerNames?.[activity.performedBy]}
          proof={proofPhotoMap[activity.id]}
        />
      ))}
    </View>
  );
}

// Satu baris riwayat hasil kerja.
//
// Entri LAMA diredupkan (opacity 0.75): yang terbaru adalah kondisi sekarang,
// sisanya jejak. Perbedaannya sengaja tipis — jejak tetap harus terbaca, cuma
// tidak lagi bersaing perhatian dengan baris teratas.
//
// Aksinya bernama "Perbaiki catatan", bukan "Edit". "Edit" terlalu longgar dan
// membuat pekerja mengira dia bisa mengubah hasil kerjanya; yang bisa diubah
// hanya catatan, bahan, dan foto.
function WorkResultRow({
  activity,
  isFirst,
  isLatest,
  onFixNote,
  performerName,
  proof,
}: {
  activity: CareActivity;
  isFirst: boolean;
  isLatest: boolean;
  onFixNote?: () => void;
  performerName?: string;
  proof?: TaskProofPhoto;
}) {
  const isCompleted = activity.status === 'completed';
  const bahan = formatProdukDenganTakaran(
    activity.produk,
    activity.produkJumlah,
    activity.produkSatuan
  );

  return (
    <View
      style={{
        borderTopColor: tokens.color.line.hairline,
        borderTopWidth: isFirst ? 0 : 1,
        gap: tokens.space.sm,
        opacity: isLatest ? 1 : 0.75,
        paddingVertical: tokens.space.lg,
      }}
    >
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: tokens.space.md }}>
        <View
          style={{
            alignItems: 'center',
            backgroundColor: isCompleted ? tokens.color.status.success.bg : tokens.color.status.warning.bg,
            borderRadius: tokens.radius.pill,
            height: 36,
            justifyContent: 'center',
            width: 36,
          }}
        >
          <Icon
            name={isCompleted ? 'check' : 'clock'}
            size={tokens.icon.md}
            color={isCompleted ? tokens.color.status.success.text : tokens.color.status.warning.text}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text selectable style={{ ...tokens.type.bodyStrong, color: tokens.color.text.primary }}>
            {formatActivityStatus(activity.status)}
          </Text>
          {performerName ? (
            <Text selectable style={{ ...tokens.type.meta, color: tokens.color.text.tertiary }}>
              {performerName}
            </Text>
          ) : null}
        </View>
        <Text selectable style={{ ...tokens.type.meta, color: tokens.color.text.tertiary }}>
          {formatDateTime(activity.performedAt)}
        </Text>
      </View>

      {bahan ? (
        <View style={{ alignItems: 'center', flexDirection: 'row', gap: tokens.space.sm }}>
          <Icon name="basket" size={tokens.icon.xs} color={tokens.color.text.tertiary} />
          <Text selectable style={{ ...tokens.type.bodySmall, color: tokens.color.text.secondary, flex: 1 }}>
            {bahan}
          </Text>
        </View>
      ) : null}

      {activity.note ? (
        <Text selectable style={{ ...tokens.type.bodySmall, color: tokens.color.text.secondary }}>
          {activity.note}
        </Text>
      ) : null}

      {proof ? <TaskProofPhotoPreview borderRadius={tokens.radius.tile} photo={proof} /> : null}

      {/* Jejak perbaikan. Sengaja halus — bukan peringatan, tapi owner harus
          bisa melihat bahwa catatan ini pernah disentuh setelah dicatat. */}
      {activity.editedAt ? (
        <View style={{ alignItems: 'center', flexDirection: 'row', gap: tokens.space.xs }}>
          <Icon name="pencil" size={tokens.icon.xs} color={tokens.color.text.tertiary} />
          <Text selectable style={{ ...tokens.type.caption, color: tokens.color.text.tertiary, fontWeight: '400' }}>
            {`Catatan diperbaiki ${formatDateTime(activity.editedAt)}`}
          </Text>
        </View>
      ) : null}

      {onFixNote ? (
        <Pressable
          accessibilityRole="button"
          hitSlop={{ bottom: 8, left: 8, right: 8, top: 8 }}
          onPress={onFixNote}
          style={{ alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: tokens.space.sm }}
        >
          <Icon name="pencil" size={tokens.icon.sm} color={tokens.color.brand.dark} />
          <Text selectable={false} style={{ ...tokens.type.bodySmall, color: tokens.color.brand.dark, fontWeight: '700' }}>
            Perbaiki catatan
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function formatDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('id-ID', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
