import { router } from 'expo-router';
import React from 'react';
import { ScrollView, View, type LayoutChangeEvent } from 'react-native';

import {
  ManualScheduleForm,
  clearResolvedScheduleFormErrors,
  hasScheduleFormErrors,
  scheduleFormFieldOrder,
  validateScheduleForm,
  type ManualScheduleFormValues,
  type ScheduleFormErrors,
} from '../../../../src/components/care-schedule-components';
import { ConfirmDialog } from '../../../../src/components/bottom-sheet';
import { Button, ErrorBanner, LoadingState, Screen, TopAppBar } from '../../../../src/components/ui';
import { useAuth } from '../../../../src/context/auth-context';
import {
  consumePendingScheduleTrees,
  peekPendingScheduleTrees,
} from '../../../../src/lib/pendingScheduleTrees';
import { createManualSchedule } from '../../../../src/services/careScheduleService';
import { getActiveWorkers } from '../../../../src/services/memberService';
import { getTrees } from '../../../../src/services/treeService';
import type { CareCategory, Tree, WorkerMembership } from '../../../../src/types/domain';
import { getTodayIsoDate } from '../../../../src/utils/taskDueDate';

const initialValues: ManualScheduleFormValues = {
  assignedWorkerId: '',
  category: '',
  customTargetNote: '',
  instruction: '',
  repeatEnabled: false,
  repeatEveryDays: '',
  requiresPhoto: false,
  scheduledDate: getTodayIsoDate(),
  targetTreeIds: [],
  targetType: 'farm',
  title: '',
};

// Posisi tanpa siklus tanam aktif tidak boleh muncul di pemilih.
//
// Disaring DI SINI, bukan di getTrees. getTrees sengaja tetap membawa posisi
// kosong -- daftar pohon dan denah kebun memang harus menampilkannya. Yang
// tidak boleh dijadwalkan hanyalah posisi yang tidak sedang ditanami, dan itu
// urusan layar ini.
//
// Penyaring yang SEBENARNYA tetap ada di create_manual_schedule (migrasi 057).
// Penyaringan di sini hanya supaya pemilik tidak pernah melihat pilihan yang
// akan ditolak; ia bukan pengganti penjaga di sisi database.
function selectableTrees(trees: Tree[]): Tree[] {
  return trees.filter((tree) => tree.activePlanting !== null);
}

// Nilai awal form, dengan pilihan yang diserahkan peta denah kalau memang ada.
//
// Menyerahkan pilihan berarti pemilik sudah menyatakan targetnya pohon, jadi
// targetType ikut disetel 'tree' -- tanpa itu pemilih pohonnya bahkan tidak
// dirender dan daftar yang baru saja dipilih tidak terlihat di mana pun.
//
// Peta hanya mengizinkan memilih posisi yang punya siklus tanam aktif, syarat
// yang SAMA dengan selectableTrees di atas. Kalau sebuah siklus kebetulan
// ditutup di sela peta dan layar ini, id-nya tetap terbawa di sini tapi tidak
// punya baris di pemilih; create_manual_schedule yang menolaknya, dan dialog
// "sebagian pohon tidak ikut" di bawah sudah menangani persis keadaan itu.
function buildInitialValues(): ManualScheduleFormValues {
  const pendingTreeIds = peekPendingScheduleTrees();

  if (!pendingTreeIds || pendingTreeIds.length === 0) {
    return initialValues;
  }

  return {
    ...initialValues,
    targetTreeIds: [...pendingTreeIds],
    targetType: 'tree',
  };
}

