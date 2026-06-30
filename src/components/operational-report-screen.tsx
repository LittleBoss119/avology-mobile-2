import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { Alert, Image, Modal, Pressable, Text, TextInput, View } from 'react-native';

import { colors, radius, spacing, typography } from '../constants/theme';
import { useAuth } from '../context/auth-context';
import { pickImageFromGallery, takePhotoFromCamera } from '../lib/media';
import {
  createTaskFromOperationalReport,
  getOperationalReportFollowUpTasks,
} from '../services/careTaskService';
import { getActiveWorkers, getFarmMemberBasicProfiles } from '../services/memberService';
import {
  getOperationalReportPhotos,
  listTaskProofPhotosForActivities,
  listOperationalReportPhotosForReports,
  uploadOperationalReportPhoto,
} from '../services/photoAttachmentService';
import {
  createOperationalReport,
  getOperationalReportEditEligibility,
  getOperationalReportDetail,
  getOperationalReports,
  updateOwnOperationalReport,
  updateOperationalReportStatus,
} from '../services/operationalReportService';
import { getTrees } from '../services/treeService';
import type {
  CreateTaskFromOperationalReportInput,
  ActivityStatus,
  CareTaskDetail,
  FarmMemberBasicProfile,
  OperationalReport,
  OperationalReportCategory,
  OperationalReportStatus,
  TargetType,
  TaskStatus,
  Tree,
  WorkerMembership,
} from '../types/domain';
import type {
  OperationalReportPhoto,
  OperationalReportPhotoMap,
  PickedPhotoAsset,
  TaskProofPhotoMap,
} from '../types/media';
import {
  formatCareTarget,
  ProofRequirementToggle,
  formatTaskStatus,
} from './care-schedule-components';
import { formatCareCategory } from './care-sop-components';
import { TaskProofPhotoPreview } from './task-proof-photo';
import {
  formatOperationalReportCategory,
  formatTargetType,
} from '../utils/displayFormat';
import { formatTreeLocation } from '../utils/treeFormat';
import {
  appTheme,
  Badge,
  Button,
  Card,
  ChipButton,
  CompactMetaItem,
  DateField,
  EmptyState,
  ErrorBanner,
  Field,
  FormSection,
  LoadingState,
  MetaRow,
  PhotoPickerCard,
  Screen,
  SearchFilterRow,
  SectionHeader,
  SuccessBanner,
  TopAppBar,
} from './ui';

const operationalReportCategoryOptions: OperationalReportCategory[] = [
  'land_damage',
  'broken_tool',
  'out_of_stock',
  'area_pest_disease',
  'disaster_weather',
  'worker_need',
  'other',
];

const operationalReportStatusOptions: OperationalReportStatus[] = [
  'new',
  'in_progress',
  'resolved',
  'rejected',
];

type OperationalReportStatusFilter = 'all' | OperationalReportStatus;
type OperationalReportCategoryFilter = 'all' | OperationalReportCategory;

function canCreateTaskFromReportStatus(status: OperationalReportStatus): boolean {
  return status !== 'resolved' && status !== 'rejected';
}

function getClosedReportTaskMessage(status: OperationalReportStatus): string {
  if (status === 'resolved') {
    return 'Laporan yang sudah selesai tidak dapat dibuatkan tugas tindak lanjut.';
  }

  return 'Laporan yang ditolak tidak dapat dibuatkan tugas tindak lanjut.';
}

export function WorkerCreateOperationalReportScreen() {
  const { currentFarm } = useAuth();
  const [category, setCategory] = React.useState<OperationalReportCategory | null>(null);
  const [description, setDescription] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [locationNote, setLocationNote] = React.useState('');
  const [pendingOperationalReportId, setPendingOperationalReportId] = React.useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = React.useState<PickedPhotoAsset | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [success, setSuccess] = React.useState<string | null>(null);
  const redirectTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (redirectTimer.current) {
        clearTimeout(redirectTimer.current);
      }
    };
  }, []);

  async function handleSubmit() {
    if (!currentFarm?.farmId || currentFarm.role !== 'worker' || currentFarm.status !== 'active') {
      setError('Hanya pekerja aktif yang dapat membuat laporan operasional.');
      return;
    }

    if (pendingOperationalReportId) {
      await retryPendingPhotoUpload(pendingOperationalReportId);
      return;
    }

    if (!category) {
      setError('Kategori laporan wajib dipilih.');
      return;
    }

    if (!locationNote.trim() && !description.trim()) {
      setError('Isi lokasi atau deskripsi laporan.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    const result = await createOperationalReport({
      category,
      description,
      farmId: currentFarm.farmId,
      locationNote,
    });

    if (result.error) {
      setError(result.error.message);
      setSubmitting(false);
      return;
    }

    if (selectedPhoto) {
      const photoUploaded = await uploadSelectedPhoto(result.data.reportId);

      if (!photoUploaded) {
        setPendingOperationalReportId(result.data.reportId);
        setSubmitting(false);
        setError(
          'Laporan tersimpan, tetapi foto gagal diunggah. Tekan Kirim Laporan lagi untuk mencoba unggah foto.'
        );
        return;
      }
    }

    setSelectedPhoto(null);
    finishOperationalReport();
  }

  async function retryPendingPhotoUpload(reportId: string) {
    if (!currentFarm?.farmId || currentFarm.role !== 'worker' || currentFarm.status !== 'active') {
      setError('Hanya pekerja aktif yang dapat membuat laporan operasional.');
      return;
    }

    if (!selectedPhoto) {
      setPendingOperationalReportId(null);
      finishOperationalReport();
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    const photoUploaded = await uploadSelectedPhoto(reportId);

    if (!photoUploaded) {
      setSubmitting(false);
      setError(
        'Foto masih gagal diunggah. Periksa koneksi atau pilih ulang foto, lalu coba lagi.'
      );
      return;
    }

    setPendingOperationalReportId(null);
    setSelectedPhoto(null);
    finishOperationalReport();
  }

  async function uploadSelectedPhoto(reportId: string): Promise<boolean> {
    if (!currentFarm?.farmId || !selectedPhoto) {
      return true;
    }

    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.debug('[operational-photo-upload]', {
        assetId: selectedPhoto.assetId,
        base64Length: selectedPhoto.base64?.length ?? null,
        farmId: currentFarm.farmId,
        fileName: selectedPhoto.fileName,
        fileSize: selectedPhoto.fileSize,
        hasBase64: Boolean(selectedPhoto.base64),
        mimeType: selectedPhoto.mimeType,
        reportId,
        uriPrefix: selectedPhoto.uri.slice(0, 32),
      });
    }

    const photoResult = await uploadOperationalReportPhoto({
      base64: selectedPhoto.base64,
      farmId: currentFarm.farmId,
      fileName: selectedPhoto.fileName,
      localUri: selectedPhoto.uri,
      mimeType: selectedPhoto.mimeType,
      reportId,
    });

    if (photoResult.error && typeof __DEV__ !== 'undefined' && __DEV__) {
      console.warn('[operational-photo-upload-failed]', {
        code: photoResult.error.code ?? null,
        farmId: currentFarm.farmId,
        message: photoResult.error.message,
        rawMessage: photoResult.error.rawMessage ?? null,
        reportId,
      });
    }

    return !photoResult.error;
  }

  function finishOperationalReport() {
    if (redirectTimer.current) {
      clearTimeout(redirectTimer.current);
    }

    setSubmitting(false);
    setSuccess('Laporan operasional berhasil dikirim.');
    redirectTimer.current = setTimeout(() => {
      router.replace('/worker/reports');
    }, 900);
  }

  async function handlePickPhotoFromGallery() {
    const result = await pickImageFromGallery();

    if (result.error) {
      setError(result.error.message);
      return;
    }

    if (result.data) {
      setError(null);
      setSelectedPhoto(result.data);
    }
  }

  async function handleTakePhotoFromCamera() {
    const result = await takePhotoFromCamera();

    if (result.error) {
      setError(result.error.message);
      return;
    }

    if (result.data) {
      setError(null);
      setSelectedPhoto(result.data);
    }
  }

  return (
    <Screen
      footer={
        <>
          <Button title="Kirim Laporan" loading={submitting} onPress={handleSubmit} />
          <Button disabled={submitting} title="Batal" variant="secondary" onPress={() => router.back()} />
        </>
      }
    >
      <TopAppBar title="Buat Laporan" onBack={() => router.back()} />
      <ErrorBanner message={error} />
      <SuccessBanner message={success} />

      <FormSection
        title="Informasi Laporan"
        description="Pilih kategori, lalu isi lokasi atau catatan minimal salah satu."
      >
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {operationalReportCategoryOptions.map((option) => (
            <ChipButton
              key={option}
              active={category === option}
              label={formatOperationalReportCategory(option)}
              onPress={() => setCategory(option)}
            />
          ))}
        </View>

        <Field
          label="Target/Lokasi"
          onChangeText={setLocationNote}
          placeholder="Contoh: Gudang alat, Baris A, atau area dekat pompa"
          value={locationNote}
        />
      </FormSection>

      <FormSection
        title="Catatan Lapangan"
        description="Jelaskan kondisi lapangan, pekerjaan, atau masalah yang perlu diketahui pemilik."
      >
        <TextArea
          label="Catatan laporan"
          onChangeText={setDescription}
          placeholder="Contoh: Selang penyemprot pecah"
          value={description}
        />
      </FormSection>

      <OperationalReportPhotoPicker
        disabled={submitting}
        photo={selectedPhoto}
        onCameraPress={handleTakePhotoFromCamera}
        onGalleryPress={handlePickPhotoFromGallery}
        onRemove={() => setSelectedPhoto(null)}
      />
    </Screen>
  );
}

