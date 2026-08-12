import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { getSelectableOperationalReportCategories } from '../constants/operationalReport';
import { colors, radius, spacing, tokens } from '../constants/theme';
import { useAuth } from '../context/auth-context';
import { getOperationalReportFollowUpTasks } from '../services/careTaskService';
import { getFarmMemberBasicProfiles } from '../services/memberService';
import {
  deleteOperationalReportPhoto,
  listOperationalReportPhotos,
  listTaskProofPhotosForActivities,
  uploadOperationalReportPhoto,
} from '../services/photoAttachmentService';
import {
  createOperationalReport,
  deleteOwnOperationalReport,
  getOperationalReportEditEligibility,
  getOperationalReportEditEligibilityFromReport,
  getOperationalReportDetail,
  updateOwnOperationalReport,
} from '../services/operationalReportService';
import type {
  ActivityStatus,
  CareTaskDetail,
  FarmMemberBasicProfile,
  OperationalReport,
} from '../types/domain';
import type { PhotoAttachmentPreviewItem, PickedPhotoAsset, TaskProofPhotoMap } from '../types/media';
import {
  formatActivityStatus,
  formatCareCategory,
  formatOperationalReportCategory,
  formatOperationalReportStatus,
} from '../utils/displayFormat';
import { BottomSheet, ConfirmDialog, SheetActionRow } from './bottom-sheet';
import { formatCareTarget, formatTaskStatus, getTaskTone } from './care-schedule-components';
import { Icon } from './icons';
import {
  formatReportDate,
  formatReportDateTime,
  getReportStatusTone,
} from './operational-report-common';
import {
  clearResolvedOperationalReportFormErrors,
  EMPTY_OPERATIONAL_REPORT_FORM,
  hasOperationalReportFormErrors,
  OperationalReportForm,
  validateOperationalReportForm,
  type OperationalReportFormErrors,
  type OperationalReportFormValues,
} from './operational-report-form';
import {
  getReportPhotoKey,
  ReportPhotoCard,
  type ReportPhotoItem,
} from './operational-report-photo-field';
import { useSnackbar } from './snackbar';
import { TaskProofPhotoPreview } from './task-proof-photo';
import {
  appTheme,
  Badge,
  Button,
  CameraGlyph,
  Card,
  EmptyState,
  ErrorBanner,
  LoadingState,
  MetaRow,
  Screen,
  SectionHeader,
  TopAppBar,
} from './ui';

// ---------------------------------------------------------------------------
// Buat laporan
// ---------------------------------------------------------------------------

