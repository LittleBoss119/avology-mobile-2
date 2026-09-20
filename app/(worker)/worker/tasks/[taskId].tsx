import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';

import {
  CARE_STATE_MARK,
  TargetTreeCodeList,
  formatCareTarget,
} from '../../../../src/components/care-schedule-components';
import { WorkResultList } from '../../../../src/components/work-result-list';
import { useSnackbar } from '../../../../src/components/snackbar';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  LoadingState,
  MetaRow,
  Screen,
  SectionLabel,
  TopAppBar,
} from '../../../../src/components/ui';
import type { BadgeTone } from '../../../../src/components/ui';
import type { StatusMarkerShape } from '../../../../src/components/status-marker';
import { colors, spacing } from '../../../../src/constants/theme';
import { colors as palette, text as typeScale } from '../../../../src/theme/tokens';
import { consumePendingFeedback } from '../../../../src/lib/pendingFeedback';
import { getTaskDetail } from '../../../../src/services/careTaskService';
import { listTaskProofPhotosForActivities } from '../../../../src/services/photoAttachmentService';
import type { CareTaskDetail } from '../../../../src/types/domain';
import type { TaskProofPhotoMap } from '../../../../src/types/media';
import { formatCareCategory } from '../../../../src/utils/displayFormat';
import {
  dayDifference,
  formatFullDate,
  getTodayIsoDate,
  taskTimeBucket,
} from '../../../../src/utils/taskDueDate';