export function WorkerOperationalReportListScreen() {
  const { currentFarm } = useAuth();
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [photoMap, setPhotoMap] = React.useState<OperationalReportPhotoMap>({});
  const [reports, setReports] = React.useState<OperationalReport[]>([]);
  const [statusFilter, setStatusFilter] = React.useState<OperationalReportStatusFilter>('all');

  const farmId = currentFarm?.farmId;
  const filteredReports = React.useMemo(() => {
    if (statusFilter === 'all') {
      return reports;
    }

    return reports.filter((report) => report.status === statusFilter);
  }, [reports, statusFilter]);

  const loadReports = React.useCallback(async () => {
    if (!farmId || currentFarm?.role !== 'worker' || currentFarm.status !== 'active') {
      setError('Hanya pekerja aktif yang dapat melihat laporan operasional.');
      setPhotoMap({});
      setReports([]);
      return;
    }

    setError(null);

    const result = await getOperationalReports({
      farmId,
      reportedBy: currentFarm.userId,
    });

    if (result.error) {
      setError(result.error.message);
      setPhotoMap({});
      setReports([]);
      return;
    }

    setReports(result.data);
    const photoResult = await listOperationalReportPhotosForReports({
      farmId,
      reportIds: result.data.map((report) => report.id),
    });

    if (photoResult.error) {
      setPhotoMap({});
    } else {
      setPhotoMap(photoResult.data);
    }
  }, [currentFarm?.role, currentFarm?.status, currentFarm?.userId, farmId]);

  useFocusEffect(
    React.useCallback(() => {
      setLoading(true);
      loadReports().finally(() => setLoading(false));
    }, [loadReports])
  );

  if (loading) {
    return <LoadingState message="Memuat laporan operasional..." />;
  }

  return (
    <Screen
      stickyFooter={
        <Button title="Buat Laporan" onPress={() => router.push('/worker/reports/create')} />
      }
    >
      <ReportRootHeader
        roleLabel="Pekerja"
        title="Laporan"
        subtitle="Buat dan pantau laporan operasional kamu."
      />
      <ErrorBanner message={error} />

      <ReportSummary title="Laporan Saya" reports={reports} />

      <ReportStatusFilter selectedStatus={statusFilter} onSelect={setStatusFilter} />

      {filteredReports.length === 0 ? (
        <EmptyState
          title={reports.length === 0 ? 'Belum ada laporan' : 'Tidak ada laporan pada filter ini'}
          subtitle={
            reports.length === 0
              ? 'Buat laporan jika ada kondisi lapangan yang perlu diketahui pemilik.'
              : 'Tidak ada laporan yang cocok dengan filter ini.'
          }
        />
      ) : (
        <View style={{ gap: 12 }}>
          {filteredReports.map((report) => (
            <OperationalReportCard
              key={report.id}
              compactStatus
              hasPhoto={Boolean(photoMap[report.id])}
              report={report}
              onPress={() => router.push(`/worker/reports/${report.id}`)}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

export function WorkerOperationalReportDetailScreen({ reportId }: { reportId?: string }) {
  const { currentFarm } = useAuth();
  const [error, setError] = React.useState<string | null>(null);
  const [followUpTasks, setFollowUpTasks] = React.useState<CareTaskDetail[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [report, setReport] = React.useState<OperationalReport | null>(null);
  const [reportPhoto, setReportPhoto] = React.useState<OperationalReportPhoto | null>(null);
  const [reportPhotoPreviewOpen, setReportPhotoPreviewOpen] = React.useState(false);
  const [workerNames, setWorkerNames] = React.useState<Record<string, string>>({});

  const farmId = currentFarm?.farmId;

  const loadDetail = React.useCallback(async () => {
    const normalizedReportId = reportId?.trim();

    if (!normalizedReportId) {
      setError('Data laporan tidak ditemukan.');
      setFollowUpTasks([]);
      setReport(null);
      setReportPhoto(null);
      setWorkerNames({});
      return;
    }

    if (!farmId || currentFarm?.role !== 'worker' || currentFarm.status !== 'active') {
      setError('Hanya pekerja aktif yang dapat melihat detail laporan operasional.');
      setFollowUpTasks([]);
      setReport(null);
      setReportPhoto(null);
      setWorkerNames({});
      return;
    }

    setError(null);

    const [reportResult, workersResult] = await Promise.all([
      getOperationalReportDetail({ operationalReportId: normalizedReportId }),
      getFarmMemberBasicProfiles(farmId),
    ]);

    if (reportResult.error) {
      setError(reportResult.error.message);
      setFollowUpTasks([]);
      setReport(null);
      setReportPhoto(null);
    } else if (reportResult.data.reportedBy !== currentFarm.userId) {
      setError('Laporan tidak ditemukan atau bukan laporan milik Anda.');
      setFollowUpTasks([]);
      setReport(null);
      setReportPhoto(null);
    } else {
      setReport(reportResult.data);

      const [tasksResult, photoResult] = await Promise.all([
        getOperationalReportFollowUpTasks({
          operationalReportId: normalizedReportId,
        }),
        getOperationalReportPhotos({
          farmId: reportResult.data.farmId,
          reportId: reportResult.data.id,
        }),
      ]);

      if (tasksResult.error) {
        setError(tasksResult.error.message);
        setFollowUpTasks([]);
      } else {
        setFollowUpTasks(tasksResult.data);
      }

      if (photoResult.error) {
        setReportPhoto(null);
      } else {
        setReportPhoto(photoResult.data[0] ?? null);
      }
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
  }, [currentFarm?.role, currentFarm?.status, currentFarm?.userId, farmId, reportId]);

  useFocusEffect(
    React.useCallback(() => {
      setLoading(true);
      loadDetail().finally(() => setLoading(false));
    }, [loadDetail])
  );

  if (loading) {
    return <LoadingState message="Memuat detail laporan..." />;
  }

  if (!report) {
    return (
      <Screen>
        <TopAppBar title="Detail Laporan" onBack={() => router.back()} />
        <ErrorBanner message={error} />
        <EmptyState title="Laporan tidak ditemukan" subtitle="Laporan mungkin tidak tersedia atau akses ditolak." />
      </Screen>
    );
  }

  const canEditReport =
    report.status === 'new' &&
    !report.respondedAt &&
    !report.respondedBy &&
    !report.ownerResponseNote &&
    followUpTasks.length === 0;

  return (
    <Screen>
      <TopAppBar title="Detail Laporan" onBack={() => router.back()} />
      <ErrorBanner message={error} />

      <OperationalReportPhotoSection
        photo={reportPhoto}
        previewOpen={reportPhotoPreviewOpen}
        onClosePreview={() => setReportPhotoPreviewOpen(false)}
        onOpenPreview={() => setReportPhotoPreviewOpen(true)}
      />

      <ReportDetailSummaryCard report={report} />

      {canEditReport ? (
        <Card>
          <SectionHeader title="Edit laporan" />
          <Text selectable style={{ color: colors.textMuted, lineHeight: 21 }}>
            Laporan masih menunggu respons owner dan dapat diperbarui.
          </Text>
          <Button title="Edit laporan" onPress={() => router.push(`/worker/reports/${report.id}/edit`)} />
        </Card>
      ) : null}

      <Card>
        <SectionHeader title="Catatan" />
        <Text selectable style={{ color: colors.textMuted, lineHeight: 21 }}>
          {report.description || 'Tidak ada catatan tambahan.'}
        </Text>
      </Card>

      <ReportFollowUpSection
        mode="worker"
        reportStatus={report.status}
        tasks={followUpTasks}
        workerNames={workerNames}
      />

      <Card>
        <SectionHeader title="Status Owner" />
        <Text selectable style={{ color: colors.textMuted, lineHeight: 21 }}>
          {getWorkerOwnerStatusMessage(report.status, followUpTasks.length > 0)}
        </Text>
      </Card>
    </Screen>
  );
}

export function WorkerEditOperationalReportScreen({ reportId }: { reportId?: string }) {
  const { currentFarm } = useAuth();
  const [blockedReason, setBlockedReason] = React.useState<string | null>(null);
  const [category, setCategory] = React.useState<OperationalReportCategory | null>(null);
  const [description, setDescription] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [existingPhoto, setExistingPhoto] = React.useState<OperationalReportPhoto | null>(null);
  const [existingPhotoPreviewOpen, setExistingPhotoPreviewOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [locationNote, setLocationNote] = React.useState('');
  const [removeExistingPhoto, setRemoveExistingPhoto] = React.useState(false);
  const [report, setReport] = React.useState<OperationalReport | null>(null);
  const [selectedPhoto, setSelectedPhoto] = React.useState<PickedPhotoAsset | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

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
        setError('Akses worker tidak aktif.');
        setLoading(false);
        return;
      }

      setError(null);
      setBlockedReason(null);

      const [reportResult, eligibilityResult] = await Promise.all([
        getOperationalReportDetail({ operationalReportId: normalizedReportId }),
        getOperationalReportEditEligibility({ operationalReportId: normalizedReportId }),
      ]);

      if (!isMounted) {
        return;
      }

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
      setCategory(reportResult.data.category);
      setDescription(reportResult.data.description ?? '');
      setLocationNote(reportResult.data.locationNote ?? '');

      if (eligibilityResult.error) {
        setBlockedReason(eligibilityResult.error.message);
      } else if (!eligibilityResult.data.canEdit) {
        setBlockedReason(eligibilityResult.data.reason ?? 'Laporan ini tidak bisa diedit.');
      }

      const photoResult = await getOperationalReportPhotos({
        farmId: reportResult.data.farmId,
        reportId: reportResult.data.id,
      });

      if (!isMounted) {
        return;
      }

      if (photoResult.error) {
        setExistingPhoto(null);
      } else {
        setExistingPhoto(photoResult.data[0] ?? null);
      }

      setLoading(false);
    }

    loadReport();

    return () => {
      isMounted = false;
    };
  }, [currentFarm?.role, currentFarm?.status, currentFarm?.userId, farmId, reportId]);

  async function handleSubmit() {
    if (!report) {
      setError('Data laporan tidak ditemukan.');
      return;
    }

    if (blockedReason) {
      setError(blockedReason);
      return;
    }

    if (!category) {
      setError('Kategori laporan wajib dipilih.');
      return;
    }

    if (!locationNote.trim() && !description.trim()) {
      setError('Isi lokasi atau deskripsi laporan.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const result = await updateOwnOperationalReport({
      category,
      description,
      locationNote,
      operationalReportId: report.id,
      photo: selectedPhoto
        ? {
            base64: selectedPhoto.base64,
            fileName: selectedPhoto.fileName,
            mimeType: selectedPhoto.mimeType,
            uri: selectedPhoto.uri,
          }
        : null,
      removeExistingPhoto,
    });

    if (result.error) {
      setError(result.error.message);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);

    Alert.alert('Laporan berhasil diperbarui', result.data.warningMessage ?? '', [
      {
        text: 'OK',
        onPress: () => router.replace(`/worker/reports/${report.id}`),
      },
    ]);
  }

  async function handlePickPhotoFromGallery() {
    const result = await pickImageFromGallery();

    if (result.error) {
      setError(result.error.message);
      return;
    }

    if (result.data) {
      setError(null);
      setRemoveExistingPhoto(false);
      setSelectedPhoto(result.data);
    }
  }

  async function handleTakePhotoFromCamera() {
    const result = await takePhotoFromCamera();

    if (result.error) {
      setError(result.error.message);
      return;
    }

    if (result.data) {
      setError(null);
      setRemoveExistingPhoto(false);
      setSelectedPhoto(result.data);
    }
  }

  if (loading) {
    return <LoadingState message="Memuat laporan..." />;
  }

  if (!report) {
    return (
      <Screen>
        <TopAppBar title="Edit laporan" onBack={() => router.back()} />
        <ErrorBanner message={error} />
        <EmptyState title="Laporan tidak ditemukan" subtitle="Laporan mungkin tidak tersedia atau akses ditolak." />
      </Screen>
    );
  }

  if (blockedReason) {
    return (
      <Screen>
        <TopAppBar title="Edit laporan" onBack={() => router.back()} />
        <ErrorBanner message={error} />
        <Card variant="warning">
          <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: '800' }}>
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
      footer={
        <>
          <Button title="Simpan perubahan" loading={submitting} onPress={handleSubmit} />
          <Button disabled={submitting} title="Batal" variant="secondary" onPress={() => router.back()} />
        </>
      }
    >
      <TopAppBar title="Edit laporan" onBack={() => router.back()} />
      <ErrorBanner message={error} />

      <FormSection
        title="Informasi Laporan"
        description="Pilih kategori, lalu isi lokasi atau catatan minimal salah satu."
      >
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {operationalReportCategoryOptions.map((option) => (
            <ChipButton
              key={option}
              active={category === option}
              label={formatOperationalReportCategory(option)}
              onPress={() => setCategory(option)}
            />
          ))}
        </View>

        <Field
          label="Target/Lokasi"
          onChangeText={setLocationNote}
          placeholder="Contoh: Gudang alat, Baris A, atau area dekat pompa"
          value={locationNote}
        />
      </FormSection>

      <FormSection
        title="Catatan Lapangan"
        description="Jelaskan kondisi lapangan, pekerjaan, atau masalah yang perlu diketahui pemilik."
      >
        <TextArea
          label="Catatan laporan"
          onChangeText={setDescription}
          placeholder="Contoh: Selang penyemprot pecah"
          value={description}
        />
      </FormSection>

      {existingPhoto && !selectedPhoto && !removeExistingPhoto ? (
        <>
          <OperationalReportPhotoSection
            photo={existingPhoto}
            previewOpen={existingPhotoPreviewOpen}
            onClosePreview={() => setExistingPhotoPreviewOpen(false)}
            onOpenPreview={() => setExistingPhotoPreviewOpen(true)}
          />
          <Button
            title="Hapus Foto"
            variant="secondary"
            disabled={submitting}
            onPress={() => setRemoveExistingPhoto(true)}
          />
        </>
      ) : null}

      {existingPhoto && removeExistingPhoto && !selectedPhoto ? (
        <Card>
          <SectionHeader title="Foto Laporan" />
          <Text selectable style={{ color: colors.textMuted, lineHeight: 21 }}>
            Foto laporan saat ini akan dihapus setelah perubahan disimpan.
          </Text>
          <Button
            title="Batalkan hapus foto"
            variant="secondary"
            disabled={submitting}
            onPress={() => setRemoveExistingPhoto(false)}
          />
        </Card>
      ) : null}

      <OperationalReportPhotoPicker
        disabled={submitting}
        photo={selectedPhoto}
        onCameraPress={handleTakePhotoFromCamera}
        onGalleryPress={handlePickPhotoFromGallery}
        onRemove={() => setSelectedPhoto(null)}
      />
    </Screen>
  );
}

export function OwnerOperationalReportListScreen() {
  const { currentFarm } = useAuth();
  const [error, setError] = React.useState<string | null>(null);
  const [filterSheetVisible, setFilterSheetVisible] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [categoryFilter, setCategoryFilter] = React.useState<OperationalReportCategoryFilter>('all');
  const [photoMap, setPhotoMap] = React.useState<OperationalReportPhotoMap>({});
  const [reports, setReports] = React.useState<OperationalReport[]>([]);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<OperationalReportStatusFilter>('all');
  const [workerNames, setWorkerNames] = React.useState<Record<string, string>>({});

  const farmId = currentFarm?.farmId;
  const filteredReports = React.useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return reports.filter((report) => {
      const reporterName = workerNames[report.reportedBy] ?? '';
      const searchableText = [
        formatOperationalReportCategory(report.category),
        report.description,
        report.locationNote,
        reporterName,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      const matchesSearch = !normalizedQuery || searchableText.includes(normalizedQuery);
      const matchesStatus = statusFilter === 'all' || report.status === statusFilter;
      const matchesCategory = categoryFilter === 'all' || report.category === categoryFilter;

      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [categoryFilter, reports, searchQuery, statusFilter, workerNames]);

  const loadReports = React.useCallback(async () => {
    if (!farmId || currentFarm?.role !== 'owner' || currentFarm.status !== 'active') {
      setError('Hanya pemilik aktif yang dapat melihat laporan operasional.');
      setPhotoMap({});
      setReports([]);
      setWorkerNames({});
      return;
    }

    setError(null);

    const [reportsResult, workersResult] = await Promise.all([
      getOperationalReports({ farmId }),
      getFarmMemberBasicProfiles(farmId),
    ]);

    if (reportsResult.error) {
      setError(reportsResult.error.message);
      setPhotoMap({});
      setReports([]);
    } else {
      setReports(reportsResult.data);

      const photoResult = await listOperationalReportPhotosForReports({
        farmId,
        reportIds: reportsResult.data.map((report) => report.id),
      });

      if (photoResult.error) {
        setPhotoMap({});
      } else {
        setPhotoMap(photoResult.data);
      }
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
  }, [currentFarm?.role, currentFarm?.status, farmId]);

  useFocusEffect(
    React.useCallback(() => {
      setLoading(true);
      loadReports().finally(() => setLoading(false));
    }, [loadReports])
  );

  if (loading) {
    return <LoadingState message="Memuat laporan operasional..." />;
  }

  return (
    <Screen>
      <ReportRootHeader
        roleLabel="Pemilik"
        title="Laporan Operasional"
        subtitle="Tinjau laporan lapangan dari pekerja."
      />
      <ErrorBanner message={error} />

      <ReportSummary title="Laporan Masuk" reports={reports} />

      <ReportSearchFilterRow
        categoryFilter={categoryFilter}
        onOpenFilter={() => setFilterSheetVisible(true)}
        onSearchChange={setSearchQuery}
        searchQuery={searchQuery}
        statusFilter={statusFilter}
      />

      <MetaRow label="Daftar laporan" value={`Menampilkan ${filteredReports.length} dari ${reports.length} laporan`} />

      {filteredReports.length === 0 ? (
        <EmptyState
          title={reports.length === 0 ? 'Belum ada laporan' : 'Tidak ada laporan pada filter ini'}
          subtitle={
            reports.length === 0
              ? 'Laporan operasional dari pekerja akan muncul di sini.'
              : 'Laporan operasional pekerja yang sesuai pencarian akan muncul di sini.'
          }
        />
      ) : (
        <View style={{ gap: 12 }}>
          {filteredReports.map((report) => (
            <OperationalReportCard
              key={report.id}
              compactStatus
              hasPhoto={Boolean(photoMap[report.id])}
              report={report}
              reporterName={workerNames[report.reportedBy]}
              onPress={() => router.push(`/owner/reports/${report.id}`)}
            />
          ))}
        </View>
      )}
      <ReportFilterSheet
        categoryFilter={categoryFilter}
        onClose={() => setFilterSheetVisible(false)}
        onReset={() => {
          setStatusFilter('all');
          setCategoryFilter('all');
        }}
        onSelectCategory={setCategoryFilter}
        onSelectStatus={setStatusFilter}
        statusFilter={statusFilter}
        visible={filterSheetVisible}
      />
    </Screen>
  );
}

export function OwnerOperationalReportDetailScreen({ reportId }: { reportId?: string }) {
  const { currentFarm } = useAuth();
  const [error, setError] = React.useState<string | null>(null);
  const [followUpTasks, setFollowUpTasks] = React.useState<CareTaskDetail[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [proofPhotoMap, setProofPhotoMap] = React.useState<TaskProofPhotoMap>({});
  const [report, setReport] = React.useState<OperationalReport | null>(null);
  const [reportPhoto, setReportPhoto] = React.useState<OperationalReportPhoto | null>(null);
  const [reportPhotoPreviewOpen, setReportPhotoPreviewOpen] = React.useState(false);
  const [updatingStatus, setUpdatingStatus] = React.useState<OperationalReportStatus | null>(null);
  const [workerNames, setWorkerNames] = React.useState<Record<string, string>>({});

  const farmId = currentFarm?.farmId;

  const loadDetail = React.useCallback(async () => {
    const normalizedReportId = reportId?.trim();

    if (!normalizedReportId) {
      setError('Data laporan tidak ditemukan.');
      setFollowUpTasks([]);
      setProofPhotoMap({});
      setReport(null);
      setReportPhoto(null);
      setWorkerNames({});
      return;
    }

    if (!farmId || currentFarm?.role !== 'owner' || currentFarm.status !== 'active') {
      setError('Hanya pemilik aktif yang dapat melihat detail laporan operasional.');
      setFollowUpTasks([]);
      setProofPhotoMap({});
      setReport(null);
      setReportPhoto(null);
      setWorkerNames({});
      return;
    }

    setError(null);

    const [reportResult, workersResult, tasksResult] = await Promise.all([
      getOperationalReportDetail({ operationalReportId: normalizedReportId }),
      getFarmMemberBasicProfiles(farmId),
      getOperationalReportFollowUpTasks({ operationalReportId: normalizedReportId }),
    ]);

    if (reportResult.error) {
      setError(reportResult.error.message);
      setFollowUpTasks([]);
      setProofPhotoMap({});
      setReport(null);
      setReportPhoto(null);
    } else {
      setReport(reportResult.data);

      const photoResult = await getOperationalReportPhotos({
        farmId: reportResult.data.farmId,
        reportId: reportResult.data.id,
      });

      if (photoResult.error) {
        setReportPhoto(null);
      } else {
        setReportPhoto(photoResult.data[0] ?? null);
      }
    }

    if (tasksResult.error) {
      setError(tasksResult.error.message);
      setFollowUpTasks([]);
      setProofPhotoMap({});
    } else {
      setFollowUpTasks(tasksResult.data);

      const proofResult = await listTaskProofPhotosForActivities({
        activityIds: tasksResult.data.flatMap((task) => task.activities.map((activity) => activity.id)),
        farmId,
      });

      if (proofResult.error) {
        setProofPhotoMap({});
      } else {
        setProofPhotoMap(proofResult.data);
      }
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

  async function handleStatusUpdate(status: OperationalReportStatus) {
    if (!report || status === report.status || updatingStatus) {
      return;
    }

    setUpdatingStatus(status);
    setError(null);

    const result = await updateOperationalReportStatus({
      operationalReportId: report.id,
      status,
    });

    if (result.error) {
      setError(result.error.message);
      setUpdatingStatus(null);
      return;
    }

    await loadDetail();
    setUpdatingStatus(null);
  }

  if (loading) {
    return <LoadingState message="Memuat detail laporan..." />;
  }

  if (!report) {
    return (
      <Screen>
        <TopAppBar title="Detail Laporan" onBack={() => router.back()} />
        <ErrorBanner message={error} />
        <EmptyState title="Laporan tidak ditemukan" subtitle="Laporan mungkin tidak tersedia atau akses ditolak." />
      </Screen>
    );
  }

  const hasFollowUpTasks = followUpTasks.length > 0;
  const hasActiveFollowUpTask = followUpTasks.some((task) => task.status === 'pending' || task.status === 'postponed');
  const allFollowUpTasksCompleted = hasFollowUpTasks && followUpTasks.every((task) => task.status === 'completed');

  return (
    <Screen>
      <TopAppBar title="Detail Laporan" onBack={() => router.back()} />
      <ErrorBanner message={error} />

      <OperationalReportPhotoSection
        emptyText="Belum ada foto laporan."
        photo={reportPhoto}
        previewOpen={reportPhotoPreviewOpen}
        onClosePreview={() => setReportPhotoPreviewOpen(false)}
        onOpenPreview={() => setReportPhotoPreviewOpen(true)}
      />

      <ReportDetailSummaryCard report={report} reporterName={workerNames[report.reportedBy]} />

      <Card>
        <SectionHeader title="Catatan Laporan" />
        <Text selectable style={{ color: colors.textMuted, lineHeight: 21 }}>
          {report.description || 'Tidak ada catatan tambahan.'}
        </Text>
      </Card>

      <ReportFollowUpSection
        mode="owner"
        proofPhotoMap={proofPhotoMap}
        reportStatus={report.status}
        tasks={followUpTasks}
        workerNames={workerNames}
      />

      <OwnerReportDecisionSection
        allFollowUpTasksCompleted={allFollowUpTasksCompleted}
        hasActiveFollowUpTask={hasActiveFollowUpTask}
        hasFollowUpTasks={hasFollowUpTasks}
        onCreateTask={() => router.push(`/owner/reports/${report.id}/task`)}
        onUpdateStatus={handleStatusUpdate}
        reportStatus={report.status}
        updatingStatus={updatingStatus}
      />
    </Screen>
  );
}

export function OwnerCreateTaskFromOperationalReportScreen({ reportId }: { reportId?: string }) {
  const { currentFarm } = useAuth();
  const [assignedWorkerId, setAssignedWorkerId] = React.useState('');
  const [customTargetNote, setCustomTargetNote] = React.useState('');
  const [dueDate, setDueDate] = React.useState(getTodayIsoDate());
  const [error, setError] = React.useState<string | null>(null);
  const [instruction, setInstruction] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [report, setReport] = React.useState<OperationalReport | null>(null);
  const [requiresPhoto, setRequiresPhoto] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [targetColumn, setTargetColumn] = React.useState('');
  const [targetRow, setTargetRow] = React.useState('');
  const [targetTreeId, setTargetTreeId] = React.useState('');
  const [targetType, setTargetType] = React.useState<TargetType>('farm');
  const [title, setTitle] = React.useState('');
  const [trees, setTrees] = React.useState<Tree[]>([]);
  const [workers, setWorkers] = React.useState<WorkerMembership[]>([]);

  const farmId = currentFarm?.farmId;

  React.useEffect(() => {
    let isMounted = true;

    async function loadFormData() {
      const normalizedReportId = reportId?.trim();

      if (!normalizedReportId) {
        setError('Data laporan tidak ditemukan.');
        setLoading(false);
        return;
      }

      if (!farmId || currentFarm?.role !== 'owner' || currentFarm.status !== 'active') {
        setError('Hanya pemilik aktif yang dapat membuat tindak lanjut laporan.');
        setLoading(false);
        return;
      }

      setError(null);

      const [reportResult, workersResult, treesResult] = await Promise.all([
        getOperationalReportDetail({ operationalReportId: normalizedReportId }),
        getActiveWorkers(farmId),
        getTrees({ archived: false, farmId }),
      ]);

      if (!isMounted) {
        return;
      }

      if (reportResult.error) {
        setError(reportResult.error.message);
      } else {
        setReport(reportResult.data);
        setTitle(`Tindak lanjut ${formatOperationalReportCategory(reportResult.data.category)}`);
        setInstruction(reportResult.data.description ?? reportResult.data.locationNote ?? '');

        if (!canCreateTaskFromReportStatus(reportResult.data.status)) {
          setError(getClosedReportTaskMessage(reportResult.data.status));
        }
      }

      if (workersResult.error) {
        setError(workersResult.error.message);
        setWorkers([]);
      } else {
        setWorkers(workersResult.data);
      }

      if (treesResult.error) {
        setTrees([]);
      } else {
        setTrees(treesResult.data);
      }

      setLoading(false);
    }

    loadFormData();

    return () => {
      isMounted = false;
    };
  }, [currentFarm?.role, currentFarm?.status, farmId, reportId]);

  function updateTargetType(nextTargetType: TargetType) {
    setTargetType(nextTargetType);
    setTargetRow('');
    setTargetColumn('');
    setTargetTreeId('');
    setCustomTargetNote('');
  }

  async function handleSubmit() {
    if (!report) {
      setError('Data laporan tidak ditemukan.');
      return;
    }

    if (!canCreateTaskFromReportStatus(report.status)) {
      setError(getClosedReportTaskMessage(report.status));
      return;
    }

    if (!assignedWorkerId) {
      setError('Pilih pekerja aktif.');
      return;
    }

    if (!title.trim()) {
      setError('Judul tugas wajib diisi.');
      return;
    }

    if (targetType === 'custom' && !customTargetNote.trim()) {
      setError('Catatan target khusus wajib diisi.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const payload: CreateTaskFromOperationalReportInput = {
      assignedWorkerId,
      customTargetNote: targetType === 'custom' ? customTargetNote : null,
      dueDate,
      instruction,
      operationalReportId: report.id,
      requiresPhoto,
      targetColumn: targetType === 'column' ? targetColumn : null,
      targetRow: targetType === 'row' ? targetRow : null,
      targetTreeId: targetType === 'tree' ? targetTreeId : null,
      targetType,
      title,
    };

    const result = await createTaskFromOperationalReport(payload);

    if (result.error) {
      setError(result.error.message);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    router.replace(`/owner/tasks/${result.data.taskId}`);
  }

  if (loading) {
    return <LoadingState message="Memuat form tindak lanjut..." />;
  }

  const canSubmitFollowUpTask = report ? canCreateTaskFromReportStatus(report.status) : false;

  return (
    <Screen
      footer={
        <>
          <Button
            title="Simpan Tugas"
            disabled={!canSubmitFollowUpTask}
            loading={submitting}
            onPress={handleSubmit}
          />
          <Button disabled={submitting} title="Batal" variant="secondary" onPress={() => router.back()} />
        </>
      }
    >
      <TopAppBar title="Tugas Tindak Lanjut" onBack={() => router.back()} />
      <ErrorBanner message={error} />

      {report ? (
        <Card variant="softGreen">
          <SectionHeader
            title={`Laporan ${formatOperationalReportCategory(report.category)}`}
            description="Gunakan konteks laporan ini untuk membuat tugas tindak lanjut."
          />
          <MetaRow label="Kategori laporan" value={formatOperationalReportCategory(report.category)} />
          <MetaRow label="Status laporan" value={formatReportStatusDisplay(report.status)} />
          <MetaRow label="Tanggal laporan" value={formatDateTime(report.createdAt)} />
          <MetaRow label="Target/Lokasi" value={report.locationNote} />
          <MetaRow label="Deskripsi" value={report.description || 'Deskripsi belum diisi'} />
        </Card>
      ) : null}

      <FormSection
        title="Rencana Tugas"
        description="Tentukan pekerjaan dan pekerja yang akan menindaklanjuti laporan."
      >
        <Field
          label="Judul tugas *"
          onChangeText={setTitle}
          placeholder="Contoh: Perbaiki alat semprot"
          value={title}
        />

        <DateField label="Tanggal *" onChangeDate={setDueDate} value={dueDate} />

        <WorkerPicker assignedWorkerId={assignedWorkerId} onSelect={setAssignedWorkerId} workers={workers} />
      </FormSection>

      <FormSection
        title="Target Tugas"
        description="Pilih area atau pohon yang perlu dikerjakan."
      >
        <TaskTargetPicker
          customTargetNote={customTargetNote}
          onCustomTargetNoteChange={setCustomTargetNote}
          onTargetColumnChange={setTargetColumn}
          onTargetRowChange={setTargetRow}
          onTargetTreeIdChange={setTargetTreeId}
          onTargetTypeChange={updateTargetType}
          targetColumn={targetColumn}
          targetRow={targetRow}
          targetTreeId={targetTreeId}
          targetType={targetType}
          trees={trees}
        />
      </FormSection>

      <FormSection
        title="Instruksi dan Bukti"
        description="Instruksi ini akan muncul di detail tugas pekerja."
      >
        <TextArea
          label="Instruksi"
          onChangeText={setInstruction}
          placeholder="Instruksi tindak lanjut untuk pekerja"
          value={instruction}
        />

        <ProofRequirementToggle
          enabled={requiresPhoto}
          onToggle={() => setRequiresPhoto((current) => !current)}
        />
      </FormSection>
    </Screen>
  );
}

function ReportSearchFilterRow({
  categoryFilter,
  onOpenFilter,
  onSearchChange,
  searchQuery,
  statusFilter,
}: {
  categoryFilter: OperationalReportCategoryFilter;
  onOpenFilter: () => void;
  onSearchChange: (value: string) => void;
  searchQuery: string;
  statusFilter: OperationalReportStatusFilter;
}) {
  const activeFilterCount = Number(statusFilter !== 'all') + Number(categoryFilter !== 'all');

  return (
    <SearchFilterRow
      filterActive={activeFilterCount > 0}
      onChangeText={onSearchChange}
      onFilterPress={onOpenFilter}
      placeholder="Cari judul, lokasi, atau pelapor"
      value={searchQuery}
    />
  );
}

function ReportRootHeader({
  roleLabel,
  subtitle,
  title,
}: {
  roleLabel: 'Pekerja' | 'Pemilik';
  subtitle: string;
  title: string;
}) {
  return (
    <View style={{ gap: spacing.sm, paddingTop: spacing.xs }}>
      <Badge label={roleLabel} tone={roleLabel === 'Pemilik' ? 'info' : 'neutral'} />
      <Text
        selectable
        style={{
          color: colors.text,
          fontSize: typography.h1.fontSize,
          fontWeight: typography.h1.fontWeight,
          lineHeight: typography.h1.lineHeight,
        }}
      >
        {title}
      </Text>
      <Text selectable style={{ color: colors.textMuted, fontSize: 16, lineHeight: 23 }}>
        {subtitle}
      </Text>
    </View>
  );
}

function ReportDetailSummaryCard({
  report,
  reporterName,
}: {
  report: OperationalReport;
  reporterName?: string;
}) {
  return (
    <Card variant="softGreen">
      <View style={{ alignItems: 'flex-start', flexDirection: 'row', gap: 12, justifyContent: 'space-between' }}>
        <View style={{ flex: 1, gap: spacing.sm }}>
          <Text selectable style={{ color: colors.text, fontSize: 22, fontWeight: '900', lineHeight: 28 }}>
            {`Laporan ${formatOperationalReportCategory(report.category)}`}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            <Badge label={formatOperationalReportCategory(report.category)} tone="info" />
            <Badge label={formatReportStatusDisplay(report.status)} tone={getReportStatusTone(report.status)} />
          </View>
        </View>
      </View>
      <View style={{ gap: spacing.md }}>
        <MetaRow label="Lokasi/target" value={report.locationNote ?? 'Belum tersedia'} />
        {reporterName ? <MetaRow label="Pelapor" value={reporterName} /> : null}
        <MetaRow label="Tanggal laporan" value={formatDateTime(report.createdAt)} />
        <MetaRow label="Status" value={formatReportStatusDisplay(report.status)} />
      </View>
    </Card>
  );
}

function ReportFilterSheet({
  categoryFilter,
  onClose,
  onReset,
  onSelectCategory,
  onSelectStatus,
  statusFilter,
  visible,
}: {
  categoryFilter: OperationalReportCategoryFilter;
  onClose: () => void;
  onReset: () => void;
  onSelectCategory: (category: OperationalReportCategoryFilter) => void;
  onSelectStatus: (status: OperationalReportStatusFilter) => void;
  statusFilter: OperationalReportStatusFilter;
  visible: boolean;
}) {
  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <View style={{ backgroundColor: 'rgba(30, 42, 36, 0.28)', flex: 1, justifyContent: 'flex-end' }}>
        <Pressable accessibilityRole="button" onPress={onClose} style={{ flex: 1 }} />
        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            gap: 18,
            padding: 20,
            paddingBottom: 24,
          }}
        >
          <View style={{ gap: 5 }}>
            <Text selectable style={{ color: '#1E2A24', fontSize: 20, fontWeight: '900' }}>
              Filter Laporan
            </Text>
            <Text selectable style={{ color: '#68746D', lineHeight: 20 }}>
              Pilih status dan kategori laporan yang ingin ditampilkan.
            </Text>
          </View>

          <ReportStatusFilter selectedStatus={statusFilter} onSelect={onSelectStatus} />
          <ReportCategoryFilter selectedCategory={categoryFilter} onSelect={onSelectCategory} />

          <View style={{ gap: 10 }}>
            <Button title="Terapkan Filter" onPress={onClose} />
            <Button
              title="Reset Filter"
              variant="secondary"
              onPress={() => {
                onReset();
                onClose();
              }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function OwnerReportDecisionSection({
  allFollowUpTasksCompleted,
  hasActiveFollowUpTask,
  hasFollowUpTasks,
  onCreateTask,
  onUpdateStatus,
  reportStatus,
  updatingStatus,
}: {
  allFollowUpTasksCompleted: boolean;
  hasActiveFollowUpTask: boolean;
  hasFollowUpTasks: boolean;
  onCreateTask: () => void;
  onUpdateStatus: (status: OperationalReportStatus) => void;
  reportStatus: OperationalReportStatus;
  updatingStatus: OperationalReportStatus | null;
}) {
  if (reportStatus === 'new') {
    return (
      <Card>
        <SectionHeader
          title="Tindak Lanjut"
          description="Pilih respons untuk laporan yang belum ditangani."
        />
        <Text selectable style={{ color: colors.textMuted, lineHeight: 21 }}>
          Laporan belum direspons. Pilih tindak lanjut yang paling sesuai dengan kondisi lapangan.
        </Text>
        <View style={{ gap: 10 }}>
          {!hasFollowUpTasks ? (
            <Button title="Buat Tugas Tindak Lanjut" onPress={onCreateTask} />
          ) : (
            <Text selectable style={{ color: colors.textMuted, lineHeight: 21 }}>
              Tugas tindak lanjut sudah tersedia untuk laporan ini.
            </Text>
          )}
          <Button
            title="Tandai Selesai"
            loading={updatingStatus === 'resolved'}
            variant="secondary"
            onPress={() => onUpdateStatus('resolved')}
          />
          <Button
            title="Tolak Laporan"
            loading={updatingStatus === 'rejected'}
            variant="danger"
            onPress={() => onUpdateStatus('rejected')}
          />
        </View>
      </Card>
    );
  }

  if (reportStatus === 'in_progress') {
    return (
      <Card>
        <SectionHeader
          title="Tindak Lanjut"
          description="Pantau penyelesaian tugas yang dibuat dari laporan ini."
        />
        {allFollowUpTasksCompleted ? (
          <>
            <Text selectable style={{ color: appTheme.primary, fontWeight: '800', lineHeight: 21 }}>
              Tugas tindak lanjut sudah selesai. Tinjau hasilnya lalu tandai laporan selesai.
            </Text>
            <Button
              title="Tandai Laporan Selesai"
              loading={updatingStatus === 'resolved'}
              onPress={() => onUpdateStatus('resolved')}
            />
          </>
        ) : hasActiveFollowUpTask ? (
          <Text selectable style={{ color: colors.textMuted, lineHeight: 21 }}>
            Menunggu pekerja menyelesaikan tugas tindak lanjut.
          </Text>
        ) : (
          <Text selectable style={{ color: colors.textMuted, lineHeight: 21 }}>
            Laporan sedang dalam tindak lanjut. Status final tetap diputuskan oleh pemilik.
          </Text>
        )}
      </Card>
    );
  }

  return (
    <Card>
      <SectionHeader title="Tindak Lanjut" />
      <Badge
        label={formatReportStatusDisplay(reportStatus)}
        tone={getReportStatusTone(reportStatus)}
      />
      <Text selectable style={{ color: colors.textMuted, lineHeight: 21 }}>
        {reportStatus === 'resolved' ? 'Laporan selesai.' : 'Laporan ditolak.'}
      </Text>
    </Card>
  );
}

function OperationalReportCard({
  compactStatus = false,
  hasPhoto = false,
  onPress,
  report,
  reporterName,
}: {
  compactStatus?: boolean;
  hasPhoto?: boolean;
  onPress?: () => void;
  report: OperationalReport;
  reporterName?: string;
}) {
  const content = (
    <Card>
      <View style={{ gap: spacing.md }}>
        <View style={{ alignItems: 'flex-start', flexDirection: 'row', gap: spacing.md, justifyContent: 'space-between' }}>
          <Text
            selectable
            ellipsizeMode="tail"
            numberOfLines={2}
            style={{ color: colors.text, flex: 1, fontSize: 17, fontWeight: '900', lineHeight: 23 }}
          >
            {`Laporan ${formatOperationalReportCategory(report.category)}`}
          </Text>
          <Badge
            label={compactStatus ? formatReportStatusDisplay(report.status, true) : formatReportStatusDisplay(report.status)}
            maxWidth={compactStatus ? 118 : 150}
            tone={getReportStatusTone(report.status)}
          />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          <Badge label={formatOperationalReportCategory(report.category)} tone="info" />
          {hasPhoto ? <Badge label="Ada foto" tone="success" /> : null}
        </View>
        <Text selectable ellipsizeMode="tail" numberOfLines={2} style={{ color: colors.textMuted, fontSize: 13, lineHeight: 18 }}>
          {formatReportSummary(report)}
        </Text>
        <View style={{ gap: spacing.xs }}>
          <CompactMetaItem icon="calendar" label={formatDateTime(report.createdAt)} />
          {report.locationNote ? <CompactMetaItem icon="target" label={report.locationNote} /> : null}
          {reporterName ? <CompactMetaItem icon="user" label={reporterName} /> : null}
        </View>
      </View>
    </Card>
  );

  if (!onPress) {
    return content;
  }

  return <Pressable onPress={onPress}>{content}</Pressable>;
}

function OperationalReportPhotoPicker({
  disabled,
  onCameraPress,
  onGalleryPress,
  onRemove,
  photo,
}: {
  disabled: boolean;
  onCameraPress: () => void;
  onGalleryPress: () => void;
  onRemove: () => void;
  photo: PickedPhotoAsset | null;
}) {
  return (
    <PhotoPickerCard
      choosePhotoLabel="Pilih Galeri"
      description="Opsional, tambahkan foto sebagai bukti kondisi lapangan."
      imageUri={photo?.uri ?? null}
      loading={disabled}
      removeLabel="Hapus Foto"
      takePhotoLabel="Ambil Foto"
      title="Foto Laporan"
      onChoosePhoto={onGalleryPress}
      onRemovePhoto={photo ? onRemove : undefined}
      onTakePhoto={onCameraPress}
    />
  );
}

function OperationalReportPhotoSection({
  emptyText,
  onClosePreview,
  onOpenPreview,
  photo,
  previewOpen,
}: {
  emptyText?: string;
  onClosePreview: () => void;
  onOpenPreview: () => void;
  photo: OperationalReportPhoto | null;
  previewOpen: boolean;
}) {
  const [imageFailed, setImageFailed] = React.useState(false);

  React.useEffect(() => {
    setImageFailed(false);
  }, [photo?.signedUrl]);

  if (!photo) {
    if (!emptyText) {
      return null;
    }

    return (
      <Card>
        <SectionHeader title="Foto Laporan" />
        <Text selectable style={{ color: colors.textMuted, lineHeight: 21 }}>
          {emptyText}
        </Text>
      </Card>
    );
  }

  return (
    <Card>
      <SectionHeader title="Foto Laporan" description="Ketuk foto untuk melihat ukuran lebih besar." />

      {imageFailed ? (
        <View
          style={{
            alignItems: 'center',
            backgroundColor: colors.photoPlaceholder,
            borderColor: colors.border,
            borderCurve: 'continuous',
            borderRadius: radius.lg,
            borderWidth: 1,
            minHeight: 118,
            justifyContent: 'center',
            padding: spacing.md,
          }}
        >
          <Text selectable style={{ color: colors.textMuted, lineHeight: 20, textAlign: 'center' }}>
            Foto laporan belum dapat dimuat.
          </Text>
        </View>
      ) : (
        <Pressable accessibilityRole="imagebutton" onPress={onOpenPreview}>
          <Image
            resizeMode="cover"
            source={{ uri: photo.signedUrl }}
            onError={() => setImageFailed(true)}
            style={{
              borderRadius: radius.lg,
              height: 192,
              width: '100%',
            }}
          />
        </Pressable>
      )}

      <Modal animationType="fade" onRequestClose={onClosePreview} transparent visible={previewOpen && !imageFailed}>
        <View style={{ backgroundColor: 'rgba(18, 28, 22, 0.78)', flex: 1, justifyContent: 'center', padding: 20 }}>
          <Pressable accessibilityRole="button" onPress={onClosePreview} style={{ flex: 1, justifyContent: 'center' }}>
            <Image
              resizeMode="contain"
              source={{ uri: photo.signedUrl }}
              style={{
                borderRadius: radius.lg,
                height: '82%',
                width: '100%',
              }}
            />
          </Pressable>
        </View>
      </Modal>
    </Card>
  );
}

function ReportStatusFilter({
  onSelect,
  selectedStatus,
}: {
  onSelect: (status: OperationalReportStatusFilter) => void;
  selectedStatus: OperationalReportStatusFilter;
}) {
  const filters: OperationalReportStatusFilter[] = ['all', ...operationalReportStatusOptions];

  return (
    <View style={{ gap: 8 }}>
      <Text selectable style={{ color: '#1E2A24', fontSize: 14, fontWeight: '600' }}>
        Status
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {filters.map((status) => (
          <ChipButton
            key={status}
            active={selectedStatus === status}
            label={status === 'all' ? 'Semua' : formatReportStatusDisplay(status)}
            onPress={() => onSelect(status)}
          />
        ))}
      </View>
    </View>
  );
}

function ReportCategoryFilter({
  onSelect,
  selectedCategory,
}: {
  onSelect: (category: OperationalReportCategoryFilter) => void;
  selectedCategory: OperationalReportCategoryFilter;
}) {
  const filters: OperationalReportCategoryFilter[] = ['all', ...operationalReportCategoryOptions];

  return (
    <View style={{ gap: 8 }}>
      <Text selectable style={{ color: '#1E2A24', fontSize: 14, fontWeight: '600' }}>
        Kategori
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {filters.map((category) => (
          <ChipButton
            key={category}
            active={selectedCategory === category}
            label={category === 'all' ? 'Semua' : formatOperationalReportCategory(category)}
            onPress={() => onSelect(category)}
          />
        ))}
      </View>
    </View>
  );
}

function ReportSummary({ reports, title }: { reports: OperationalReport[]; title: string }) {
  const items: Array<{ label: string; tone: 'danger' | 'info' | 'success' | 'warning'; value: number }> = [
    { label: 'Belum Respons', tone: 'warning', value: countReportsByStatus(reports, 'new') },
    { label: 'Tindak Lanjut', tone: 'info', value: countReportsByStatus(reports, 'in_progress') },
    { label: 'Selesai', tone: 'success', value: countReportsByStatus(reports, 'resolved') },
    { label: 'Ditolak', tone: 'danger', value: countReportsByStatus(reports, 'rejected') },
  ];

  return (
    <Card variant="heroGreen">
      <SectionHeader title={title} description="Ringkasan status laporan operasional." />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {items.map((item) => (
          <View
            key={item.label}
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.primaryBorder,
              borderCurve: 'continuous',
              borderRadius: radius.lg,
              borderWidth: 1,
              flexBasis: '46%',
              flexGrow: 1,
              gap: spacing.xs,
              minHeight: 76,
              padding: spacing.md,
            }}
          >
            <Text selectable numberOfLines={2} style={{ color: colors.textMuted, fontSize: 12, fontWeight: '800', lineHeight: 16 }}>
              {item.label}
            </Text>
            <Text selectable style={{ color: getSummaryToneColor(item.tone), fontSize: 22, fontVariant: ['tabular-nums'], fontWeight: '900' }}>
              {item.value}
            </Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

function ReportFollowUpSection({
  mode,
  proofPhotoMap = {},
  tasks,
  workerNames,
}: {
  mode: 'owner' | 'worker';
  proofPhotoMap?: TaskProofPhotoMap;
  reportStatus: OperationalReportStatus;
  tasks: CareTaskDetail[];
  workerNames: Record<string, string>;
}) {
  return (
    <View style={{ gap: 12 }}>
      <Text selectable style={{ color: '#1E2A24', fontSize: 20, fontWeight: '800', paddingTop: 4 }}>
        Tindak Lanjut
      </Text>

      {tasks.length === 0 ? (
        <Card>
          <Text selectable style={{ color: '#68746D', lineHeight: 21 }}>
            Belum ada tugas tindak lanjut.
          </Text>
        </Card>
      ) : (
        <View style={{ gap: 12 }}>
          {tasks.map((task) => (
            <ReportFollowUpTaskCard
              key={task.id}
              mode={mode}
              proofPhotoMap={proofPhotoMap}
              task={task}
              workerNames={workerNames}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function ReportFollowUpTaskCard({
  mode,
  proofPhotoMap,
  task,
  workerNames,
}: {
  mode: 'owner' | 'worker';
  proofPhotoMap: TaskProofPhotoMap;
  task: CareTaskDetail;
  workerNames: Record<string, string>;
}) {
  const taskRoute = mode === 'owner'
    ? `/owner/tasks/${task.id}`
    : `/worker/tasks/${task.id}`;

  return (
    <Card>
      <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'space-between' }}>
        <Text
          selectable
          numberOfLines={2}
          style={{ color: '#1E2A24', flex: 1, fontSize: 17, fontWeight: '900', lineHeight: 23 }}
        >
          {task.title}
        </Text>
        <Badge label={formatTaskStatus(task.status)} maxWidth={110} tone={getTaskTone(task.status)} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
        <Badge label="Dari Laporan" tone="muted" />
        {task.category ? <Badge label={formatCareCategory(task.category)} tone="success" /> : null}
        {task.requiresPhoto ? <Badge label="Butuh bukti" tone="warning" /> : null}
      </View>
      <View style={{ gap: 9 }}>
        <MetaRow label="Pekerja" value={workerNames[task.assignedTo] ?? 'Pekerja tidak tersedia'} />
        <MetaRow label="Tanggal tugas" value={formatDate(task.dueDate)} />
        <MetaRow label="Target" value={formatCareTarget(task)} />
        <MetaRow label="Instruksi" value={task.instruction || '-'} />
      </View>

      {task.activities.length > 0 ? (
        <View style={{ gap: 10 }}>
          <Text selectable style={{ color: '#1E2A24', fontSize: 15, fontWeight: '800' }}>
            Realisasi
          </Text>
          {task.activities.map((activity) => (
            <View
              key={activity.id}
              style={{
                backgroundColor: appTheme.primarySoft,
                borderColor: '#B8D8BF',
                borderRadius: 10,
                borderWidth: 1,
                gap: 8,
                padding: 11,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                <Text selectable style={{ color: '#1E2A24', flex: 1, fontWeight: '800' }}>
                  {formatActivityStatus(activity.status)}
                </Text>
                <Badge label={formatActivityStatus(activity.status)} maxWidth={110} tone={getActivityTone(activity.status)} />
              </View>
              <MetaRow label="Waktu" value={formatDateTime(activity.performedAt)} />
              <MetaRow label="Pelaksana" value={workerNames[activity.performedBy] ?? 'Pekerja tidak tersedia'} />
              <MetaRow label="Catatan" value={activity.note || '-'} />
              {mode === 'owner' && activity.status === 'completed' ? (
                <TaskProofPhotoPreview
                  emptyText={task.requiresPhoto ? 'Menunggu bukti foto dari pekerja.' : undefined}
                  photo={proofPhotoMap[activity.id]}
                />
              ) : null}
            </View>
          ))}
        </View>
      ) : (
        <Text selectable style={{ color: '#68746D', lineHeight: 21 }}>
          Belum ada realisasi.
        </Text>
      )}

      <Button
        title="Buka Tugas"
        variant="secondary"
        onPress={() => router.push(taskRoute)}
      />
    </Card>
  );
}

function WorkerPicker({
  assignedWorkerId,
  onSelect,
  workers,
}: {
  assignedWorkerId: string;
  onSelect: (workerId: string) => void;
  workers: WorkerMembership[];
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text selectable style={{ color: '#1E2A24', fontSize: 14, fontWeight: '600' }}>
        Pekerja aktif *
      </Text>
      {workers.length === 0 ? (
        <EmptyState title="Belum ada pekerja aktif" subtitle="Setujui pekerja terlebih dahulu sebelum membuat tugas." />
      ) : (
        <View style={{ gap: 8 }}>
          {workers.map((worker) => (
            <Button
              key={worker.userId}
              title={worker.fullName}
              variant={assignedWorkerId === worker.userId ? 'primary' : 'secondary'}
              onPress={() => onSelect(worker.userId)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function TaskTargetPicker({
  customTargetNote,
  onCustomTargetNoteChange,
  onTargetColumnChange,
  onTargetRowChange,
  onTargetTreeIdChange,
  onTargetTypeChange,
  targetColumn,
  targetRow,
  targetTreeId,
  targetType,
  trees,
}: {
  customTargetNote: string;
  onCustomTargetNoteChange: (value: string) => void;
  onTargetColumnChange: (value: string) => void;
  onTargetRowChange: (value: string) => void;
  onTargetTreeIdChange: (value: string) => void;
  onTargetTypeChange: (targetType: TargetType) => void;
  targetColumn: string;
  targetRow: string;
  targetTreeId: string;
  targetType: TargetType;
  trees: Tree[];
}) {
  const targetOptions: TargetType[] = ['farm', 'row', 'column', 'tree', 'custom'];

  return (
    <View style={{ gap: 12 }}>
      <View style={{ gap: 8 }}>
        <Text selectable style={{ color: '#1E2A24', fontSize: 14, fontWeight: '600' }}>
          Target tugas *
        </Text>
        <View style={{ gap: 8 }}>
          {targetOptions.map((option) => (
            <Button
              key={option}
              title={formatTargetType(option)}
              variant={targetType === option ? 'primary' : 'secondary'}
              onPress={() => onTargetTypeChange(option)}
            />
          ))}
        </View>
      </View>

      {targetType === 'row' ? (
        <Field label="Baris target *" onChangeText={onTargetRowChange} placeholder="Contoh: A" value={targetRow} />
      ) : null}

      {targetType === 'column' ? (
        <Field label="Kolom target *" onChangeText={onTargetColumnChange} placeholder="Contoh: 1" value={targetColumn} />
      ) : null}

      {targetType === 'tree' ? (
        <View style={{ gap: 8 }}>
          <Text selectable style={{ color: '#1E2A24', fontSize: 14, fontWeight: '600' }}>
            Pohon target *
          </Text>
          {trees.length === 0 ? (
            <EmptyState title="Belum ada pohon aktif" subtitle="Tambahkan pohon sebelum membuat tugas per pohon." />
          ) : (
            <View style={{ gap: 8 }}>
              {trees.map((tree) => (
                <Button
                  key={tree.id}
                  title={formatTreeLocation(tree)}
                  variant={targetTreeId === tree.id ? 'primary' : 'secondary'}
                  onPress={() => onTargetTreeIdChange(tree.id)}
                />
              ))}
            </View>
          )}
        </View>
      ) : null}

      {targetType === 'custom' ? (
        <TextArea
          label="Catatan target khusus *"
          onChangeText={onCustomTargetNoteChange}
          placeholder="Contoh: Area dekat gudang pupuk"
          value={customTargetNote}
        />
      ) : null}
    </View>
  );
}

function formatReportSummary(report: OperationalReport): string {
  const summary = report.description ?? report.locationNote;

  if (!summary) {
    return 'Tanpa keterangan';
  }

  return summary.length > 96 ? `${summary.slice(0, 93)}...` : summary;
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

function getTodayIsoDate(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function countReportsByStatus(reports: OperationalReport[], status: OperationalReportStatus): number {
  return reports.filter((report) => report.status === status).length;
}

function formatReportStatusDisplay(status: OperationalReportStatus, compact = false): string {
  const labels: Record<OperationalReportStatus, string> = {
    in_progress: compact ? 'Tindak Lanjut' : 'Tindak Lanjut',
    new: 'Belum Respons',
    rejected: 'Ditolak',
    resolved: 'Selesai',
  };

  return labels[status];
}

function getSummaryToneColor(tone: 'danger' | 'info' | 'success' | 'warning'): string {
  const toneColors = {
    danger: colors.danger,
    info: colors.info,
    success: colors.success,
    warning: colors.warning,
  };

  return toneColors[tone];
}

function getWorkerOwnerStatusMessage(
  status: OperationalReportStatus,
  hasFollowUpTasks: boolean
): string {
  if (status === 'new') {
    return 'Menunggu respons pemilik.';
  }

  if (status === 'in_progress') {
    return hasFollowUpTasks
      ? 'Pemilik membuat tindak lanjut untuk laporan ini.'
      : 'Laporan sedang dalam tindak lanjut oleh pemilik.';
  }

  if (status === 'resolved') {
    return 'Laporan sudah ditandai selesai.';
  }

  return 'Laporan ditolak oleh pemilik.';
}

function getReportStatusTone(status: OperationalReportStatus): 'danger' | 'info' | 'success' | 'warning' {
  if (status === 'resolved') {
    return 'success';
  }

  if (status === 'rejected') {
    return 'danger';
  }

  if (status === 'new') {
    return 'warning';
  }

  return 'info';
}

function getTaskTone(status: TaskStatus): 'danger' | 'muted' | 'success' | 'warning' {
  if (status === 'completed') {
    return 'success';
  }

  if (status === 'postponed') {
    return 'warning';
  }

  return 'muted';
}

function getActivityTone(status: ActivityStatus): 'danger' | 'muted' | 'success' | 'warning' {
  if (status === 'completed') {
    return 'success';
  }

  return 'warning';
}

function formatActivityStatus(status: ActivityStatus): string {
  const labels: Record<ActivityStatus, string> = {
    completed: 'Selesai',
    postponed: 'Ditunda',
  };

  return labels[status];
}

function TextArea({
  label,
  onChangeText,
  placeholder,
  value,
}: {
  label: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  return (
    <View style={{ gap: 7 }}>
      <Text selectable style={{ color: '#1E2A24', fontSize: 14, fontWeight: '600' }}>
        {label}
      </Text>
      <TextInput
        multiline
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94A098"
        style={{
          backgroundColor: '#FFFFFF',
          borderColor: '#DDE4DA',
          borderCurve: 'continuous',
          borderRadius: 8,
          borderWidth: 1,
          color: '#1E2A24',
          fontSize: 16,
          minHeight: 104,
          paddingHorizontal: 14,
          paddingTop: 12,
          textAlignVertical: 'top',
        }}
        value={value}
      />
    </View>
  );
}
