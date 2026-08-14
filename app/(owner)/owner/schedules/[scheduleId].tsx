import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { BottomSheet, ConfirmDialog } from '../../../../src/components/bottom-sheet';
import { FormChipGroup, formatCareTarget } from '../../../../src/components/care-schedule-components';
import { Icon, type IconName } from '../../../../src/components/icons';
import { WorkResultList } from '../../../../src/components/work-result-list';
import {
  Badge,
  Button,
  CameraGlyph,
  EmptyState,
  ErrorBanner,
  LoadingState,
  MetaRow,
  Screen,
  SuccessBanner,
  TopAppBar,
} from '../../../../src/components/ui';
import { colors, radius, spacing, statusColors, typography } from '../../../../src/constants/theme';
import { useAuth } from '../../../../src/context/auth-context';
import { consumePendingFeedback } from '../../../../src/lib/pendingFeedback';
import {
  assignWorkerToSchedule,
  cancelCareSchedule,
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
  const [cancelLoading, setCancelLoading] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [manageOpen, setManageOpen] = React.useState(false);
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
  const lockMessage = activeSchedule.isCancelled
    ? 'Jadwal ini sudah dibatalkan.'
    : 'Jadwal sudah punya hasil kerja dan tidak bisa diubah lagi.';

  const pill: DueDatePill = activeSchedule.isCancelled
    ? { tone: 'neutral', label: 'Jadwal dibatalkan' }
    : scheduleDueDatePill(activeSchedule, activeSchedule.tasks, getTodayIsoDate());

  // Sejak migration 041 jadwal boleh punya NOL tugas: penerus rantai dibuat
  // tanpa tugas kalau pekerjanya sudah keluar dari kebun saat itu.
  const hasTasks = activeSchedule.tasks.length > 0;
  const needsWorker = !hasTasks && activeSchedule.isCancelled !== true;
  const isRecurring = activeSchedule.repeatEveryDays !== null;
  const canStopRepeat = isRecurring && activeSchedule.isCancelled !== true;

  function handleRequestCancel() {
    // §5.4: sheet "Kelola jadwal" ditutup dulu (pemanggil memanggil onClose),
    // beri jeda agar animasi tutupnya selesai sebelum ConfirmDialog muncul —
    // supaya tidak ada dua overlay bertumpuk sekaligus.
    setTimeout(() => setConfirmOpen(true), 260);
  }

  async function runCancelSchedule() {
    setCancelLoading(true);
    setError(null);

    const result = await cancelCareSchedule({
      scheduleId: activeSchedule.id,
    });

    if (result.error) {
      setError(result.error.message);
      setCancelLoading(false);
      setConfirmOpen(false);
      return;
    }

    await loadDetail();
    setCancelLoading(false);
    setConfirmOpen(false);
  }

  function handleRequestStopRepeat() {
    // Pola yang sama dengan handleRequestCancel: tunggu sheet menutup dulu.
    setTimeout(() => setStopRepeatConfirmOpen(true), 260);
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
        <TopAppBar
          title="Detail Jadwal"
          onBack={() => router.back()}
          right={
            <Pressable
              accessibilityLabel="Kelola jadwal"
              accessibilityRole="button"
              hitSlop={{ bottom: 8, left: 8, right: 8, top: 8 }}
              onPress={() => setManageOpen(true)}
              style={{
                alignItems: 'center',
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderCurve: 'continuous',
                borderRadius: 11,
                borderWidth: 1,
                height: 32,
                justifyContent: 'center',
                width: 32,
              }}
            >
              <Icon name="dots" size={20} color={colors.primary} />
            </Pressable>
          }
        />
      }
    >
      <ManageScheduleSheet
        cancelDisabled={cancelLoading}
        canStopRepeat={canStopRepeat}
        locked={isLocked}
        lockMessage={lockMessage}
        stopRepeatDisabled={stopRepeatLoading}
        visible={manageOpen}
        onClose={() => setManageOpen(false)}
        onCancelSchedule={handleRequestCancel}
        onEditSchedule={() => router.push(`/owner/schedules/${activeSchedule.id}/edit`)}
        onStopRepeat={handleRequestStopRepeat}
      />

      <ConfirmDialog
        confirmLabel="Batalkan jadwal"
        loading={cancelLoading}
        message={buildCancelConfirmMessage(activeSchedule, workerNames)}
        title="Batalkan jadwal?"
        tone="danger"
        visible={confirmOpen}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={runCancelSchedule}
      />

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
      </View>

      {needsWorker ? (
        <AssignWorkerNotice
          loading={assignLoading}
          onAssign={runAssignWorker}
          onSelectWorker={setAssignWorkerId}
          selectedWorkerId={assignWorkerId}
          workers={activeWorkers}
        />
      ) : null}

      {isRecurring ? <RecurringScheduleNotice schedule={activeSchedule} /> : null}

      <View style={{ gap: spacing.xs }}>
        <DueDatePillView pill={pill} />
        {activeSchedule.isCancelled && activeSchedule.cancelReason ? (
          <Text selectable style={{ color: colors.textMuted, fontSize: 13, lineHeight: 18 }}>
            {`Alasan: ${activeSchedule.cancelReason}`}
          </Text>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <MetaRow label="Tanggal" value={formatDate(activeSchedule.scheduledDate)} />
        </View>
        <View style={{ flex: 1 }}>
          <MetaRow label="Pekerja" value={formatScheduleWorkers(activeSchedule, workerNames)} />
        </View>
      </View>

      <View style={{ gap: spacing.xs }}>
        <Text selectable style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>
          Instruksi
        </Text>
        <Text selectable style={{ color: colors.textMuted, lineHeight: 21 }}>
          {activeSchedule.instruction || 'Belum ada instruksi tambahan.'}
        </Text>
      </View>

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
                {/* Bentuk yang sama dengan layar detail tugas — pekerja maupun
                    owner. Tanpa onFixLatestNote: baris di sisi owner murni baca.

                    performerNames tidak dioper di sini karena nama pekerjanya
                    sudah jadi judul blok (showWorkerHeadings); mengulanginya di
                    tiap baris cuma bising. */}
                <WorkResultList
                  activities={activities}
                  emptySubtitle={`${workerName ?? 'Pekerja'} belum menyelesaikan atau menunda tugas ini.`}
                  proofPhotoMap={proofPhotoMap}
                />
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

// Informasi rantai. Posisi urut (ke-berapa dalam rantai) TIDAK ditampilkan
// karena butuh query baru ke care_schedules by series_id; yang bisa dihitung
// murni dari data di layar hanyalah apakah jadwal ini pangkal rantai atau
// lanjutan, lewat parentScheduleId.
function RecurringScheduleNotice({ schedule }: { schedule: CareScheduleDetail }) {
  const isChainStart = schedule.parentScheduleId === null;

  return (
    <View
      style={{
        backgroundColor: colors.primarySoft,
        borderColor: colors.primaryBorder,
        borderCurve: 'continuous',
        borderRadius: radius.lg,
        borderWidth: 1,
        gap: spacing.xs,
        padding: spacing.lg,
      }}
    >
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.sm }}>
        <Icon name="calendar" size={18} color={colors.primary} />
        <Text selectable style={{ color: colors.text, flex: 1, fontSize: 15, fontWeight: '700' }}>
          {`Berulang tiap ${schedule.repeatEveryDays} hari`}
        </Text>
      </View>
      <Text selectable style={{ color: colors.textMuted, fontSize: 13, lineHeight: 19 }}>
        {isChainStart ? 'Jadwal pertama dalam rantai ini.' : 'Lanjutan dari jadwal sebelumnya.'}
      </Text>
      <Text selectable style={{ color: colors.textMuted, fontSize: 13, lineHeight: 19 }}>
        Tanggal jadwal berikutnya dihitung dari tanggal tugas ini diselesaikan, bukan dari tanggal yang
        tertulis di jadwal.
      </Text>
    </View>
  );
}

function ManageScheduleSheet({
  cancelDisabled,
  canStopRepeat,
  locked,
  lockMessage,
  onCancelSchedule,
  onClose,
  onEditSchedule,
  onStopRepeat,
  stopRepeatDisabled,
  visible,
}: {
  cancelDisabled: boolean;
  canStopRepeat: boolean;
  locked: boolean;
  lockMessage: string;
  onCancelSchedule: () => void;
  onClose: () => void;
  onEditSchedule: () => void;
  onStopRepeat: () => void;
  stopRepeatDisabled: boolean;
  visible: boolean;
}) {
  return (
    <BottomSheet title="Kelola jadwal" visible={visible} onClose={onClose}>
      <View style={{ gap: spacing.sm }}>
        {locked ? (
          <Text selectable style={{ color: colors.textMuted, fontSize: 13, lineHeight: 18 }}>
            {lockMessage}
          </Text>
        ) : null}
        <ManageScheduleRow
          disabled={locked}
          icon="calendar"
          label="Edit jadwal"
          onPress={() => {
            onClose();
            onEditSchedule();
          }}
        />
        {/* Sengaja TIDAK terkunci oleh `locked`: jadwal yang sudah punya hasil
            kerja tetap boleh dihentikan rantainya — itu justru saat paling wajar
            owner ingin menyetopnya. Yang dikunci hanya edit & batal. */}
        {canStopRepeat ? (
          <ManageScheduleRow
            description="Jadwal ini tetap dikerjakan, hanya kelanjutannya berhenti"
            disabled={stopRepeatDisabled}
            icon="x"
            label="Hentikan pengulangan"
            onPress={() => {
              onClose();
              onStopRepeat();
            }}
          />
        ) : null}
        <ManageScheduleRow
          description="Jadwal ini dibatalkan dan tugasnya tidak lagi aktif"
          disabled={locked || cancelDisabled}
          icon="x"
          label="Batalkan jadwal"
          tone="danger"
          onPress={() => {
            onClose();
            onCancelSchedule();
          }}
        />
      </View>
    </BottomSheet>
  );
}

function ManageScheduleRow({
  description,
  disabled,
  icon,
  label,
  onPress,
  tone = 'default',
}: {
  // Dipakai untuk membedakan "Hentikan pengulangan" dari "Batalkan jadwal" —
  // dua aksi yang artinya jauh berbeda dan tidak boleh tertukar.
  description?: string;
  disabled: boolean;
  icon: IconName;
  label: string;
  onPress: () => void;
  tone?: 'default' | 'danger';
}) {
  const textColor = disabled ? colors.textSoft : tone === 'danger' ? colors.danger : colors.text;
  const iconColor = disabled ? colors.textSoft : tone === 'danger' ? colors.danger : colors.primary;
  const circleColor = disabled ? colors.surfaceMuted : tone === 'danger' ? colors.dangerBg : colors.primarySoft;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={{
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderCurve: 'continuous',
        borderRadius: radius.lg,
        borderWidth: 1,
        flexDirection: 'row',
        gap: spacing.md,
        padding: spacing.md,
      }}
    >
      <View
        style={{
          alignItems: 'center',
          backgroundColor: circleColor,
          borderRadius: radius.round,
          height: 38,
          justifyContent: 'center',
          width: 38,
        }}
      >
        <Icon name={icon} size={20} color={iconColor} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text selectable style={{ color: textColor, fontSize: 16, fontWeight: '700' }}>
          {label}
        </Text>
        {description ? (
          <Text selectable style={{ color: colors.textMuted, fontSize: 12, lineHeight: 16 }}>
            {description}
          </Text>
        ) : null}
      </View>
      {disabled ? null : <Icon name="chevron-right" size={20} color={colors.textSoft} />}
    </Pressable>
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

  return 'Belum';
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

// Kalimatnya dirakit, bukan satu template: tanpa pekerja, menyisipkan
// formatScheduleWorkers() menghasilkan "...pekerjaan aktif untuk Belum ada
// pekerja." Jadwal berulang juga wajib disebut supaya owner tahu membatalkan
// ikut menghentikan rantainya.
function buildCancelConfirmMessage(
  schedule: CareScheduleDetail,
  workerNames: Record<string, string>
): string {
  const workerNamesList = Array.from(
    new Set(schedule.tasks.map((task) => workerNames[task.assignedTo]).filter((name): name is string => Boolean(name)))
  );

  const lead =
    schedule.tasks.length === 0
      ? 'Jadwal ini belum punya tugas, jadi tidak ada pekerjaan aktif yang dibatalkan.'
      : workerNamesList.length > 0
        ? `Tugas dari jadwal ini tidak lagi muncul sebagai pekerjaan aktif untuk ${workerNamesList.join(', ')}.`
        : 'Tugas dari jadwal ini tidak lagi muncul sebagai pekerjaan aktif.';

  const repeatNote =
    schedule.repeatEveryDays !== null
      ? ' Pengulangannya ikut berhenti, jadi tidak ada jadwal lanjutan yang dibuat.'
      : '';

  return `${lead}${repeatNote} Tindakan ini tidak bisa dibatalkan.`;
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
