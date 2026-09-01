import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';

import { ConfirmDialog } from '../../../../src/components/bottom-sheet';
import {
  FormChipGroup,
  TargetTreeCodeList,
  formatCareTarget,
} from '../../../../src/components/care-schedule-components';
import { Icon } from '../../../../src/components/icons';
import { WorkResultList } from '../../../../src/components/work-result-list';
import {
  Badge,
  Button,
  CameraGlyph,
  EmptyState,
  ErrorBanner,
  LoadingState,
  Screen,
  SuccessBanner,
  TopAppBar,
} from '../../../../src/components/ui';
import { colors, radius, spacing, statusColors, tokens, typography } from '../../../../src/constants/theme';
import { useAuth } from '../../../../src/context/auth-context';
import { consumePendingFeedback } from '../../../../src/lib/pendingFeedback';
import {
  assignWorkerToSchedule,
  getCareScheduleDetail,
  stopScheduleRepeat,
} from '../../../../src/services/careScheduleService';
import { getTaskDetail } from '../../../../src/services/careTaskService';
import { getActiveWorkers, getFarmMemberBasicProfiles } from '../../../../src/services/memberService';
import { listTaskProofPhotosForActivities } from '../../../../src/services/photoAttachmentService';
import type {
  CareScheduleDetail,
  CareTaskDetail,
  FarmMemberBasicProfile,
  WorkerMembership,
} from '../../../../src/types/domain';
import type { TaskProofPhotoMap } from '../../../../src/types/media';
import { formatCareCategory } from '../../../../src/utils/displayFormat';
import { getTodayIsoDate, scheduleDueDatePill, type DueDatePill } from '../../../../src/utils/taskDueDate';

