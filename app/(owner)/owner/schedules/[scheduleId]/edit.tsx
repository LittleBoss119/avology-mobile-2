import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { ScrollView, Text, View, type LayoutChangeEvent } from 'react-native';

import {
  ManualScheduleForm,
  clearResolvedScheduleFormErrors,
  hasScheduleFormErrors,
  scheduleFormFieldOrder,
  validateScheduleForm,
  type ManualScheduleFormValues,
  type ScheduleFormErrors,
} from '../../../../../src/components/care-schedule-components';
import { ConfirmDialog } from '../../../../../src/components/bottom-sheet';
import { Button, Card, EmptyState, ErrorBanner, LoadingState, Screen, TopAppBar } from '../../../../../src/components/ui';
import { colors, tokens } from '../../../../../src/constants/theme';
import { useAuth } from '../../../../../src/context/auth-context';
import { setPendingFeedback } from '../../../../../src/lib/pendingFeedback';
import {
  buildScheduleTitle,
  cancelCareSchedule,
  getCareScheduleDetail,
  getScheduleEditEligibility,
  updateCareSchedule,
} from '../../../../../src/services/careScheduleService';
import { getActiveWorkers } from '../../../../../src/services/memberService';
import { getTrees } from '../../../../../src/services/treeService';
import type { CareCategory, CareScheduleDetail, Tree, WorkerMembership } from '../../../../../src/types/domain';