export default function CreateManualScheduleScreen() {
  const { currentFarm } = useAuth();
  const [error, setError] = React.useState<string | null>(null);
  const [errors, setErrors] = React.useState<ScheduleFormErrors>({});
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [createdScheduleId, setCreatedScheduleId] = React.useState<string | null>(null);
  const [rejectedMessage, setRejectedMessage] = React.useState<string | null>(null);
  const [trees, setTrees] = React.useState<Tree[]>([]);
  const [values, setValues] = React.useState<ManualScheduleFormValues>(buildInitialValues);
  const [workers, setWorkers] = React.useState<WorkerMembership[]>([]);

  const scrollRef = React.useRef<ScrollView>(null);
  const formTop = React.useRef(0);
  const fieldOffsets = React.useRef<Record<string, number>>({});

  const farmId = currentFarm?.farmId;

  // Serah-terima dari peta denah dipakai TEPAT SEKALI. Dihapus di sini, bukan
  // saat dibaca: buildInitialValues jalan di dalam penginisialisasi useState,
  // yang boleh dipanggil lebih dari sekali, dan menghapus di sana akan
  // mengosongkan pilihan pada pemanggilan kedua. Effect kosong-dependensi ini
  // jalan tepat sekali setelah pemasangan, saat nilainya sudah masuk state.
  React.useEffect(() => {
    consumePendingScheduleTrees();
  }, []);

  React.useEffect(() => {
    let isMounted = true;

    async function loadFormData() {
      if (!farmId) {
        setError('Data kebun aktif tidak ditemukan.');
        setLoading(false);
        return;
      }

      setError(null);

      const [workersResult, treesResult] = await Promise.all([
        getActiveWorkers(farmId),
        getTrees({
          archived: false,
          farmId,
        }),
      ]);

      if (!isMounted) {
        return;
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
  }, [farmId]);

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
    const nextErrors = validateScheduleForm(values);

    if (hasScheduleFormErrors(nextErrors)) {
      setErrors(nextErrors);
      scrollToFirstError(nextErrors);
      return;
    }

    setErrors({});

    if (!farmId) {
      setError('Data kebun aktif tidak ditemukan.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const result = await createManualSchedule({
      assignedWorkerId: values.assignedWorkerId,
      // Aman: validateScheduleForm memastikan kategori sudah dipilih.
      category: values.category as CareCategory,
      customTargetNote: values.targetType === 'custom' ? values.customTargetNote : null,
      farmId,
      instruction: values.instruction,
      // Aman: validateScheduleForm sudah memastikan angkanya bulat & dalam batas
      // saat repeatEnabled. "Sekali" mengirim null, bukan 0.
      repeatEveryDays: values.repeatEnabled ? Number(values.repeatEveryDays.trim()) : null,
      requiresPhoto: values.requiresPhoto,
      scheduledDate: values.scheduledDate,
      targetTreeIds: values.targetType === 'tree' ? values.targetTreeIds : undefined,
      targetType: values.targetType,
      title: values.title,
    });

    if (result.error) {
      setError(result.error.message);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);

    // Sebagian pohon ditolak RPC karena posisinya sedang tidak ditanami.
    // BUKAN galat: jadwalnya sudah jadi untuk pohon yang sah. Pemilik ditahan
    // sebentar dengan dialog konfirmasi supaya keterangannya terbaca, lalu
    // dilepas ke detail jadwal yang sama seperti jalur normal.
    //
    // Ini praktis hanya terjadi kalau siklus tanam sebuah posisi ditutup di
    // antara layar ini dimuat dan tombol simpan ditekan -- pemilih di atas
    // sudah menyaringnya lebih dulu.
    if (result.data.rejectedMessage) {
      setRejectedMessage(result.data.rejectedMessage);
      setCreatedScheduleId(result.data.scheduleId);
      return;
    }

    router.replace(`/owner/schedules/${result.data.scheduleId}`);
  }

  if (loading) {
    return <LoadingState message="Menyiapkan form jadwal..." />;
  }

  return (
    <Screen
      header={<TopAppBar title="Buat Jadwal" onBack={() => router.back()} />}
      scrollRef={scrollRef}
      stickyFooter={<Button title="Simpan jadwal" loading={submitting} onPress={handleSubmit} />}
    >
      <ErrorBanner message={error} />
      <View onLayout={(event: LayoutChangeEvent) => (formTop.current = event.nativeEvent.layout.y)}>
        <ManualScheduleForm
          errors={errors}
          onChange={handleValuesChange}
          onFieldLayout={(key, y) => {
            fieldOffsets.current[key] = y;
          }}
          showRepeat
          trees={selectableTrees(trees)}
          values={values}
          workers={workers}
        />
      </View>
      <ConfirmDialog
        cancelLabel="Kembali ke daftar jadwal"
        confirmLabel="Lihat jadwal ini"
        icon="alert-triangle"
        message={rejectedMessage ?? ''}
        title="Jadwal dibuat, sebagian pohon tidak ikut"
        visible={Boolean(rejectedMessage && createdScheduleId)}
        onCancel={() => {
          setRejectedMessage(null);
          router.replace('/owner/schedules');
        }}
        onConfirm={() => {
          setRejectedMessage(null);

          if (createdScheduleId) {
            router.replace(`/owner/schedules/${createdScheduleId}`);
          }
        }}
      />
    </Screen>
  );
}