export default function CareScheduleDetailScreen() {
  const { currentFarm } = useAuth();
  const { scheduleId } = useLocalSearchParams<{ scheduleId: string }>();
  const [error, setError] = React.useState<string | null>(null);
  const [activeWorkers, setActiveWorkers] = React.useState<WorkerMembership[]>([]);
  const [assignLoading, setAssignLoading] = React.useState(false);
  const [assignWorkerId, setAssignWorkerId] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [proofPhotoMap, setProofPhotoMap] = React.useState<TaskProofPhotoMap>({});
  const [schedule, setSchedule] = React.useState<CareScheduleDetail | null>(null);
  const [stopRepeatConfirmOpen, setStopRepeatConfirmOpen] = React.useState(false);
  const [stopRepeatLoading, setStopRepeatLoading] = React.useState(false);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [taskDetailMap, setTaskDetailMap] = React.useState<Record<string, CareTaskDetail>>({});
  const [workerNames, setWorkerNames] = React.useState<Record<string, string>>({});

  const farmId = currentFarm?.farmId;

  const loadDetail = React.useCallback(async () => {
    const normalizedScheduleId = scheduleId?.trim();

    if (!normalizedScheduleId) {
      setError('Data jadwal tidak ditemukan.');
      setProofPhotoMap({});
      setSchedule(null);
      setTaskDetailMap({});
      setWorkerNames({});
      return;
    }

    if (!farmId) {
      setError('Data kebun aktif tidak ditemukan.');
      setProofPhotoMap({});
      setSchedule(null);
      setTaskDetailMap({});
      setWorkerNames({});
      return;
    }

    setError(null);

    // getActiveWorkers ikut di sini (bukan query terpisah saat blok penugasan
    // muncul) supaya tetap satu gelombang request seperti sebelumnya.
    const [scheduleResult, workersResult, activeWorkersResult] = await Promise.all([
      getCareScheduleDetail({ scheduleId: normalizedScheduleId }),
      getFarmMemberBasicProfiles(farmId),
      getActiveWorkers(farmId),
    ]);

    if (scheduleResult.error) {
      setError(scheduleResult.error.message);
      setProofPhotoMap({});
      setSchedule(null);
      setTaskDetailMap({});
    } else {
      setSchedule(scheduleResult.data);
      await loadTaskWorkResultSummaries(scheduleResult.data);
    }

    if (workersResult.error) {
      setWorkerNames({});
    } else {
      setWorkerNames(
        Object.fromEntries(
          workersResult.data.map((worker: FarmMemberBasicProfile) => [worker.userId, worker.fullName])
        )
      );
    }

    // Gagal memuat pekerja aktif tidak boleh menutupi detail jadwalnya —
    // blok penugasan cukup menampilkan keadaan kosongnya sendiri.
    setActiveWorkers(activeWorkersResult.error ? [] : activeWorkersResult.data);
  }, [farmId, scheduleId]);

  async function loadTaskWorkResultSummaries(scheduleDetail: CareScheduleDetail) {
    if (scheduleDetail.tasks.length === 0) {
      setProofPhotoMap({});
      setTaskDetailMap({});
      return;
    }

    const taskResults = await Promise.all(
      scheduleDetail.tasks.map((task) => getTaskDetail({ taskId: task.id }))
    );
    const taskDetails = taskResults
      .map((result) => result.data)
      .filter((taskDetail): taskDetail is CareTaskDetail => Boolean(taskDetail));
    const activityIds = taskDetails.flatMap((taskDetail) =>
      taskDetail.activities.map((activity) => activity.id)
    );

    setTaskDetailMap(Object.fromEntries(taskDetails.map((taskDetail) => [taskDetail.id, taskDetail])));

    if (activityIds.length === 0) {
      setProofPhotoMap({});
      return;
    }

    const proofResult = await listTaskProofPhotosForActivities({
      activityIds,
      farmId: scheduleDetail.farmId,
    });

    setProofPhotoMap(proofResult.data ?? {});
  }

  useFocusEffect(
    React.useCallback(() => {
      // Konfirmasi setelah simpan dari layar Edit Jadwal: baca-sekaligus-hapus
      // penanda, tampilkan SuccessBanner sekali. Fokus tanpa penanda membersihkan
      // banner lama (mis. kembali tanpa menyimpan).
      const feedback = consumePendingFeedback();
      setSuccess(feedback === 'schedule_updated' ? 'Perubahan tersimpan.' : null);
      setLoading(true);
      loadDetail().finally(() => setLoading(false));
    }, [loadDetail])
  );

  if (loading) {
    return <LoadingState message="Memuat detail jadwal..." />;
  }

  if (!schedule) {
    return (
      <Screen header={<TopAppBar title="Detail Jadwal" onBack={() => router.back()} />}>
        <ErrorBanner message={error} />
        <EmptyState title="Jadwal tidak ditemukan" subtitle="Jadwal mungkin tidak tersedia atau akses ditolak." />
      </Screen>
    );
  }

  const activeSchedule = schedule;
  const hasWorkResult = scheduleHasWorkResult(activeSchedule, taskDetailMap);
  const isLocked = activeSchedule.isCancelled === true || hasWorkResult;

  const pill: DueDatePill = activeSchedule.isCancelled
    ? { tone: 'neutral', label: 'Jadwal dibatalkan' }
    : scheduleDueDatePill(activeSchedule, activeSchedule.tasks, getTodayIsoDate());

  // Sejak migration 041 jadwal boleh punya NOL tugas: penerus rantai dibuat
  // tanpa tugas kalau pekerjanya sudah keluar dari kebun saat itu.
  const hasTasks = activeSchedule.tasks.length > 0;
  const needsWorker = !hasTasks && activeSchedule.isCancelled !== true;
  const isRecurring = activeSchedule.repeatEveryDays !== null;
  const canStopRepeat = isRecurring && activeSchedule.isCancelled !== true;
  const showEditButton = !isLocked;

  // "Batalkan jadwal" TIDAK LAGI DI LAYAR INI — ia pindah ke layar Edit Jadwal,
  // mengikuti pola yang sudah terkunci di aplikasi ini: aksi destruktif "tandai
  // pohon hilang" juga tinggal di dalam layar edit pohon, bukan di detailnya.
  //
  // Pemindahan itu sekaligus menutup satu hal dengan sendirinya: syarat kunci
  // Edit dan Batalkan identik (keduanya isLocked), jadi begitu layar edit tidak
  // bisa dimasuki, Batalkan otomatis tidak terjangkau. Tidak ada penjaga
  // tambahan yang perlu ditulis di sini.

  // Tanpa jeda setTimeout lagi: dulu perlu menunggu sheet "Kelola jadwal"
  // menutup dulu supaya tidak ada dua overlay bertumpuk. Sheet-nya sudah tidak
  // ada, tombolnya langsung di stickyFooter, jadi dialognya boleh muncul
  // seketika.
  function handleRequestStopRepeat() {
    setStopRepeatConfirmOpen(true);
  }

  async function runStopRepeat() {
    setStopRepeatLoading(true);
    setError(null);

    const result = await stopScheduleRepeat({
      scheduleId: activeSchedule.id,
    });

    if (result.error) {
      setError(result.error.message);
      setStopRepeatLoading(false);
      setStopRepeatConfirmOpen(false);
      return;
    }

    await loadDetail();
    setStopRepeatLoading(false);
    setStopRepeatConfirmOpen(false);
    setSuccess('Pengulangan dihentikan. Jadwal ini tetap dikerjakan.');
  }

  async function runAssignWorker() {
    setAssignLoading(true);
    setError(null);

    const result = await assignWorkerToSchedule({
      scheduleId: activeSchedule.id,
      workerId: assignWorkerId,
    });

    if (result.error) {
      setError(result.error.message);
      setAssignLoading(false);
      return;
    }

    setAssignWorkerId('');
    await loadDetail();
    setAssignLoading(false);
    setSuccess('Pekerja ditugaskan.');
  }

  const showWorkerHeadings = activeSchedule.tasks.length > 1;

  return (
    <Screen
      header={
        // TANPA tombol titik-tiga. Ia tombol ikon-saja — dilarang aturan desain
        // proyek ini — dan tiga titik tidak berarti apa-apa bagi pengguna lanjut
        // usia yang belum pernah memakai aplikasi lain yang memakainya. Aksinya
        // sekarang tombol lebar berlabel di bawah layar.
        <TopAppBar title="Detail Jadwal" onBack={() => router.back()} />
      }
      // Hanya aksi yang BERLAKU yang dirender; tidak ada satu pun tombol dalam
      // keadaan mati. Tombol mati yang tidak menanggapi ketukan lebih
      // membingungkan daripada tombol yang tidak ada, dan chip status di atas
      // sudah menjelaskan kenapa.
      //
      //   sekali   + belum ada hasil kerja -> Edit jadwal
      //   berulang + belum ada hasil kerja -> Edit jadwal, Hentikan pengulangan
      //   berulang + sudah ada hasil kerja -> Hentikan pengulangan
      //   sekali   + sudah ada hasil kerja -> tidak ada
      //   dibatalkan                       -> tidak ada
      //
      // Kedua syaratnya sudah ada dan SENGAJA TIDAK SAMA: isLocked mengunci
      // Edit, tapi canStopRepeat tidak ikut terkunci hasil kerja. Jadwal
      // berulang yang tugas pertamanya sudah selesai justru saat paling wajar
      // owner ingin menyetop rantainya — kalau ikut terkunci, rantainya jalan
      // selamanya.
      stickyFooter={
        showEditButton || canStopRepeat ? (
          <View style={{ gap: tokens.space.sm }}>
            {showEditButton ? (
              <Button
                title="Edit jadwal"
                variant="primary"
                onPress={() => router.push(`/owner/schedules/${activeSchedule.id}/edit`)}
              />
            ) : null}
            {canStopRepeat ? (
              <Button
                loading={stopRepeatLoading}
                title="Hentikan pengulangan"
                variant="secondary"
                onPress={handleRequestStopRepeat}
              />
            ) : null}
          </View>
        ) : undefined
      }
    >
      <ConfirmDialog
        confirmLabel="Hentikan pengulangan"
        loading={stopRepeatLoading}
        message="Jadwal ini tetap dikerjakan seperti biasa — hanya kelanjutannya yang berhenti, jadi tidak ada jadwal baru yang dibuat setelah tugasnya selesai."
        title="Hentikan pengulangan?"
        tone="default"
        visible={stopRepeatConfirmOpen}
        onCancel={() => setStopRepeatConfirmOpen(false)}
        onConfirm={runStopRepeat}
      />

      <ErrorBanner message={error} />
      <SuccessBanner message={success} />

      <View style={{ gap: spacing.sm }}>
        <View style={{ alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' }}>
          <Text
            selectable
            style={{
              color: colors.primaryDark,
              flex: 1,
              fontSize: typography.h2.fontSize,
              fontWeight: '600',
              lineHeight: typography.h2.lineHeight,
            }}
          >
            {activeSchedule.title}
          </Text>
          <View style={{ alignItems: 'center', flexDirection: 'row', flexShrink: 0, gap: spacing.sm }}>
            <Badge label={formatScheduleStatus(activeSchedule)} tone={getScheduleTone(activeSchedule)} />
            {activeSchedule.requiresPhoto ? <ProofPhotoIndicator /> : null}
          </View>
        </View>
        <Text selectable style={{ color: colors.textMuted, fontSize: 14, lineHeight: 20 }}>
          {`${formatCareCategory(activeSchedule.category)} · ${formatCareTarget(activeSchedule)}`}
        </Text>
        {/* Tanggal dan pekerja jadi SATU baris meta redup, menggantikan grid dua
            kolom "Tanggal | Pekerja" yang dulu ada di bawah. Sebelumnya tanggal
            muncul dua kali di satu layar: sekali di chip tempo, sekali lagi di
            grid. Chip tempo tetap ada — ia menyatakan TUNGGAKAN ("Terlambat 3
            hari"), bukan tanggal. */}
        <Text selectable style={{ color: colors.textMuted, fontSize: 14, lineHeight: 20 }}>
          {`${formatDate(activeSchedule.scheduledDate)} · ${formatScheduleWorkers(activeSchedule, workerNames)}`}
        </Text>
      </View>

      {activeSchedule.targetType === 'tree' ? (
        <TargetTreeCodeList
          targetTreeCodes={activeSchedule.targetTreeCodes}
          targetTreeId={activeSchedule.targetTreeId}
        />
      ) : null}

      {needsWorker ? (
        <AssignWorkerNotice
          loading={assignLoading}
          onAssign={runAssignWorker}
          onSelectWorker={setAssignWorkerId}
          selectedWorkerId={assignWorkerId}
          workers={activeWorkers}
        />
      ) : null}

      {/* Chip tempo dan chip pengulangan SEBARIS. Kartu penjelasan rantai yang
          dulu berdiri sendiri di atas — latar hijau tipis, dua kalimat tentang
          bagaimana tanggal berikutnya dihitung — dipangkas jadi chip ini saja.
          Kedua kalimatnya menjelaskan mekanisme internal dan tidak mengubah satu
          pun keputusan yang bisa diambil owner dari layar ini. */}
      <View style={{ gap: spacing.xs }}>
        <View style={{ alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          <DueDatePillView pill={pill} />
          {isRecurring ? <RepeatChip repeatEveryDays={activeSchedule.repeatEveryDays} /> : null}
        </View>
        {activeSchedule.isCancelled && activeSchedule.cancelReason ? (
          <Text selectable style={{ color: colors.textMuted, fontSize: 13, lineHeight: 18 }}>
            {`Alasan: ${activeSchedule.cancelReason}`}
          </Text>
        ) : null}
      </View>

      {/* Section "Instruksi" tidak dirender sama sekali kalau kosong. Teks
          "Belum ada instruksi tambahan." adalah judul section yang menjelaskan
          bahwa section itu tidak punya isi — dua baris untuk menyampaikan
          ketiadaan. */}
      {activeSchedule.instruction ? (
        <View style={{ gap: spacing.xs }}>
          <Text selectable style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>
            Instruksi
          </Text>
          <Text selectable style={{ color: colors.textMuted, lineHeight: 21 }}>
            {activeSchedule.instruction}
          </Text>
        </View>
      ) : null}

      {/* Tanpa tugas tidak ada hasil kerja yang mungkin ada — dulu heading ini
          tetap dirender lalu [].map() menyisakan judul yatim tanpa isi. */}
      {hasTasks ? (
        <View style={{ gap: spacing.md }}>
          <Text selectable style={{ color: colors.text, fontSize: typography.h3.fontSize, fontWeight: '700', lineHeight: typography.h3.lineHeight }}>
            Hasil kerja
          </Text>
          {activeSchedule.tasks.map((task) => {
            const activities = taskDetailMap[task.id]?.activities ?? [];
            const workerName = workerNames[task.assignedTo];

            return (
              <View key={task.id} style={{ gap: spacing.sm }}>
                {showWorkerHeadings ? (
                  <Text selectable style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>
                    {workerName ?? 'Pekerja tidak tersedia'}
                  </Text>
                ) : null}
                {/* Kotak putus-putus "Belum dicatat" diganti SATU baris teks.
                    Kotak sebesar itu memberi bobot visual pada ketiadaan, dan
                    di jadwal multi-pekerja ia terulang sekali per pekerja —
                    layar penuh kotak kosong yang semuanya mengatakan hal yang
                    sama. WorkResultList sendiri tidak diubah: ia masih dipakai
                    layar detail tugas owner yang di luar lingkup batch ini. */}
                {activities.length === 0 ? (
                  <Text selectable style={{ color: colors.textMuted, fontSize: 14, lineHeight: 20 }}>
                    {`${workerName ?? 'Pekerja'} belum mencatat.`}
                  </Text>
                ) : (
                  // Bentuk yang sama dengan layar detail tugas — pekerja maupun
                  // owner. Tanpa onFixLatestNote: baris di sisi owner murni baca.
                  //
                  // performerNames tidak dioper di sini karena nama pekerjanya
                  // sudah jadi judul blok (showWorkerHeadings); mengulanginya di
                  // tiap baris cuma bising.
                  <WorkResultList
                    activities={activities}
                    emptySubtitle=""
                    proofPhotoMap={proofPhotoMap}
                  />
                )}
              </View>
            );
          })}
        </View>
      ) : null}
    </Screen>
  );
}

// Blok penugasan untuk jadwal yang belum punya tugas. Pill pekerja memakai
// FormChipGroup yang sama dengan form Buat/Edit jadwal, bukan salinan gayanya.
function AssignWorkerNotice({
  loading,
  onAssign,
  onSelectWorker,
  selectedWorkerId,
  workers,
}: {
  loading: boolean;
  onAssign: () => void;
  onSelectWorker: (workerId: string) => void;
  selectedWorkerId: string;
  workers: WorkerMembership[];
}) {
  return (
    <View
      style={{
        backgroundColor: statusColors.warning.background,
        borderColor: statusColors.warning.border,
        borderCurve: 'continuous',
        borderRadius: radius.lg,
        borderWidth: 1,
        gap: spacing.md,
        padding: spacing.lg,
      }}
    >
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.sm }}>
        <Icon name="alert-triangle" size={18} color={statusColors.warning.text} />
        <Text selectable style={{ color: statusColors.warning.text, flex: 1, fontSize: 15, fontWeight: '700' }}>
          Belum ada pekerja
        </Text>
      </View>

      {/* Penyebabnya tidak bisa dipastikan dari data yang ada di layar ini —
          kalimatnya sengaja menyebut sebab yang paling mungkin tanpa mengklaim
          pasti. Lihat catatan di laporan Tahap D. */}
      <Text selectable style={{ color: colors.text, fontSize: 13, lineHeight: 19 }}>
        Jadwal ini belum ditugaskan ke siapa pun, jadi tidak muncul sebagai pekerjaan aktif. Ini biasanya
        terjadi kalau pekerja sebelumnya sudah keluar dari kebun saat jadwal ini dibuat.
      </Text>

      <FormChipGroup
        emptyText="Belum ada pekerja aktif. Setujui pekerja dulu sebelum menugaskan."
        label="Pilih pekerja"
        options={workers.map((worker) => ({ label: worker.fullName, value: worker.userId }))}
        selectedValue={selectedWorkerId}
        onSelect={onSelectWorker}
      />

      {workers.length > 0 ? (
        <Button
          disabled={!selectedWorkerId}
          loading={loading}
          title="Tugaskan"
          variant="primary"
          onPress={onAssign}
        />
      ) : null}
    </View>
  );
}

// Penanda rantai, dipangkas jadi chip sebaris dengan chip tempo.
//
// Menggantikan RecurringScheduleNotice: kartu bertint setinggi tiga baris yang
// berisi "Berulang tiap N hari", keterangan pangkal-atau-lanjutan, dan dua
// kalimat tentang bagaimana tanggal berikutnya dihitung. Yang tersisa hanyalah
// fakta yang mengubah keputusan owner — bahwa jadwal ini berulang, dan
// jaraknya. Sisanya mekanisme internal.
//
// Bentuknya sengaja sepadan dengan pil "Tiap N hari" di baris daftar jadwal
// (batch 1), supaya penanda yang sama terbaca sama di dua tempat.
function RepeatChip({ repeatEveryDays }: { repeatEveryDays: number | null }) {
  if (repeatEveryDays === null) {
    return null;
  }

  return (
    <View
      style={{
        alignItems: 'center',
        alignSelf: 'flex-start',
        backgroundColor: tokens.color.brand.soft,
        borderColor: tokens.color.brand.border,
        borderCurve: 'continuous',
        borderRadius: 10,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
      }}
    >
      <Icon name="repeat" size={14} color={tokens.color.brand.base} />
      <Text selectable style={{ color: tokens.color.brand.base, fontSize: 13, fontWeight: '700' }}>
        {`Tiap ${repeatEveryDays} hari`}
      </Text>
    </View>
  );
}

function DueDatePillView({ pill }: { pill: DueDatePill }) {
  const palette =
    pill.tone === 'warning'
      ? statusColors.warning
      : pill.tone === 'success'
        ? statusColors.success
        : statusColors.neutral;

  return (
    <View
      style={{
        alignItems: 'center',
        alignSelf: 'flex-start',
        backgroundColor: palette.background,
        borderColor: palette.border,
        borderCurve: 'continuous',
        borderRadius: 10,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
      }}
    >
      <Icon name="calendar" size={14} color={palette.text} />
      <Text selectable style={{ color: palette.text, fontSize: 13, fontWeight: '700' }}>
        {pill.label}
      </Text>
    </View>
  );
}

function ProofPhotoIndicator() {
  return (
    <View
      accessibilityLabel="Perlu bukti foto"
      style={{
        alignItems: 'center',
        backgroundColor: colors.warningBg,
        borderColor: colors.warningBorder,
        borderCurve: 'continuous',
        borderRadius: 999,
        borderWidth: 1,
        height: 26,
        justifyContent: 'center',
        width: 26,
      }}
    >
      <CameraGlyph color={colors.warning} />
    </View>
  );
}

// getActivityTone() dan WorkResultCard dihapus: bentuk baris hasil kerja kini
// milik WorkResultList, dipakai bersama layar pekerja.

function formatScheduleStatus(schedule: CareScheduleDetail): string {
  if (schedule.isCancelled) {
    return 'Jadwal dibatalkan';
  }

  if (schedule.tasks.length === 0) {
    return 'Belum ada tugas';
  }

  if (schedule.tasks.every((task) => task.status === 'completed')) {
    return 'Selesai';
  }

  if (schedule.tasks.some((task) => task.status === 'postponed')) {
    return 'Ditunda';
  }

  // "Belum dikerjakan", bukan "Belum". Satu kata itu tidak berdiri sendiri —
  // belum apa? Bagi pembaca yang tidak sedang menebak-nebak konteks chip, kata
  // kerjanya harus ikut.
  return 'Belum dikerjakan';
}

function getScheduleTone(schedule: CareScheduleDetail): 'danger' | 'muted' | 'success' | 'warning' {
  if (schedule.isCancelled) {
    return 'danger';
  }

  if (schedule.tasks.length === 0) {
    return 'muted';
  }

  if (schedule.tasks.every((task) => task.status === 'completed')) {
    return 'success';
  }

  if (schedule.tasks.some((task) => task.status === 'postponed')) {
    return 'warning';
  }

  return 'muted';
}

// Menentukan `isLocked`, yang mematikan "Edit jadwal" DAN "Batalkan jadwal" di
// sheet Kelola jadwal — jadi inilah aturan yang benar-benar terlihat di
// perangkat, bukan penjaga di sisi database.
//
// Sejak migrasi 052: hanya aktivitas ber-status 'completed' yang mengunci.
// Baris 'postponed' dulu ikut mengunci, sehingga tugas yang ditunda pekerja
// membuat owner kehabisan aksi sama sekali — tidak bisa mengedit, tidak bisa
// membatalkan, padahal pekerjaannya justru belum terjadi.
//
// Ini cerminan penjaga di cancel_care_schedule dan di
// getScheduleEditEligibilityFromDetail. Ketiganya harus bergerak bersama.
function scheduleHasWorkResult(
  schedule: CareScheduleDetail,
  taskDetailMap: Record<string, CareTaskDetail>
): boolean {
  return schedule.tasks.some((task) =>
    (taskDetailMap[task.id]?.activities ?? []).some((activity) => activity.status === 'completed')
  );
}

function formatScheduleWorkers(
  schedule: CareScheduleDetail,
  workerNames: Record<string, string>
): string {
  const names = Array.from(
    new Set(schedule.tasks.map((task) => workerNames[task.assignedTo]).filter((name): name is string => Boolean(name)))
  );

  return names.length > 0 ? names.join(', ') : 'Belum ada pekerja';
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
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