export default function EditCareScheduleScreen() {
  const { currentFarm } = useAuth();
  const { scheduleId } = useLocalSearchParams<{ scheduleId: string }>();
  const [blockedReason, setBlockedReason] = React.useState<string | null>(null);
  const [cancelConfirmOpen, setCancelConfirmOpen] = React.useState(false);
  const [cancelLoading, setCancelLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [errors, setErrors] = React.useState<ScheduleFormErrors>({});
  const [loading, setLoading] = React.useState(true);
  const [schedule, setSchedule] = React.useState<CareScheduleDetail | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [trees, setTrees] = React.useState<Tree[]>([]);
  const [values, setValues] = React.useState<ManualScheduleFormValues | null>(null);
  const [workers, setWorkers] = React.useState<WorkerMembership[]>([]);

  const scrollRef = React.useRef<ScrollView>(null);
  const formTop = React.useRef(0);
  const fieldOffsets = React.useRef<Record<string, number>>({});

  const farmId = currentFarm?.farmId;

  React.useEffect(() => {
    let isMounted = true;

    async function loadFormData() {
      const normalizedScheduleId = scheduleId?.trim();

      if (!normalizedScheduleId) {
        setError('Data jadwal tidak ditemukan.');
        setLoading(false);
        return;
      }

      if (!farmId) {
        setError('Data kebun aktif tidak ditemukan.');
        setLoading(false);
        return;
      }

      setError(null);
      setBlockedReason(null);

      const [scheduleResult, eligibilityResult, workersResult, treesResult] = await Promise.all([
        getCareScheduleDetail({ scheduleId: normalizedScheduleId }),
        getScheduleEditEligibility({ scheduleId: normalizedScheduleId }),
        getActiveWorkers(farmId),
        getTrees({
          archived: false,
          farmId,
        }),
      ]);

      if (!isMounted) {
        return;
      }

      if (scheduleResult.error) {
        setError(scheduleResult.error.message);
        setLoading(false);
        return;
      }

      setSchedule(scheduleResult.data);
      setValues(buildInitialValues(scheduleResult.data));

      if (eligibilityResult.error) {
        setBlockedReason(eligibilityResult.error.message);
      } else if (!eligibilityResult.data.canEdit) {
        setBlockedReason(eligibilityResult.data.reason ?? 'Jadwal ini tidak bisa diedit.');
      }

      if (workersResult.error) {
        setError(workersResult.error.message);
        setWorkers([]);
      } else {
        setWorkers(workersResult.data);
      }

      if (treesResult.error) {
        setError(treesResult.error.message);
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
  }, [farmId, scheduleId]);

  function handleValuesChange(next: ManualScheduleFormValues) {
    setValues(next);
    setErrors((prev) => clearResolvedScheduleFormErrors(prev, next));
  }

  function scrollToFirstError(nextErrors: ScheduleFormErrors) {
    const firstKey = scheduleFormFieldOrder.find((key) => nextErrors[key]);

    if (!firstKey) {
      return;
    }

    const y = Math.max(0, formTop.current + (fieldOffsets.current[firstKey] ?? 0) - 12);
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ y, animated: true }));
  }

  async function handleSubmit() {
    if (!schedule || !values) {
      setError('Data jadwal tidak ditemukan.');
      return;
    }

    if (blockedReason) {
      setError(blockedReason);
      return;
    }

    const nextErrors = validateScheduleForm(values);

    if (hasScheduleFormErrors(nextErrors)) {
      setErrors(nextErrors);
      scrollToFirstError(nextErrors);
      return;
    }

    setErrors({});

    // Judul DIRAKIT ULANG di sini, bukan saat form dibuka.
    //
    // Bedanya penting untuk jadwal lama yang judulnya masih diketik manusia
    // ("Test", "awas"). Kalau dirakit ulang saat form dibuka, sekadar membuka
    // layar edit lalu menekan back sudah mengubah data — perubahan yang tidak
    // pernah diminta pemilik, dan pada jadwal berulang ia menurun ke seluruh
    // rantai. Dengan dirakit saat simpan, setiap perubahan judul selalu punya
    // sebab yang bisa ditunjuk: pemilik menekan "Simpan perubahan". Jadwal yang
    // tidak pernah disunting tetap memegang judul lamanya, dan tetap bisa
    // ditemukan lewat kata itu di pencarian.
    const title = buildScheduleTitle({
      category: values.category,
      customTargetNote: values.targetType === 'custom' ? values.customTargetNote : null,
      targetTreeIds: values.targetTreeIds,
      targetType: values.targetType,
    });

    if (!title) {
      setError('Jenis perawatan dan target harus lengkap.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const result = await updateCareSchedule({
      assignedWorkerId: values.assignedWorkerId,
      // Aman: validateScheduleForm memastikan kategori sudah dipilih.
      category: values.category as CareCategory,
      customTargetNote: values.targetType === 'custom' ? values.customTargetNote : null,
      instruction: values.instruction,
      requiresPhoto: values.requiresPhoto,
      scheduleId: schedule.id,
      scheduledDate: values.scheduledDate,
      targetTreeIds: values.targetType === 'tree' ? values.targetTreeIds : undefined,
      targetType: values.targetType,
      title,
    });

    if (result.error) {
      setError(result.error.message);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    // Konfirmasi ditampilkan sebagai SuccessBanner di detail jadwal saat fokus,
    // mengikuti pola record.tsx → detail tugas worker. router.back() menjaga
    // back-stack tetap bersih (list → detail).
    setPendingFeedback('schedule_updated');
    router.back();
  }

  // "Batalkan jadwal" tinggal DI SINI, bukan di layar detail.
  //
  // Mengikuti pola yang sudah terkunci di aplikasi ini: aksi destruktif "tandai
  // pohon hilang" juga ada di dalam layar edit pohon, bukan di detailnya. Sebuah
  // layar detail dibuka untuk MELIHAT; menaruh aksi yang tidak bisa ditarik
  // kembali di sana berarti ia bisa tersenggol oleh orang yang sekadar
  // memeriksa.
  //
  // Pemindahan ini juga menutup satu masalah dengan sendirinya. Syarat kunci
  // Edit dan Batalkan identik — keduanya isLocked di layar detail, dan di sisi
  // service keduanya lewat getScheduleEditEligibility. Karena Batalkan kini
  // hanya bisa dicapai dari DALAM layar edit, dan layar edit sendiri sudah
  // menolak masuk lewat blockedReason, tidak ada penjaga tambahan yang perlu
  // ditulis: jadwal yang tidak bisa diedit tidak punya jalan sampai ke tombol
  // ini.
  async function runCancelSchedule() {
    if (!schedule) {
      return;
    }

    setCancelLoading(true);
    setError(null);

    const result = await cancelCareSchedule({ scheduleId: schedule.id });

    if (result.error) {
      setError(result.error.message);
      setCancelLoading(false);
      setCancelConfirmOpen(false);
      return;
    }

    setCancelLoading(false);
    setCancelConfirmOpen(false);
    setPendingFeedback('schedule_updated');
    router.back();
  }

  if (loading) {
    return <LoadingState message="Menyiapkan form edit jadwal..." />;
  }

  if (!schedule || !values) {
    return (
      <Screen header={<TopAppBar title="Edit jadwal" onBack={() => router.back()} />}>
        <ErrorBanner message={error} />
        <EmptyState title="Jadwal tidak ditemukan" subtitle="Jadwal mungkin tidak tersedia atau akses ditolak." />
      </Screen>
    );
  }

  if (blockedReason) {
    return (
      <Screen header={<TopAppBar title="Edit jadwal" onBack={() => router.back()} />}>
        <ErrorBanner message={error} />
        <Card variant="warning">
          <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: '700' }}>
            Jadwal tidak bisa diedit
          </Text>
          <Text selectable style={{ color: colors.textMuted, lineHeight: 21 }}>
            {blockedReason}
          </Text>
        </Card>
      </Screen>
    );
  }

  // Baris ringkasan: string yang SAMA PERSIS dengan judul yang akan tersimpan,
  // ditambah pengulangan kalau jadwal ini memang berulang. Angkanya diambil dari
  // schedule.repeatEveryDays — keadaan baris di database — bukan dari form, yang
  // di layar ini memang tidak memegang pengulangan.
  const summaryTitle = buildScheduleTitle({
    category: values.category,
    customTargetNote: values.targetType === 'custom' ? values.customTargetNote : null,
    targetTreeIds: values.targetTreeIds,
    targetType: values.targetType,
  });
  const summaryLine = summaryTitle
    ? [summaryTitle, schedule.repeatEveryDays === null ? null : `tiap ${schedule.repeatEveryDays} hari`]
        .filter(Boolean)
        .join(' · ')
    : null;

  return (
    <Screen
      header={<TopAppBar title="Edit jadwal" onBack={() => router.back()} />}
      scrollRef={scrollRef}
      stickyFooter={
        <View style={{ gap: tokens.space.sm }}>
          {summaryLine ? (
            <Text
              selectable
              style={{
                ...tokens.type.meta,
                color: tokens.color.text.tertiary,
                textAlign: 'center',
              }}
            >
              {summaryLine}
            </Text>
          ) : null}
          <Button
            title="Simpan perubahan"
            loading={submitting}
            loadingTitle="Menyimpan…"
            onPress={handleSubmit}
          />
        </View>
      }
    >
      <ErrorBanner message={error} />
      <View onLayout={(event: LayoutChangeEvent) => (formTop.current = event.nativeEvent.layout.y)}>
        <ManualScheduleForm
          errors={errors}
          onChange={handleValuesChange}
          onFieldLayout={(key, y) => {
            fieldOffsets.current[key] = y;
          }}
          // Layar ini TIDAK menyediakan cara mengubah atau menghentikan
          // pengulangan: updateCareSchedule tidak menulis repeat_every_days,
          // jadi kontrol apa pun di sini akan berbohong. Menghentikan rantai
          // jalurnya stopScheduleRepeat dari layar detail jadwal.
          //
          // Keterangannya kini masuk KE DALAM form, di slot yang sama dengan
          // field Pengulangan milik layar Buat, sebagai baris read-only datar —
          // dulu ia kotak bertint berikon yang melayang di atas formulir dan
          // membuat kedua layar terbaca punya susunan berbeda. Jadwal sekali
          // jalan tidak merender apa pun: "Sekali" adalah ketiadaan
          // pengulangan, bukan fakta yang perlu satu baris sendiri.
          repeatSummary={
            schedule.repeatEveryDays === null ? null : `Berulang tiap ${schedule.repeatEveryDays} hari`
          }
          trees={pickerTrees(trees, values.targetTreeIds)}
          values={values}
          workers={workers}
        />
      </View>

      {/* Aksi merusak duduk DI BAWAH form, di badan layar — BUKAN di
          stickyFooter bersama "Simpan perubahan".
          Bentuknya disalin apa adanya dari layar edit pohon, tempat "Pohon sudah
          tidak ada" berdiri di posisi yang sama dengan alasan yang sama: footer
          adalah tempat aksi utama, dan dua tombol yang artinya berlawanan
          berdampingan di sana membuat keduanya sama-sama terbaca sebagai
          "selesai". Di badan layar, ia harus digulung untuk ditemukan —
          sepadan dengan seberapa jarang ia dipakai.

          Nada 'danger' di sini merah LEMBUT, bukan tombol merah pekat. */}
      <Button
        disabled={submitting}
        title="Batalkan jadwal"
        variant="danger"
        onPress={() => setCancelConfirmOpen(true)}
      />

      {/* ConfirmDialog bersama, bukan Alert.alert: dialog bawaan sistem tidak
          bisa memakai token warna proyek ini dan judul/tombolnya tidak bisa
          dijamin berbahasa Indonesia di semua perangkat. */}
      <ConfirmDialog
        confirmLabel="Batalkan jadwal"
        loading={cancelLoading}
        message={buildCancelConfirmMessage(schedule, workers)}
        title="Batalkan jadwal?"
        tone="danger"
        visible={cancelConfirmOpen}
        onCancel={() => setCancelConfirmOpen(false)}
        onConfirm={runCancelSchedule}
      />
    </Screen>
  );
}

