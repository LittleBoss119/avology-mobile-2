import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { colors, radius, spacing, tokens } from '../constants/theme';
import { useAuth } from '../context/auth-context';
import { getOperationalReportFollowUpTasks } from '../services/careTaskService';
import { getFarmMemberBasicProfiles } from '../services/memberService';
import { listOperationalReportPhotos } from '../services/photoAttachmentService';
import {
  closeReport,
  getOperationalReportDetail,
  handleReportMyself,
  markReportAlreadyResolved,
  rejectReport,
} from '../services/operationalReportService';
import type {
  CareTaskDetail,
  FarmMemberBasicProfile,
  OperationalReport,
  OperationalReportStatus,
} from '../types/domain';
import type { PhotoAttachmentPreviewItem } from '../types/media';
import {
  formatDateOnly,
  formatOperationalReportCategory,
  formatOperationalReportStatus,
} from '../utils/displayFormat';
import { BottomSheet, SheetActionRow } from './bottom-sheet';
import { formatTaskStatus, getTaskTone } from './care-schedule-components';
import { Icon } from './icons';
import { ReportPhotoCard } from './operational-report-photo-field';
import { getReportStatusTone } from './operational-report-common';
import {
  formatOwnerReportResolution,
  getOwnerReportActions,
  type OwnerReportAction,
  type OwnerReportActionKey,
} from './operational-report-owner-actions';
import { useSnackbar } from './snackbar';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  LoadingState,
  MetaRow,
  Screen,
  SectionHeader,
  TopAppBar,
} from './ui';