export default function WorkerTaskDetailScreen() {
  const { taskId } = useLocalSearchParams<{ taskId: string }>();
  const showSnackbar = useSnackbar();
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [proofPhotoMap, setProofPhotoMap] = React.useState<TaskProofPhotoMap>({});
  const [task, setTask] = React.useState<CareTaskDetail | null>(null);

  const loadDetail = React.useCallback(async () => {
    const normalizedTaskId = taskId?.trim();

    if (!normalizedTaskId) {
      setError('Data tugas tidak ditemukan.');
      setProofPhotoMap({});
      setTask(null);
      return;
    }

    setError(null);

    const result = await getTaskDetail({ taskId: normalizedTaskId });

    if (result.error) {
      setError(result.error.message);
      setProofPhotoMap({});
      setTask(null);
      return;
    }

    setTask(result.data);

    const proofResult = await listTaskProofPhotosForActivities({
      activityIds: result.data.activities.map((activity) => activity.id),
      farmId: result.data.farmId,
    });

    if (proofResult.error) {
      setProofPhotoMap({});
    } else {
      setProofPhotoMap(proofResult.data);
    }
  }, [taskId]);

  useFocusEffect(
    React.useCallback(() => {
      // Konfirmasi setelah simpan: baca-sekaligus-hapus penanda dari record.tsx,
      // lalu tampilkan SNACKBAR, bukan spanduk hijau yang menempel di atas
      // layar. Spanduk itu ikut tergulung bersama isi dan duduk jauh dari tombol
      // yang barusan ditekan; snackbar naik dari dasar layar, di dekat ibu jari,
      // dan padam sendiri.
      //
      // Penanda tetap lewat pendingFeedback: pesannya dirakit di layar TUJUAN
      // (feedbackMessage di bawah), bukan dikirim sebagai teks jadi, jadi
      // record.tsx tidak perlu tahu kata-kata apa yang muncul di sini.
      //
      // consume menghapus nilainya, jadi snackbar hanya muncul sekali; fokus
      // tanpa penanda tidak memunculkan apa pun.
      const message = feedbackMessage(consumePendingFeedback());

      if (message) {
        showSnackbar(message);
      }

      setLoading(true);
      loadDetail().finally(() => setLoading(false));
    }, [loadDetail, showSnackbar])
  );

  if (loading) {
    return (
      <LoadingState
        header={<TopAppBar title="Detail tugas" onBack={() => router.back()} />}
        message="Memuat detail tugas..."
      />
    );
  }

  if (!task) {
    return (
      <Screen header={<TopAppBar title="Detail tugas" onBack={() => router.back()} />}>
        <ErrorBanner message={error} />
        <EmptyState title="Tugas tidak ditemukan" subtitle="Tugas mungkin tidak tersedia atau bukan milik Anda." />
      </Screen>
    );
  }

  const activeTask = task;
  const todayIso = getTodayIsoDate();
  const isCancelledByOwner = activeTask.scheduleIsCancelled === true;
  const showFooter = !isCancelledByOwner && activeTask.status !== 'completed';
  const statusMark = taskStatusMark(activeTask, todayIso);

  return (
    <Screen
      header={<TopAppBar title="Detail tugas" onBack={() => router.back()} />}
      // SATU tombol, dan TIDAK ADA pilihan "Tunda" di layar ini.
      //
      // Keputusan selesai-atau-tunda hidup di layar pencatatan, tempat field
      // wajibnya berada. Menaruh "Tunda" di sini berarti pekerja memilih lebih
      // dulu lalu baru diberi tahu ada tanggal yang wajib diisi — atau lebih
      // buruk, mendarat di jalan buntu karena tugasnya hangus dan penundaan
      // memang sudah tertutup untuknya.
      stickyFooter={
        showFooter ? (
          <Button
            title="Catat hasil kerja"
            onPress={() => router.push(`/worker/tasks/${activeTask.id}/record?mode=create`)}
          />
        ) : undefined
      }
    >
      <ErrorBanner message={error} />

      {/* SUSUNAN KEPALA, sejajar dengan Detail Jadwal pemilik (batch 6a) dan
          detail catatan pohon (batch 5):
            1. badge status   2. nilai utama serif   3. baris fakta

          Judulnya JENIS PERAWATAN, bukan `task.title`. Judul di data dirakit
          program dari jenis dan target ("Pemupukan — 3 pohon"), dan tugas lama
          masih memegang judul yang diketik pemiliknya ("Test", "awas").
          Keduanya bukan nama yang layak jadi baris terbesar di layar; yang
          selalu berarti sama bagi siapa pun — dan yang memberi tahu pekerja apa
          yang harus dibawa ke kebun — adalah jenis pekerjaannya. Judul aslinya
          tidak hilang: ia turun jadi baris fakta "Dari". */}
      <View style={{ gap: spacing.sm }}>
        <Badge
          label={statusMark.label}
          marker={statusMark.marker}
          maxWidth={220}
          tone={statusMark.tone}
        />
        <Text
          accessibilityRole="header"
          selectable
          style={{ ...typeScale.stat36, color: palette.textPrimary }}
        >
          {activeTask.category ? formatCareCategory(activeTask.category) : 'Tugas perawatan'}
        </Text>
      </View>

      {/* TIGA BARIS FAKTA, urutannya dikunci spek: di pohon, jatuh tempo, dari.

          Menggantikan dua baris meta bertitik-tengah, satu chip tempo, dan satu
          lingkaran kamera tanpa label. Keempatnya dulu tersebar di tiga
          ketinggian berbeda, dan dua di antaranya — lingkaran kamera dan chip
          tempo — hanya bisa dibaca oleh orang yang sudah tahu artinya.

          "Bukti foto" ikut sebagai baris keempat meski spek menyebut tiga: ia
          menentukan apakah pekerja perlu membawa ponselnya ke pohon, dan itu
          keputusan yang diambil SEBELUM berangkat. Sebagai lingkaran kamera
          tanpa kata, ia tidak pernah menyatakannya.

          "Dari" berisi judul jadwal induknya — satu-satunya jawaban untuk "ini
          datang dari mana" yang tersedia tanpa permintaan tambahan. Nama orang
          yang menugaskan hanya ada sebagai UUID di `assignedBy`, dan
          menerjemahkannya menuntut kueri baru. */}
      <View style={{ gap: spacing.md }}>
        <MetaRow label="Di pohon" value={formatCareTarget(activeTask)} />
        <MetaRow label="Jatuh tempo" value={formatFullDate(activeTask.dueDate)} />
        <MetaRow label="Dari" value={activeTask.title} />
        <MetaRow label="Bukti foto" value={activeTask.requiresPhoto ? 'Wajib' : 'Tidak wajib'} />
      </View>

      {/* Daftar kode pohon yang LENGKAP, sengaja di atas instruksi dan di atas
          tombol catat hasil kerja. Pekerja harus tahu pohon mana saja yang
          harus dikerjakan SEBELUM menandai selesai — satu kali selesai
          menautkan pekerjaan ke SEMUA pohon di jadwal ini (complete_task,
          migrasi 057), jadi meringkasnya jadi angka di sini berarti ia
          menandai selesai tanpa pernah diberi tahu pohon yang mana. */}
      {activeTask.targetType === 'tree' ? (
        <TargetTreeCodeList
          targetTreeCodes={activeTask.targetTreeCodes}
          targetTreeId={activeTask.targetTreeId}
        />
      ) : null}

      {isCancelledByOwner ? (
        <Card variant="danger">
          <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: '700' }}>
            Tugas ini sudah dibatalkan oleh owner.
          </Text>
          <Text selectable style={{ color: colors.textMuted, lineHeight: 21 }}>
            Tugas ini tidak lagi tersedia sebagai pekerjaan aktif.
          </Text>
        </Card>
      ) : null}

      {/* Section "Instruksi" tidak dirender kalau kosong — dulu ia tetap muncul
          dengan isi "Belum ada instruksi tambahan.", dua baris yang cuma
          menyatakan bahwa tidak ada apa-apa di sana.

          Instruksi memang SUDAH dicetak di kartu daftar sejak batch 6b, tapi di
          sana ia dipotong dua baris. Di sini ia utuh, dan itulah sebab utama
          layar ini dibuka sama sekali. */}
      {activeTask.instruction ? (
        <View style={{ gap: spacing.xs }}>
          <SectionLabel title="Instruksi" />
          <Text selectable style={{ color: colors.text, fontSize: 16, lineHeight: 24 }}>
            {activeTask.instruction}
          </Text>
        </View>
      ) : null}

      {/* SELURUH section hilang saat belum ada catatan — judul dan kotak
          putus-putus "Belum dicatat" sekaligus. Kotak itu berbunyi "Pencet
          tombol di bawah untuk mulai", sementara tombol "Catat hasil kerja" di
          stickyFooter sudah mengatakan hal yang sama sambil bisa ditekan.
          Menghapusnya tanpa pengganti membawa pekerja langsung ke tombolnya.

          WorkResultList sendiri tidak diubah: cabang kosongnya masih dipakai
          layar detail tugas owner, yang di luar lingkup batch ini. */}
      {activeTask.activities.length > 0 ? (
        <View style={{ gap: spacing.md }}>
          <SectionLabel title="Riwayat hasil kerja" />
          {/* Bentuk barisnya milik WorkResultList, dipakai bersama layar owner.
              Tugas yang sudah dibatalkan owner tidak lagi menawarkan aksi
              perbaiki — handler-nya tidak dioper sama sekali. */}
          <WorkResultList
            activities={activeTask.activities}
            emptySubtitle=""
            proofPhotoMap={proofPhotoMap}
            onFixLatestNote={
              isCancelledByOwner
                ? undefined
                : (activity) =>
                    router.push(`/worker/tasks/${activeTask.id}/record?mode=edit&activityId=${activity.id}`)
            }
          />
        </View>
      ) : null}
    </Screen>
  );
}