// Kalimatnya dirakit, bukan satu template. Dipindahkan dari layar detail jadwal
// bersama tombolnya, dengan satu perbedaan: nama pekerja dibaca dari daftar
// pekerja aktif yang memang sudah dimuat layar ini, bukan dari peta profil
// terpisah. Jadwal berulang wajib disebut supaya owner tahu membatalkan ikut
// menghentikan rantainya.
function buildCancelConfirmMessage(
  schedule: CareScheduleDetail,
  workers: WorkerMembership[]
): string {
  const nameByUserId = new Map(workers.map((worker) => [worker.userId, worker.fullName]));
  const workerNamesList = Array.from(
    new Set(
      schedule.tasks
        .map((task) => nameByUserId.get(task.assignedTo))
        .filter((name): name is string => Boolean(name))
    )
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

function buildInitialValues(schedule: CareScheduleDetail): ManualScheduleFormValues {
  const assignedWorkerId = schedule.tasks[0]?.assignedTo ?? '';

  return {
    assignedWorkerId,
    category: schedule.category,
    customTargetNote: schedule.customTargetNote ?? '',
    instruction: schedule.instruction ?? '',
    // Selalu mati di layar Edit: updateCareSchedule tidak menulis
    // repeat_every_days, jadi form tidak boleh berpura-pura bisa mengubahnya.
    // Status rantainya ditampilkan read-only lewat RepeatStatusNotice.
    repeatEnabled: false,
    repeatEveryDays: '',
    requiresPhoto: schedule.requiresPhoto,
    scheduledDate: schedule.scheduledDate,
    // Dari care_schedule_trees, bukan dari kolom bayangan. Jadwal tiga pohon
    // yang dibuka di layar ini harus kembali sebagai tiga pohon terpilih --
    // membaca bayangan akan mengembalikannya sebagai satu, lalu menyimpan
    // membuang dua sisanya tanpa pemilik pernah memintanya.
    //
    // `?? []` menutup jadwal yang kode pohonnya gagal dimuat: form terbuka
    // dengan nol pohon terpilih dan validasi menahan simpan, alih-alih diam-
    // diam menulis daftar kosong.
    targetTreeIds: schedule.targetTreeIds ?? [],
    targetType: schedule.targetType,
  };
}

// Pemilih menampilkan posisi yang SEDANG DITANAMI, ditambah pohon yang sudah
// terpilih di jadwal ini walau siklusnya sudah ditutup.
//
// Tambahan itu bukan kelonggaran. Menyaringnya habis akan membuat pohon yang
// siklusnya baru ditutup HILANG dari pemilih sementara id-nya tetap terkirim
// saat simpan -- keadaan tersembunyi yang tidak bisa dilihat maupun dibatalkan
// pemilik. Dengan ditampilkan, ia terbaca apa adanya dan bisa dilepas; yang
// tetap tidak bisa dilakukan adalah MENAMBAH posisi tanpa siklus aktif.
function pickerTrees(trees: Tree[], selectedTreeIds: string[]): Tree[] {
  const selected = new Set(selectedTreeIds);

  return trees.filter((tree) => tree.activePlanting !== null || selected.has(tree.id));
}