export function OwnerOperationalReportDetailScreen({ reportId }: { reportId?: string }) {
  const { currentFarm } = useAuth();
  const showSnackbar = useSnackbar();

  const [error, setError] = React.useState<string | null>(null);
  const [followUpTasks, setFollowUpTasks] = React.useState<CareTaskDetail[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [report, setReport] = React.useState<OperationalReport | null>(null);
  const [reportPhotos, setReportPhotos] = React.useState<PhotoAttachmentPreviewItem[]>([]);
  const [workerNames, setWorkerNames] = React.useState<Record<string, string>>({});

  // Sheet daftar aksi (langkah 1) dan sheet konfirmasi (langkah 2) sengaja
  // saling eksklusif: keduanya RN Modal, jadi tidak boleh terbuka bersamaan.
  const [actionSheetOpen, setActionSheetOpen] = React.useState(false);
  const [pendingAction, setPendingAction] = React.useState<OwnerReportAction | null>(null);

  const farmId = currentFarm?.farmId;

  const loadDetail = React.useCallback(async () => {
    const normalizedReportId = reportId?.trim();

    if (!normalizedReportId) {
      setError('Data laporan tidak ditemukan.');
      setFollowUpTasks([]);
      setReport(null);
      setWorkerNames({});
      return;
    }

    if (!farmId || currentFarm?.role !== 'owner' || currentFarm.status !== 'active') {
      setError('Hanya pemilik aktif yang dapat melihat detail laporan operasional.');
      setFollowUpTasks([]);
      setReport(null);
      setWorkerNames({});
      return;
    }

    setError(null);

    const [reportResult, workersResult, tasksResult, photosResult] = await Promise.all([
      getOperationalReportDetail({ operationalReportId: normalizedReportId }),
      getFarmMemberBasicProfiles(farmId),
      getOperationalReportFollowUpTasks({ operationalReportId: normalizedReportId }),
      listOperationalReportPhotos({ farmId, operationalReportId: normalizedReportId }),
    ]);

    // Owner boleh MEMBACA foto laporan (RLS can_access_operational_report_photo),
    // tapi tidak boleh menambah atau menghapusnya.
    setReportPhotos(
      photosResult.error
        ? []
        : photosResult.data.map((photo) => ({
            id: photo.attachment.id,
            url: photo.signedUrl,
          }))
    );

    if (reportResult.error) {
      setError(reportResult.error.message);
      setReport(null);
    } else {
      setReport(reportResult.data);
    }

    if (tasksResult.error) {
      setError(tasksResult.error.message);
      setFollowUpTasks([]);
    } else {
      setFollowUpTasks(tasksResult.data);
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
  }, [currentFarm?.role, currentFarm?.status, farmId, reportId]);

  useFocusEffect(
    React.useCallback(() => {
      setLoading(true);
      loadDetail().finally(() => setLoading(false));
    }, [loadDetail])
  );

  // Dipilih DARI DALAM sheet pemilihan, jadi ada overlay yang harus menutup dulu.
  function handleSelectAction(action: OwnerReportAction) {
    setActionSheetOpen(false);

    // Buat tugas tetap lewat rute penuh — formnya terlalu besar untuk sheet.
    // Navigasi tidak memunculkan overlay kedua, jadi tidak perlu jeda.
    if (action.key === 'create_task') {
      if (report) {
        router.push(`/owner/reports/${report.id}/task`);
      }

      return;
    }

    // Beri jeda agar animasi tutup sheet pemilihan selesai sebelum sheet
    // konfirmasi muncul, supaya tidak ada dua overlay bertumpuk (pola yang sama
    // dipakai di detail laporan pekerja dan detail jadwal).
    setTimeout(() => setPendingAction(action), 260);
  }

  // Pintasan satu-aksi: sheet PEMILIHAN tidak pernah dibuka, jadi tidak ada
  // overlay yang harus menutup lebih dulu dan tidak ada jeda yang perlu
  // ditunggu. Langkah berikutnya sama persis dengan jalur lewat sheet —
  // termasuk sheet konfirmasi beserta catatan yang ter-prefill.
  function startActionDirectly(action: OwnerReportAction) {
    if (action.key === 'create_task') {
      if (report) {
        router.push(`/owner/reports/${report.id}/task`);
      }

      return;
    }

    setPendingAction(action);
  }

  async function handleConfirmAction(action: OwnerReportAction, note: string) {
    if (!report) {
      return 'Data laporan tidak ditemukan.';
    }

    // Kontrak catatan: keempat aksi ini PUNYA field catatan, jadi isinya
    // dikirim apa adanya. String kosong berarti owner memang ingin menghapus
    // catatan lama — bukan "tidak diisi".
    const result =
      action.key === 'self_handled'
        ? await handleReportMyself({ note, operationalReportId: report.id })
        : action.key === 'already_ok'
          ? await markReportAlreadyResolved({ note, operationalReportId: report.id })
          : action.key === 'reject'
            ? await rejectReport({ operationalReportId: report.id, reason: note })
            : await closeReport({
                currentResolution: report.resolution,
                note,
                operationalReportId: report.id,
              });

    if (result.error) {
      return result.error.message;
    }

    setPendingAction(null);
    showSnackbar(action.confirm?.successMessage ?? 'Laporan diperbarui.');

    // Muat ulang tanpa menyalakan LoadingState: layarnya tetap terlihat,
    // konfirmasi sudah diberikan lewat snackbar.
    await loadDetail();

    return null;
  }

  if (loading) {
    return <LoadingState message="Memuat detail laporan..." />;
  }

  if (!report) {
    return (
      <Screen header={<TopAppBar title="Detail Laporan" onBack={() => router.back()} />}>
        <ErrorBanner message={error} />
        <EmptyState title="Laporan tidak ditemukan" subtitle="Laporan mungkin tidak tersedia atau akses ditolak." />
      </Screen>
    );
  }

  const hasOpenTask = followUpTasks.some(
    (task) => task.status === 'pending' || task.status === 'postponed'
  );
  const allTasksCompleted =
    followUpTasks.length > 0 && followUpTasks.every((task) => task.status === 'completed');
  const actions = getOwnerReportActions({
    hasOpenTask,
    resolution: report.resolution,
    status: report.status,
  });

  // Penutup loop: tugas sudah beres semua tapi laporannya masih terbuka.
  // Tanpa banner ini owner harus ingat sendiri untuk menutup.
  const shouldPromptClose =
    report.status === 'in_progress' && report.resolution === 'task' && allTasksCompleted;

  return (
    <Screen
      header={<TopAppBar title="Detail Laporan" onBack={() => router.back()} />}
      stickyFooter={
        actions.length > 0 ? (
          <Button
            title={getPrimaryActionLabel(report.status, actions)}
            onPress={() => {
              // Satu aksi saja berarti tidak ada yang perlu dipilih: sheet
              // pemilihan dilewati dan owner langsung sampai ke langkah
              // berikutnya. Status 'new' dikecualikan — di sana sheet tetap
              // dibuka apa adanya.
              if (report.status !== 'new' && actions.length === 1) {
                startActionDirectly(actions[0]);
                return;
              }

              setActionSheetOpen(true);
            }}
          />
        ) : undefined
      }
    >
      <ErrorBanner message={error} />

      <ReportHeaderCard report={report} reporterName={workerNames[report.reportedBy]} />

      <ReportPhotoCard photos={reportPhotos} />

      {shouldPromptClose ? (
        <Card variant="highlight">
          <Text selectable style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>
            Tugas tindak lanjut sudah selesai
          </Text>
          <Text selectable style={{ color: colors.textMuted, lineHeight: 21 }}>
            Tinjau hasil kerjanya, lalu tandai laporan ini selesai supaya tidak menggantung.
          </Text>
        </Card>
      ) : null}

      {report.respondedAt ? <ReportDecisionCard report={report} /> : null}

      {followUpTasks.length > 0 ? (
        <View style={{ gap: spacing.md }}>
          <SectionHeader title="Tugas tindak lanjut" />
          <View style={{ gap: spacing.md }}>
            {followUpTasks.map((task) => (
              <FollowUpTaskRow
                key={task.id}
                task={task}
                workerName={workerNames[task.assignedTo]}
                onPress={() => router.push(`/owner/tasks/${task.id}`)}
              />
            ))}
          </View>
        </View>
      ) : null}

      <OwnerReportActionSheet
        actions={actions}
        status={report.status}
        onClose={() => setActionSheetOpen(false)}
        onSelect={handleSelectAction}
        visible={actionSheetOpen}
      />

      <OwnerReportConfirmSheet
        action={pendingAction}
        initialNote={report.ownerResponseNote ?? ''}
        onClose={() => setPendingAction(null)}
        onConfirm={handleConfirmAction}
      />
    </Screen>
  );
}

function ReportHeaderCard({
  report,
  reporterName,
}: {
  report: OperationalReport;
  reporterName?: string;
}) {
  const description = report.description?.trim();

  return (
    <Card variant="softGreen">
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' }}>
        <Badge label={formatOperationalReportCategory(report.category)} tone="info" />
        <Badge
          label={formatOperationalReportStatus(report.status)}
          tone={getReportStatusTone(report.status)}
        />
      </View>

      <Text selectable style={{ color: colors.text, fontSize: 22, fontWeight: '700', lineHeight: 28 }}>
        {description || formatOperationalReportCategory(report.category)}
      </Text>

      <View style={{ gap: spacing.sm }}>
        <MetaRow label="Pelapor" value={reporterName ?? 'Pelapor tidak tersedia'} />
        {report.locationNote ? <MetaRow label="Lokasi" value={report.locationNote} /> : null}
        <MetaRow label="Tanggal kirim" value={formatDateOnly(report.createdAt)} />
      </View>
    </Card>
  );
}

function ReportDecisionCard({ report }: { report: OperationalReport }) {
  return (
    <Card>
      <SectionHeader title="Keputusan kamu" />
      <View style={{ gap: spacing.sm }}>
        <MetaRow
          label="Tindak lanjut"
          value={formatOwnerReportResolution({
            resolution: report.resolution,
            status: report.status,
          })}
        />
        {report.respondedAt ? (
          <MetaRow label="Tanggal keputusan" value={formatDateOnly(report.respondedAt)} />
        ) : null}
      </View>
      {report.ownerResponseNote ? (
        <Text selectable style={{ color: colors.textMuted, lineHeight: 21 }}>
          {report.ownerResponseNote}
        </Text>
      ) : null}
    </Card>
  );
}

function FollowUpTaskRow({
  onPress,
  task,
  workerName,
}: {
  onPress: () => void;
  task: CareTaskDetail;
  workerName?: string;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      <Card padding={spacing.md}>
        <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.md }}>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Text
              selectable
              numberOfLines={2}
              style={{ color: colors.text, fontSize: 16, fontWeight: '700', lineHeight: 22 }}
            >
              {task.title}
            </Text>
            <Text selectable style={{ color: colors.textMuted, fontSize: 13, lineHeight: 18 }}>
              {`${workerName ?? 'Pekerja tidak tersedia'} · ${formatDateOnly(task.dueDate)}`}
            </Text>
          </View>
          <Badge label={formatTaskStatus(task.status)} maxWidth={96} tone={getTaskTone(task.status)} />
          <Icon name="chevron-right" size={tokens.icon.md} color={colors.textSoft} />
        </View>
      </Card>
    </Pressable>
  );
}