export function WorkerCreateOperationalReportScreen() {
  const { currentFarm } = useAuth();
  const showSnackbar = useSnackbar();

  const [values, setValues] = React.useState<OperationalReportFormValues>(
    EMPTY_OPERATIONAL_REPORT_FORM
  );
  const [errors, setErrors] = React.useState<OperationalReportFormErrors>({});
  const [error, setError] = React.useState<string | null>(null);
  const [photos, setPhotos] = React.useState<ReportPhotoItem[]>([]);
  const [submitting, setSubmitting] = React.useState(false);

  function handleValuesChange(next: OperationalReportFormValues) {
    setValues(next);
    setErrors((prev) => clearResolvedOperationalReportFormErrors(prev, next));
  }

  async function handleSubmit() {
    if (submitting) {
      return;
    }

    if (!currentFarm?.farmId || currentFarm.role !== 'worker' || currentFarm.status !== 'active') {
      setError('Hanya pekerja aktif yang dapat membuat laporan operasional.');
      return;
    }

    const nextErrors = validateOperationalReportForm(values);

    if (hasOperationalReportFormErrors(nextErrors)) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setSubmitting(true);
    setError(null);

    const result = await createOperationalReport({
      // Aman: validateOperationalReportForm memastikan kategori sudah dipilih.
      category: values.category!,
      description: values.description,
      farmId: currentFarm.farmId,
      locationNote: values.locationNote,
    });

    if (result.error) {
      setError(result.error.message);
      setSubmitting(false);
      return;
    }

    // Laporan HARUS ada dulu: policy upload memverifikasi entity_id ke tabel
    // operational_reports. Jadi foto baru diunggah setelah insert berhasil,
    // satu per satu, dengan reportId yang baru didapat.
    const reportId = result.data.reportId;
    let failedUploads = 0;

    for (const item of photos) {
      if (item.kind !== 'pending') {
        continue;
      }

      const uploadResult = await uploadOperationalReportPhoto({
        base64: item.asset.base64,
        farmId: currentFarm.farmId,
        fileName: item.asset.fileName,
        localUri: item.asset.uri,
        mimeType: item.asset.mimeType,
        operationalReportId: reportId,
      });

      if (uploadResult.error) {
        failedUploads += 1;
      }
    }

    setSubmitting(false);

    // Foto laporan opsional: kegagalan unggah TIDAK membatalkan laporan.
    // Laporan tanpa foto jauh lebih berguna daripada laporan yang hilang.
    showSnackbar(
      failedUploads > 0
        ? `Laporan terkirim, ${failedUploads} foto gagal diunggah.`
        : 'Laporan terkirim.'
    );
    router.replace('/worker/reports');
  }

  return (
    <Screen
      header={<TopAppBar title="Buat Laporan" onBack={() => router.back()} />}
      stickyFooter={
        <Button
          title="Kirim laporan"
          disabled={submitting}
          loading={submitting}
          onPress={handleSubmit}
        />
      }
    >
      <ErrorBanner message={error} />
      <OperationalReportForm
        // Laporan baru hanya boleh memakai kategori yang masih ditawarkan.
        categories={getSelectableOperationalReportCategories()}
        errors={errors}
        photoBusy={submitting}
        photos={photos}
        values={values}
        onAddPhoto={(asset: PickedPhotoAsset) =>
          setPhotos((current) => [...current, { asset, kind: 'pending' }])
        }
        onChange={handleValuesChange}
        onRemovePhoto={(item) =>
          setPhotos((current) => current.filter((photo) => getReportPhotoKey(photo) !== getReportPhotoKey(item)))
        }
      />
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Edit laporan
// ---------------------------------------------------------------------------

export function WorkerEditOperationalReportScreen({ reportId }: { reportId?: string }) {
  const { currentFarm } = useAuth();
  const showSnackbar = useSnackbar();

  const [blockedReason, setBlockedReason] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [errors, setErrors] = React.useState<OperationalReportFormErrors>({});
  const [loading, setLoading] = React.useState(true);
  const [photoBusy, setPhotoBusy] = React.useState(false);
  const [photoError, setPhotoError] = React.useState<string | null>(null);
  const [photos, setPhotos] = React.useState<ReportPhotoItem[]>([]);
  const [report, setReport] = React.useState<OperationalReport | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [values, setValues] = React.useState<OperationalReportFormValues>(
    EMPTY_OPERATIONAL_REPORT_FORM
  );

  const farmId = currentFarm?.farmId;

  React.useEffect(() => {
    let isMounted = true;

    async function loadReport() {
      const normalizedReportId = reportId?.trim();

      if (!normalizedReportId) {
        setError('Data laporan tidak ditemukan.');
        setLoading(false);
        return;
      }

      if (!farmId || currentFarm?.role !== 'worker' || currentFarm.status !== 'active') {
        setError('Akses pekerja tidak aktif.');
        setLoading(false);
        return;
      }

      setError(null);
      setBlockedReason(null);

      const [reportResult, eligibilityResult, photosResult] = await Promise.all([
        getOperationalReportDetail({ operationalReportId: normalizedReportId }),
        getOperationalReportEditEligibility({ operationalReportId: normalizedReportId }),
        listOperationalReportPhotos({ farmId, operationalReportId: normalizedReportId }),
      ]);

      if (!isMounted) {
        return;
      }

      setPhotos(
        photosResult.error
          ? []
          : photosResult.data.map((photo) => ({
              kind: 'existing' as const,
              photoId: photo.attachment.id,
              url: photo.signedUrl,
            }))
      );

      if (reportResult.error) {
        setError(reportResult.error.message);
        setLoading(false);
        return;
      }

      if (reportResult.data.reportedBy !== currentFarm.userId) {
        setError('Hanya pembuat laporan yang bisa mengedit laporan ini.');
        setLoading(false);
        return;
      }

      setReport(reportResult.data);
      setValues({
        category: reportResult.data.category,
        description: reportResult.data.description ?? '',
        locationNote: reportResult.data.locationNote ?? '',
      });

      if (eligibilityResult.error) {
        setBlockedReason(eligibilityResult.error.message);
      } else if (!eligibilityResult.data.canEdit) {
        setBlockedReason(eligibilityResult.data.reason ?? 'Laporan ini tidak bisa diedit.');
      }

      setLoading(false);
    }

    loadReport();

    return () => {
      isMounted = false;
    };
  }, [currentFarm?.role, currentFarm?.status, currentFarm?.userId, farmId, reportId]);

  function handleValuesChange(next: OperationalReportFormValues) {
    setValues(next);
    setErrors((prev) => clearResolvedOperationalReportFormErrors(prev, next));
  }

  // Di layar Edit laporannya sudah ada, jadi unggah dan hapus langsung jalan
  // tanpa menunggu tombol simpan.
  async function handleAddPhoto(asset: PickedPhotoAsset) {
    if (!report || !farmId || photoBusy) {
      return;
    }

    setPhotoBusy(true);
    setPhotoError(null);

    const result = await uploadOperationalReportPhoto({
      base64: asset.base64,
      farmId,
      fileName: asset.fileName,
      localUri: asset.uri,
      mimeType: asset.mimeType,
      operationalReportId: report.id,
    });

    if (result.error) {
      setPhotoError(result.error.message);
      setPhotoBusy(false);
      return;
    }

    setPhotos((current) => [
      ...current,
      { kind: 'existing', photoId: result.data.attachment.id, url: result.data.signedUrl },
    ]);
    setPhotoBusy(false);
  }

  async function handleRemovePhoto(item: ReportPhotoItem) {
    if (item.kind !== 'existing' || photoBusy) {
      return;
    }

    setPhotoBusy(true);
    setPhotoError(null);

    const result = await deleteOperationalReportPhoto({ photoId: item.photoId });

    if (result.error) {
      setPhotoError(result.error.message);
      setPhotoBusy(false);
      return;
    }

    setPhotos((current) => current.filter((photo) => getReportPhotoKey(photo) !== getReportPhotoKey(item)));
    setPhotoBusy(false);
  }

  async function handleSubmit() {
    if (!report) {
      setError('Data laporan tidak ditemukan.');
      return;
    }

    if (blockedReason) {
      setError(blockedReason);
      return;
    }

    const nextErrors = validateOperationalReportForm(values);

    if (hasOperationalReportFormErrors(nextErrors)) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setSubmitting(true);
    setError(null);

    const result = await updateOwnOperationalReport({
      category: values.category!,
      description: values.description,
      locationNote: values.locationNote,
      operationalReportId: report.id,
    });

    if (result.error) {
      setError(result.error.message);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    showSnackbar('Perubahan tersimpan.');
    router.replace(`/worker/reports/${report.id}`);
  }

  if (loading) {
    return <LoadingState message="Memuat laporan..." />;
  }

  if (!report) {
    return (
      <Screen header={<TopAppBar title="Edit laporan" onBack={() => router.back()} />}>
        <ErrorBanner message={error} />
        <EmptyState
          title="Laporan tidak ditemukan"
          subtitle="Laporan mungkin tidak tersedia atau akses ditolak."
        />
      </Screen>
    );
  }

  if (blockedReason) {
    return (
      <Screen header={<TopAppBar title="Edit laporan" onBack={() => router.back()} />}>
        <ErrorBanner message={error} />
        <Card variant="warning">
          <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: '700' }}>
            Laporan tidak bisa diedit
          </Text>
          <Text selectable style={{ color: colors.textMuted, lineHeight: 21 }}>
            {blockedReason}
          </Text>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen
      header={<TopAppBar title="Edit laporan" onBack={() => router.back()} />}
      stickyFooter={
        <Button
          title="Simpan perubahan"
          disabled={submitting || photoBusy}
          loading={submitting}
          onPress={handleSubmit}
        />
      }
    >
      <ErrorBanner message={error} />
      <OperationalReportForm
        // Kategori laporan yang sedang diedit ikut disertakan kalau ia sudah
        // tidak ditawarkan lagi, supaya laporan lama tidak tampil seolah belum
        // memilih kategori dan pilihannya tidak hilang saat disimpan.
        categories={getSelectableOperationalReportCategories(report.category)}
        errors={errors}
        photoBusy={photoBusy}
        photoError={photoError}
        photos={photos}
        values={values}
        onAddPhoto={handleAddPhoto}
        onChange={handleValuesChange}
        onRemovePhoto={handleRemovePhoto}
      />
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Detail laporan
// ---------------------------------------------------------------------------

export function WorkerOperationalReportDetailScreen({ reportId }: { reportId?: string }) {
  const { currentFarm } = useAuth();
  const showSnackbar = useSnackbar();

  const [canEdit, setCanEdit] = React.useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [followUpTasks, setFollowUpTasks] = React.useState<CareTaskDetail[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [memberNames, setMemberNames] = React.useState<Record<string, string>>({});
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [proofPhotoMap, setProofPhotoMap] = React.useState<TaskProofPhotoMap>({});
  const [report, setReport] = React.useState<OperationalReport | null>(null);
  const [reportPhotos, setReportPhotos] = React.useState<PhotoAttachmentPreviewItem[]>([]);

  const farmId = currentFarm?.farmId;

  const loadDetail = React.useCallback(async () => {
    const normalizedReportId = reportId?.trim();

    if (!normalizedReportId) {
      setError('Data laporan tidak ditemukan.');
      setFollowUpTasks([]);
      setReport(null);
      setMemberNames({});
      return;
    }

    if (!farmId || currentFarm?.role !== 'worker' || currentFarm.status !== 'active') {
      setError('Hanya pekerja aktif yang dapat melihat detail laporan operasional.');
      setFollowUpTasks([]);
      setReport(null);
      setMemberNames({});
      return;
    }

    setError(null);

    // Empat permintaan paralel. Sebelumnya laporan dimuat dulu baru tugas
    // secara serial, jadi detail pekerja selalu satu round-trip lebih lambat
    // daripada detail owner tanpa alasan.
    //
    // Eligibility TIDAK ikut di sini. Sejak ia jadi fungsi murni, jawabannya
    // bisa dihitung dari baris laporan yang baru saja dimuat ditambah userId
    // yang sudah dipegang sesi — dulu cabang kelima di sini mengambil ULANG
    // laporan yang sama (plus farm_members dan auth.getUser) hanya untuk itu.
    const [reportResult, membersResult, tasksResult, photosResult] =
      await Promise.all([
        getOperationalReportDetail({ operationalReportId: normalizedReportId }),
        getFarmMemberBasicProfiles(farmId),
        getOperationalReportFollowUpTasks({ operationalReportId: normalizedReportId }),
        listOperationalReportPhotos({ farmId, operationalReportId: normalizedReportId }),
      ]);

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
      setCanEdit(false);
    } else if (reportResult.data.reportedBy !== currentFarm.userId) {
      setError('Laporan tidak ditemukan atau bukan laporan milik Anda.');
      setReport(null);
      setCanEdit(false);
    } else {
      setReport(reportResult.data);

      // Guard hapus di RPC identik dengan guard edit ditambah cek pembuat, dan
      // pembuat sudah diperiksa di atas — jadi satu flag ini menentukan kedua
      // aksi: tombol "Ubah laporan" di footer dan "Hapus laporan" di menu.
      setCanEdit(
        getOperationalReportEditEligibilityFromReport(reportResult.data, currentFarm.userId).canEdit
      );
    }

    if (tasksResult.error) {
      setFollowUpTasks([]);
      setProofPhotoMap({});
    } else {
      setFollowUpTasks(tasksResult.data);

      const activityIds = tasksResult.data.flatMap((task) =>
        task.activities.map((activity) => activity.id)
      );

      // Tanpa aktivitas tidak ada bukti foto yang bisa diminta. Permintaan
      // dengan daftar id kosong cuma menambah satu round-trip yang jawabannya
      // sudah pasti kosong — dan ini jalur serial, jadi ongkosnya terasa.
      if (activityIds.length === 0) {
        setProofPhotoMap({});
      } else {
        // Pekerja boleh membaca bukti fotonya sendiri (RLS
        // can_access_task_proof_photo mengizinkan pelaku tugas).
        const proofResult = await listTaskProofPhotosForActivities({
          activityIds,
          farmId,
        });

        setProofPhotoMap(proofResult.error ? {} : proofResult.data);
      }
    }

    if (membersResult.error) {
      setMemberNames({});
    } else {
      setMemberNames(
        Object.fromEntries(
          membersResult.data.map((member: FarmMemberBasicProfile) => [
            member.userId,
            member.fullName,
          ])
        )
      );
    }
  }, [currentFarm?.role, currentFarm?.status, currentFarm?.userId, farmId, reportId]);

  useFocusEffect(
    React.useCallback(() => {
      setLoading(true);
      loadDetail().finally(() => setLoading(false));
    }, [loadDetail])
  );

  function openDeleteConfirm() {
    setMenuOpen(false);
    // Beri jeda agar animasi tutup sheet selesai sebelum dialog muncul, supaya
    // tidak ada dua overlay bertumpuk (pola yang sama dipakai di detail jadwal).
    setTimeout(() => setConfirmDeleteOpen(true), 260);
  }

  async function runDelete() {
    if (!report || !farmId) {
      return;
    }

    setDeleting(true);
    setError(null);

    // Service sudah menangani urutan wajib: objek storage dulu, baru RPC.
    const result = await deleteOwnOperationalReport({
      farmId,
      operationalReportId: report.id,
    });

    if (result.error) {
      setDeleting(false);
      setConfirmDeleteOpen(false);
      setError(result.error.message);
      return;
    }

    setDeleting(false);
    setConfirmDeleteOpen(false);
    showSnackbar('Laporan dihapus.');
    router.replace('/worker/reports');
  }

  if (loading) {
    return <LoadingState message="Memuat detail laporan..." />;
  }

  if (!report) {
    return (
      <Screen header={<TopAppBar title="Detail Laporan" onBack={() => router.back()} />}>
        <ErrorBanner message={error} />
        <EmptyState
          title="Laporan tidak ditemukan"
          subtitle="Laporan mungkin tidak tersedia atau akses ditolak."
        />
      </Screen>
    );
  }

  return (
    <Screen
      header={
        <TopAppBar
          title="Detail Laporan"
          onBack={() => router.back()}
          // Menu hanya dirender kalau memang ada isinya. Tombol yang membuka
          // menu kosong lebih membingungkan daripada tidak ada tombol.
          right={
            canEdit ? (
              <Button
                accessibilityLabel="Aksi laporan"
                icon={<Icon name="dots" size={20} color={colors.primary} />}
                size="small"
                variant="icon"
                onPress={() => setMenuOpen(true)}
              />
            ) : undefined
          }
        />
      }
      // "Ubah laporan" naik ke footer: ikon tiga titik tidak terbaca sebagai
      // tombol oleh pengguna sasaran, jadi aksi yang paling sering dipakai tidak
      // boleh bersembunyi di sana. "Hapus laporan" sengaja TETAP di menu —
      // aksi merusak tidak boleh sedangkal satu ketukan.
      stickyFooter={
        canEdit ? (
          <Button
            title="Ubah laporan"
            onPress={() => router.push(`/worker/reports/${report.id}/edit`)}
          />
        ) : undefined
      }
    >
      <ErrorBanner message={error} />

      <ReportHeaderCard report={report} />

      {canEdit ? (
        <Text selectable style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 18 }}>
          Masih bisa diedit selama pemilik belum merespons.
        </Text>
      ) : null}

      <ReportPhotoCard photos={reportPhotos} />

      <OwnerResponseCard
        ownerName={report.respondedBy ? memberNames[report.respondedBy] : undefined}
        report={report}
      />

      <WorkerFollowUpSection
        memberNames={memberNames}
        proofPhotoMap={proofPhotoMap}
        report={report}
        tasks={followUpTasks}
      />

      <BottomSheet onClose={() => setMenuOpen(false)} title="Aksi laporan" visible={menuOpen}>
        <View style={{ gap: spacing.sm }}>
          <SheetActionRow
            icon="x"
            iconTone="danger"
            title="Hapus laporan"
            onPress={openDeleteConfirm}
          />
        </View>
      </BottomSheet>

      <ConfirmDialog
        confirmLabel="Hapus laporan"
        loading={deleting}
        message="Laporan yang dihapus tidak bisa dikembalikan."
        title="Hapus laporan ini?"
        tone="danger"
        visible={confirmDeleteOpen}
        onCancel={() => setConfirmDeleteOpen(false)}
        onConfirm={runDelete}
      />
    </Screen>
  );
}

function ReportHeaderCard({ report }: { report: OperationalReport }) {
  return (
    <Card variant="softGreen">
      <View
        style={{
          alignItems: 'center',
          flexDirection: 'row',
          gap: spacing.sm,
          justifyContent: 'space-between',
        }}
      >
        <Badge label={formatOperationalReportCategory(report.category)} tone="info" />
        <Badge
          label={formatOperationalReportStatus(report.status)}
          tone={getReportStatusTone(report.status)}
        />
      </View>

      <Text selectable style={{ color: colors.text, fontSize: 22, fontWeight: '700', lineHeight: 28 }}>
        {report.description?.trim() || formatOperationalReportCategory(report.category)}
      </Text>

      <View style={{ gap: spacing.sm }}>
        {report.locationNote ? <MetaRow label="Lokasi" value={report.locationNote} /> : null}
        <MetaRow label="Tanggal kirim" value={formatReportDateTime(report.createdAt)} />
      </View>
    </Card>
  );
}

// Kartu respons pemilik. Membaca report.resolution langsung — sebelumnya
// pesannya ditebak dari jumlah tugas yang terlihat, yang salah begitu tugasnya
// ditugaskan ke pekerja lain (RLS menyembunyikannya dari pelapor).
function OwnerResponseCard({
  ownerName,
  report,
}: {
  ownerName?: string;
  report: OperationalReport;
}) {
  if (report.status === 'new') {
    return (
      <Card>
        <SectionHeader title="Respons pemilik" />
        <Text selectable style={{ color: colors.textSecondary, lineHeight: 21 }}>
          Belum ada respons. Laporan sudah masuk ke daftar pemilik.
        </Text>
      </Card>
    );
  }

  const isRejected = report.status === 'rejected';

  return (
    <Card variant={isRejected ? 'danger' : 'default'}>
      <SectionHeader title={isRejected ? 'Alasan penolakan' : 'Respons pemilik'} />

      <View style={{ gap: spacing.sm }}>
        <MetaRow label="Pemilik" value={ownerName ?? 'Pemilik tidak tersedia'} />
        {report.respondedAt ? (
          <MetaRow label="Tanggal respons" value={formatReportDateTime(report.respondedAt)} />
        ) : null}
        <MetaRow label="Tindak lanjut" value={formatWorkerResolutionMessage(report)} />
      </View>

      {report.ownerResponseNote ? (
        <Text selectable style={{ color: colors.textSecondary, lineHeight: 21 }}>
          {report.ownerResponseNote}
        </Text>
      ) : null}
    </Card>
  );
}

function formatWorkerResolutionMessage(report: OperationalReport): string {
  const { resolution, status } = report;

  // Tidak ada cabang 'new' di sini: OwnerResponseCard sudah return lebih dulu
  // untuk status itu, jadi fungsi ini tidak pernah dipanggil dengannya.
  if (status === 'rejected') {
    return 'Laporan ditolak';
  }

  if (status === 'in_progress') {
    return resolution === 'task' ? 'Dibuatkan tugas tindak lanjut' : 'Pemilik mengurus sendiri';
  }

  if (resolution === 'task') {
    return 'Selesai setelah tugas tindak lanjut';
  }

  if (resolution === 'self_handled') {
    return 'Selesai, diurus pemilik';
  }

  return 'Ditandai sudah beres';
}

function WorkerFollowUpSection({
  memberNames,
  proofPhotoMap,
  report,
  tasks,
}: {
  memberNames: Record<string, string>;
  proofPhotoMap: TaskProofPhotoMap;
  report: OperationalReport;
  tasks: CareTaskDetail[];
}) {
  // Tidak ada bagian tugas sama sekali kalau keputusannya bukan "buat tugas".
  // Empty state "Belum ada tugas tindak lanjut" yang dulu muncul di semua
  // status itu salah: untuk self_handled/already_ok memang tidak akan pernah
  // ada tugas, jadi menampilkannya cuma bikin laporan terasa menggantung.
  if (report.resolution !== 'task') {
    return null;
  }

  return (
    <View style={{ gap: spacing.md }}>
      <SectionHeader title="Tugas tindak lanjut" />

      {tasks.length === 0 ? (
        // Policy care_tasks hanya mengizinkan pekerja melihat tugas yang
        // di-assign ke dirinya. Kalau owner menugaskannya ke pekerja lain,
        // daftar ini kosong padahal tugasnya ADA — jangan bilang "belum ada".
        <EmptyState
          icon="user"
          subtitle="Tugas tindak lanjut laporan ini tidak ditugaskan kepadamu, jadi rinciannya tidak terbuka."
          title="Dikerjakan pekerja lain"
          variant="dashed"
        />
      ) : (
        <View style={{ gap: spacing.md }}>
          {tasks.map((task) => (
            <WorkerFollowUpTaskCard
              key={task.id}
              memberNames={memberNames}
              proofPhotoMap={proofPhotoMap}
              task={task}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function WorkerFollowUpTaskCard({
  memberNames,
  proofPhotoMap,
  task,
}: {
  memberNames: Record<string, string>;
  proofPhotoMap: TaskProofPhotoMap;
  task: CareTaskDetail;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={() => router.push(`/worker/tasks/${task.id}`)}>
      <Card padding={spacing.md}>
        <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.sm }}>
          <Text
            selectable
            numberOfLines={2}
            style={{ color: colors.text, flex: 1, fontSize: 16, fontWeight: '700', lineHeight: 22 }}
          >
            {task.title}
          </Text>
          <Badge label={formatTaskStatus(task.status)} maxWidth={96} tone={getTaskTone(task.status)} />
          <Icon name="chevron-right" size={tokens.icon.md} color={colors.textSoft} />
        </View>

        <View style={{ alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
          {task.category ? <Badge label={formatCareCategory(task.category)} tone="success" /> : null}
          {task.requiresPhoto ? <PhotoIndicator /> : null}
        </View>

        <View style={{ gap: spacing.sm }}>
          <MetaRow label="Tanggal tugas" value={formatReportDate(task.dueDate)} />
          <MetaRow label="Target" value={formatCareTarget(task)} />
        </View>

        {task.activities.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            <Text selectable style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>
              Hasil kerja
            </Text>
            {task.activities.map((activity) => (
              <View
                key={activity.id}
                style={{
                  backgroundColor: appTheme.primarySoft,
                  borderColor: colors.primaryBorder,
                  borderRadius: radius.sm,
                  borderWidth: 1,
                  gap: spacing.sm,
                  padding: 11,
                }}
              >
                <View style={{ flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' }}>
                  <Text selectable style={{ color: colors.text, flex: 1, fontWeight: '700' }}>
                    {formatReportDateTime(activity.performedAt)}
                  </Text>
                  <Badge
                    label={formatActivityStatus(activity.status)}
                    maxWidth={110}
                    tone={getActivityTone(activity.status)}
                  />
                </View>
                <MetaRow
                  label="Pelaksana"
                  value={memberNames[activity.performedBy] ?? 'Pekerja tidak tersedia'}
                />
                <MetaRow label="Catatan" value={activity.note || '-'} />
                {activity.status === 'completed' ? (
                  <TaskProofPhotoPreview
                    emptyText={task.requiresPhoto ? 'Bukti foto belum diunggah.' : undefined}
                    photo={proofPhotoMap[activity.id]}
                  />
                ) : null}
              </View>
            ))}
          </View>
        ) : (
          // Dulu <Text> polos yang tidak terbaca sebagai keadaan kosong.
          // Varian 'dashed' dipakai karena tugas ini memang menunggu diisi.
          <EmptyState
            icon="clipboard"
            subtitle="Pekerja belum mencatat apa pun untuk tugas ini."
            title="Belum dicatat"
            variant="dashed"
          />
        )}
      </Card>
    </Pressable>
  );
}

function PhotoIndicator() {
  return (
    <View
      style={{
        alignItems: 'center',
        backgroundColor: colors.successBg,
        borderColor: colors.successBorder,
        borderRadius: radius.round,
        borderWidth: 1,
        height: 28,
        justifyContent: 'center',
        width: 28,
      }}
    >
      <CameraGlyph color={colors.success} />
    </View>
  );
}

function getActivityTone(status: ActivityStatus): 'success' | 'warning' {
  return status === 'completed' ? 'success' : 'warning';
}