// Keadaan tugas, menggantikan Badge status + chip tempo yang dulu berdampingan
// di kepala layar ini — dua chip yang menyatakan keadaan yang sama dengan dua
// kosakata berbeda ("Belum dikerjakan" di samping "Terlambat 3 hari").
//
// BENTUK DAN NADANYA datang dari CARE_STATE_MARK, tabel bersama dengan layar
// Detail Jadwal pemilik. Yang tinggal di sini hanya penyimpulan kuncinya dari
// bentuk data tugas, dan kata yang dicetak.
//
// 'cancelled' berbunyi "Dibatalkan owner", bukan "Dibatalkan" seperti di sisi
// pemilik: di sana pemilik membaca akibat keputusannya sendiri, di sini pekerja
// perlu tahu bahwa yang membatalkan adalah orang lain.
function taskStatusMark(
  task: CareTaskDetail,
  todayIso: string
): { label: string; marker?: StatusMarkerShape; tone: BadgeTone } {
  if (task.scheduleIsCancelled === true) {
    return { label: 'Dibatalkan owner', ...CARE_STATE_MARK.cancelled };
  }

  if (task.status === 'completed') {
    return { label: 'Selesai', ...CARE_STATE_MARK.done };
  }

  // Ember waktu yang SAMA yang dipakai daftar Tugas untuk menempatkan kartu ini
  // di seksi Telat/Hari ini/Besok. Dipakai ulang, bukan dihitung ulang: badge
  // yang berbunyi "Jatuh tempo hari ini" pada tugas yang barusan duduk di bawah
  // label "Telat" adalah dua jawaban untuk satu pertanyaan.
  //
  // scheduleIsCancelled false: cabang pembatalan sudah ditangani di atas.
  const bucket = taskTimeBucket(task, todayIso, false);

  if (bucket === 'missed') {
    return { label: 'Hangus', ...CARE_STATE_MARK.missed };
  }

  if (bucket === 'overdue') {
    return {
      label: `Telat ${Math.max(1, dayDifference(task.dueDate, todayIso))} hari`,
      ...CARE_STATE_MARK.overdue,
    };
  }

  if (bucket === 'today') {
    return { label: 'Jatuh tempo hari ini', ...CARE_STATE_MARK.dueToday };
  }

  // Diperiksa SESUDAH ember waktu: tugas yang ditunda ke tanggal yang sudah
  // lewat tetap tunggakan lebih dulu, dan "Ditunda" pada tugas yang telat tiga
  // hari menutupi kabar yang lebih mendesak.
  if (task.status === 'postponed') {
    return { label: 'Ditunda', ...CARE_STATE_MARK.postponed };
  }

  return { label: 'Belum dikerjakan', ...CARE_STATE_MARK.pending };
}

function feedbackMessage(feedback: string | null): string | null {
  if (feedback === 'completed') {
    return 'Hasil kerja tersimpan.';
  }

  if (feedback === 'postponed') {
    return 'Penundaan tersimpan.';
  }

  if (feedback === 'updated') {
    return 'Perubahan tersimpan.';
  }

  return null;
}