// Label tombol utama. Urutan cabangnya disengaja: status 'new' menang lebih
// dulu, karena di sana daftar aksinya selalu berisi empat dan cabang jumlah di
// bawahnya akan salah membacanya sebagai "ubah".
function getPrimaryActionLabel(
  status: OperationalReportStatus,
  actions: OwnerReportAction[]
): string {
  if (status === 'new') {
    return 'Tindak lanjuti laporan';
  }

  // Satu aksi: tombolnya menyebut aksi itu sendiri, jadi owner tahu persis apa
  // yang akan terjadi sebelum menekannya.
  return actions.length === 1 ? actions[0].title : 'Ubah tindak lanjut';
}

// Kelompok tampilan. Ini murni cara menyusun daftar di layar — aksi mana yang
// tersedia tetap sepenuhnya ditentukan getOwnerReportActions.
const TODO_ACTION_KEYS: OwnerReportActionKey[] = ['create_task', 'self_handled'];

function OwnerReportActionSheet({
  actions,
  onClose,
  onSelect,
  status,
  visible,
}: {
  actions: OwnerReportAction[];
  onClose: () => void;
  onSelect: (action: OwnerReportAction) => void;
  status: OperationalReportStatus;
  visible: boolean;
}) {
  const todoActions = actions.filter((action) => TODO_ACTION_KEYS.includes(action.key));
  const closingActions = actions.filter((action) => !TODO_ACTION_KEYS.includes(action.key));

  // Urutan kelompok mengikuti apa yang paling mungkin dipilih owner di keadaan
  // itu: pada 'new' aksi yang paling mungkin adalah membuat tugas, sedangkan
  // pada 'in_progress' pekerjaannya sudah jalan atau sudah diurus sendiri, jadi
  // yang paling mungkin adalah menutup laporan.
  const groups =
    status === 'new'
      ? [
          { actions: todoActions, title: 'Perlu dikerjakan' },
          { actions: closingActions, title: 'Tutup laporan' },
        ]
      : [
          { actions: closingActions, title: 'Tutup laporan' },
          { actions: todoActions, title: 'Perlu dikerjakan' },
        ];

  return (
    <BottomSheet
      onClose={onClose}
      subtitle="Pilih satu tindak lanjut untuk laporan ini."
      title="Tindak lanjuti laporan"
      visible={visible}
    >
      <View style={{ gap: spacing.md }}>
        {groups.map((group) =>
          // Judul kelompok kosong tidak dirender: pada laporan in_progress yang
          // masih punya tugas berjalan, "Perlu dikerjakan" memang tidak berisi
          // apa pun.
          group.actions.length === 0 ? null : (
            <View key={group.title} style={{ gap: spacing.sm }}>
              <SectionHeader title={group.title} />
              {group.actions.map((action) => (
                <SheetActionRow
                  key={action.key}
                  description={action.description}
                  icon={action.icon}
                  iconTone={
                    action.emphasis === 'primary'
                      ? 'brand'
                      : action.emphasis === 'danger'
                        ? 'danger'
                        : 'neutral'
                  }
                  title={action.title}
                  onPress={() => onSelect(action)}
                />
              ))}
            </View>
          )
        )}
      </View>
    </BottomSheet>
  );
}

function OwnerReportConfirmSheet({
  action,
  initialNote,
  onClose,
  onConfirm,
}: {
  action: OwnerReportAction | null;
  initialNote: string;
  // Mengembalikan pesan error, atau null kalau berhasil.
  onConfirm: (action: OwnerReportAction, note: string) => Promise<string | null>;
  onClose: () => void;
}) {
  const [note, setNote] = React.useState(initialNote);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Field catatan hidup selama sheet konfirmasi terbuka saja. Setiap kali aksi
  // berganti, isinya di-reset ke catatan owner yang tersimpan (prefill).
  React.useEffect(() => {
    if (action) {
      setNote(initialNote);
      setError(null);
      setSubmitting(false);
    }
  }, [action, initialNote]);

  const confirm = action?.confirm ?? null;
  const isDanger = action?.emphasis === 'danger';
  const canSubmit = !confirm?.noteRequired || note.trim().length > 0;

  async function handleConfirm() {
    if (!action || submitting) {
      return;
    }

    setSubmitting(true);
    setError(null);

    const message = await onConfirm(action, note);

    setSubmitting(false);

    // Sheet sengaja TIDAK ditutup saat gagal: errornya ditampilkan di dalam
    // sheet supaya owner tidak kehilangan apa yang sudah diketik.
    if (message) {
      setError(message);
    }
  }

  return (
    <BottomSheet
      onClose={submitting ? () => undefined : onClose}
      title={confirm?.title ?? ''}
      visible={Boolean(action && confirm)}
    >
      <View style={{ gap: spacing.md }}>
        <Text selectable style={{ color: colors.textMuted, lineHeight: 21 }}>
          {confirm?.consequence}
        </Text>

        <ErrorBanner message={error} />

        <View style={{ gap: 7 }}>
          <Text selectable style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>
            {confirm?.noteLabel}
          </Text>
          <TextInput
            multiline
            editable={!submitting}
            onChangeText={setNote}
            placeholder={confirm?.notePlaceholder}
            placeholderTextColor={colors.textSoft}
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderCurve: 'continuous',
              borderRadius: radius.md,
              borderWidth: 1,
              color: colors.text,
              fontSize: 16,
              minHeight: 104,
              paddingHorizontal: spacing.lg,
              paddingTop: spacing.md,
              textAlignVertical: 'top',
            }}
            value={note}
          />
        </View>

        <Button
          disabled={!canSubmit}
          loading={submitting}
          title={confirm?.confirmLabel ?? 'Simpan'}
          variant={isDanger ? 'danger' : 'primary'}
          onPress={handleConfirm}
        />
        <Button
          disabled={submitting}
          title="Batal"
          variant="secondary"
          onPress={onClose}
        />
      </View>
    </BottomSheet>
  );
}

