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
  EmptyState,
  ErrorBanner,
  LoadingState,
  MenuRow,
  MenuRowGroup,
  MetaRow,
  Screen,
  SectionLabel,
  SuccessBanner,
  TopAppBar,
} from '../../../../src/components/ui';
import type { BadgeTone } from '../../../../src/components/ui';
import type { StatusMarkerShape } from '../../../../src/components/status-marker';
import { colors, radius, spacing, statusColors } from '../../../../src/constants/theme';
import { colors as palette, text as typeScale } from '../../../../src/theme/tokens';
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
import {
  dayDifference,
  formatFullDate,
  getTodayIsoDate,
  scheduleTimeBucket,
} from '../../../../src/utils/taskDueDate';

export default function CareScheduleDetailScreen() {
  const { currentFarm } = useAuth();
  const { scheduleId } = useLocalSearchParams<{ scheduleId: string }>();
  const [error, setError] = React.useState<string | null>(null);
  const [activeWorkers, setActiveWorkers] = React.useState<WorkerMembership[]>([]);
  const [assignLoading, setAssignLoading] = React.useState(false);
  const [assignWorkerId, setAssignWorkerId] = React.useState('');
  const [cancelConfirmOpen, setCancelConfirmOpen] = React.useState(false);
  const [cancelLoading, setCancelLoading] = React.useState(false);
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
      <Screen header={<TopAppBar title="Detail jadwal" onBack={() => router.back()} />}>
        <ErrorBanner message={error} />
        <EmptyState title="Jadwal tidak ditemukan" subtitle="Jadwal mungkin tidak tersedia atau akses ditolak." />
      </Screen>
    );
  }

  const activeSchedule = schedule;
  const todayIso = getTodayIsoDate();
  const hasWorkResult = scheduleHasWorkResult(activeSchedule, taskDetailMap);
  const isLocked = activeSchedule.isCancelled === true || hasWorkResult;
  const statusMark = scheduleStatusMark(activeSchedule, todayIso);

  // Sejak migration 041 jadwal boleh punya NOL tugas: penerus rantai dibuat
  // tanpa tugas kalau pekerjanya sudah keluar dari kebun saat itu.
  const hasTasks = activeSchedule.tasks.length > 0;
  const needsWorker = !hasTasks && activeSchedule.isCancelled !== true;
  const isRecurring = activeSchedule.repeatEveryDays !== null;
  const canStopRepeat = isRecurring && activeSchedule.isCancelled !== true;
  const showEditButton = !isLocked;

  // "BATALKAN JADWAL" KEMBALI KE LAYAR INI, dan dicabut dari layar Edit
  // (adendum §1.8). Spek internal bertentangan — #28 menaruhnya di Detail, #29
  // di Edit — dan adendum memutuskan Detail, atas dasar keluhan yang tercatat
  // bahwa aksi itu terkubur di dalam layar edit: pemilik yang ingin
  // membatalkan harus lebih dulu masuk ke layar yang tujuannya MENGUBAH.
  //
  // Syaratnya sama persis dengan yang dulu berlaku lewat pintu layar edit:
  // isLocked. Jadwal yang sudah punya hasil kerja tidak boleh dibatalkan, dan
  // barisnya karena itu tidak dirender sama sekali — bukan dirender lalu
  // dimatikan. Ini cerminan penjaga di cancel_care_schedule dan di
  // getScheduleEditEligibilityFromDetail; ketiganya harus bergerak bersama.
  const canCancelSchedule = !isLocked;

  // Tanpa jeda setTimeout lagi: dulu perlu menunggu sheet "Kelola jadwal"
  // menutup dulu supaya tidak ada dua overlay bertumpuk. Sheet-nya sudah tidak
  // ada, barisnya langsung di badan layar, jadi dialognya boleh muncul
  // seketika.
  function handleRequestStopRepeat() {
    setStopRepeatConfirmOpen(true);
  }

  // Dipindahkan apa adanya dari layar Edit Jadwal bersama tombolnya. Satu
  // perbedaan: sesudah berhasil, layar ini MEMUAT ULANG dirinya alih-alih
  // router.back(). Jadwal yang dibatalkan masih sah dibuka — ia tetap tercatat,
  // datanya tidak hilang — dan memuat ulang membuat badge "Dibatalkan" serta
  // alasan pembatalannya langsung terlihat di tempat yang sama.
  async function runCancelSchedule() {
    setCancelLoading(true);
    setError(null);

    const result = await cancelCareSchedule({ scheduleId: activeSchedule.id });

    if (result.error) {
      setError(result.error.message);
      setCancelLoading(false);
      setCancelConfirmOpen(false);
      return;
    }

    await loadDetail();
    setCancelLoading(false);
    setCancelConfirmOpen(false);
    setSuccess('Jadwal dibatalkan. Catatannya tetap tersimpan.');
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
        <TopAppBar title="Detail jadwal" onBack={() => router.back()} />
      }
      // SATU tombol di bar aksi: "Edit jadwal". Kedua aksi merusak turun ke
      // badan layar sebagai baris — lihat blok <MenuRowGroup> di bawah.
      //
      // Hanya aksi yang BERLAKU yang dirender; tidak ada satu pun tombol dalam
      // keadaan mati. Tombol mati yang tidak menanggapi ketukan lebih
      // membingungkan daripada tombol yang tidak ada, dan badge status di atas
      // sudah menjelaskan kenapa.
      stickyFooter={
        showEditButton ? (
          <Button
            title="Edit jadwal"
            variant="primary"
            onPress={() => router.push(`/owner/schedules/${activeSchedule.id}/edit`)}
          />
        ) : undefined
      }
    >
      {/* SATU KALIMAT, dan kalimat itu yang diminta adendum §4.4 apa adanya.
          Versi lama menjelaskan mekanisme rantai ("tidak ada jadwal baru yang
          dibuat setelah tugasnya selesai") — benar, tapi menjawab pertanyaan
          yang tidak ditanyakan. Yang ditakutkan pemilik saat menekan tombol ini
          adalah kehilangan apa yang SUDAH ada, dan itulah yang dijawab. */}
      <ConfirmDialog
        confirmLabel="Hentikan pengulangan"
        loading={stopRepeatLoading}
        message="Tugas yang sudah ada tetap tersimpan."
        title="Hentikan pengulangan?"
        tone="default"
        visible={stopRepeatConfirmOpen}
        onCancel={() => setStopRepeatConfirmOpen(false)}
        onConfirm={runStopRepeat}
      />

      {/* ConfirmDialog bersama, bukan Alert.alert: dialog bawaan sistem tidak
          bisa memakai token warna proyek ini dan judul/tombolnya tidak bisa
          dijamin berbahasa Indonesia di semua perangkat. */}
      <ConfirmDialog
        confirmLabel="Batalkan jadwal"
        loading={cancelLoading}
        message={buildCancelConfirmMessage(activeSchedule, workerNames)}
        title="Batalkan jadwal?"
        tone="danger"
        visible={cancelConfirmOpen}
        onCancel={() => setCancelConfirmOpen(false)}
        onConfirm={runCancelSchedule}
      />

      <ErrorBanner message={error} />
      <SuccessBanner message={success} />

      {/* SUSUNAN KEPALA, sejajar dengan detail catatan pohon (batch 5):
            1. badge status   2. nilai utama serif   3. baris fakta

          Judulnya JENIS PERAWATAN, bukan `schedule.title`. Judul di data
          dirakit program dari jenis dan target ("Pemupukan — 3 pohon"), dan
          jadwal lama masih memegang judul yang diketik manusia ("Test",
          "awas"). Keduanya bukan nama yang layak jadi baris terbesar di layar;
          yang selalu berarti sama bagi siapa pun adalah jenis pekerjaannya.
          Targetnya tidak hilang — ia turun jadi baris fakta di bawah. */}
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
          {formatCareCategory(activeSchedule.category)}
        </Text>
        {activeSchedule.isCancelled && activeSchedule.cancelReason ? (
          <Text selectable style={{ color: colors.textMuted, fontSize: 13, lineHeight: 18 }}>
            {`Alasan: ${activeSchedule.cancelReason}`}
          </Text>
        ) : null}
      </View>

      {/* LIMA BARIS FAKTA, urutannya dikunci spek: jatuh tempo, pengulangan,
          pekerja, target, bukti foto.

          Menggantikan dua baris meta bertitik-tengah, satu chip tempo, satu
          chip pengulangan, dan satu lingkaran kamera tanpa label. Kelimanya
          dulu tersebar di tiga ketinggian berbeda dan dua di antaranya —
          lingkaran kamera dan chip pengulangan — hanya bisa dibaca oleh orang
          yang sudah tahu artinya. Sebagai baris berlabel, semuanya menyebut
          namanya sendiri.

          Tanggal dipakai lewat formatFullDate dari taskDueDate, bukan
          toLocaleDateString lokal yang dulu ada di dasar berkas ini: yang
          terakhir mengurai 'YYYY-MM-DD' sebagai UTC dan bergeser sehari di zona
          negatif, padahal seluruh klasifikasi waktu aplikasi ini dipatok WIB. */}
      <View style={{ gap: spacing.md }}>
        <MetaRow label="Jatuh tempo" value={formatFullDate(activeSchedule.scheduledDate)} />
        <MetaRow
          label="Pengulangan"
          value={isRecurring ? `Tiap ${activeSchedule.repeatEveryDays} hari` : 'Sekali'}
        />
        <MetaRow label="Pekerja" value={formatScheduleWorkers(activeSchedule, workerNames)} />
        <MetaRow label="Target" value={formatCareTarget(activeSchedule)} />
        <MetaRow label="Bukti foto" value={activeSchedule.requiresPhoto ? 'Wajib' : 'Tidak wajib'} />
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

      {/* Section "Instruksi" tidak dirender sama sekali kalau kosong. Teks
          "Belum ada instruksi tambahan." adalah judul section yang menjelaskan
          bahwa section itu tidak punya isi — dua baris untuk menyampaikan
          ketiadaan. */}
      {activeSchedule.instruction ? (
        <View style={{ gap: spacing.xs }}>
          <SectionLabel title="Instruksi" />
          <Text selectable style={{ color: colors.text, fontSize: 16, lineHeight: 24 }}>
            {activeSchedule.instruction}
          </Text>
        </View>
      ) : null}

      {/* SEKSI "HASIL KERJA" SELALU DIRENDER, termasuk saat jadwalnya belum
          punya tugas sama sekali.

          Sebelum ini seksinya HILANG di keadaan itu, dan hilangnya diam-diam:
          pemilik yang membuka jadwal penerus rantai — yang lahir tanpa tugas
          karena pekerjanya sudah keluar — tidak melihat apa pun tentang hasil
          kerja dan tidak punya cara tahu apakah itu berarti "belum ada" atau
          "seksinya memang tidak berlaku di sini".

          Kalimat kosongnya menyebut SEBAB, bukan ketiadaan data. Sebuah jadwal
          membawa TUGAS, bukan riwayat penyelesaian; kalau belum ada yang
          mencatat, yang benar adalah mengatakan begitu — bukan "belum ada data",
          yang terbaca seperti kegagalan memuat.

          Namanya disebut kalau memang ada di data yang sudah diambil layar ini
          (peta workerNames dari getFarmMemberBasicProfiles). Kalau tidak,
          kalimatnya berjalan tanpa nama — tidak ada nama karangan. */}
      <View style={{ gap: spacing.md }}>
        <SectionLabel title="Hasil kerja" />
        {!hasTasks ? (
          <Text selectable style={emptyResultStyle}>
            Jadwal ini belum ditugaskan ke siapa pun, jadi belum ada yang bisa mencatat hasil kerja.
          </Text>
        ) : (
          activeSchedule.tasks.map((task) => {
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
                  <Text selectable style={emptyResultStyle}>
                    {workerName
                      ? `${workerName} belum mencatat hasil kerja untuk jadwal ini.`
                      : 'Pekerjanya belum mencatat hasil kerja untuk jadwal ini.'}
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
          })
        )}
      </View>

      {/* DUA AKSI MERUSAK, sebagai BARIS di badan layar — bukan tombol di bar
          aksi. Bentuk yang sama persis dengan "Pohon sudah tidak ada" di layar
          edit pohon (batch 4b), dan dengan alasan yang sama: bar aksi adalah
          tempat aksi utama layar ini, dan tombol yang artinya berlawanan
          berdampingan di sana membuat keduanya sama-sama terbaca sebagai
          "selesai". Di badan layar, keduanya harus digulung untuk ditemukan —
          sepadan dengan seberapa jarang dipakai.

          navigates={false}: keduanya membuka dialog di tempat, bukan berpindah
          layar. <MenuRow> memang sudah menjatuhkan chevron untuk baris danger
          secara bawaan; ditulis eksplisit supaya alasannya terbaca.

          SYARATNYA SENGAJA TIDAK SAMA. "Batalkan jadwal" terkunci oleh hasil
          kerja (isLocked); "Hentikan pengulangan" TIDAK. Jadwal berulang yang
          tugas pertamanya sudah selesai justru saat paling wajar pemilik ingin
          menyetop rantainya — kalau ikut terkunci, rantainya jalan selamanya. */}
      {canCancelSchedule || canStopRepeat ? (
        <MenuRowGroup>
          {canCancelSchedule ? (
            <MenuRow
              danger
              icon="x"
              label="Batalkan jadwal"
              meta="Tugasnya berhenti. Catatannya tetap tersimpan."
              navigates={false}
              onPress={() => setCancelConfirmOpen(true)}
            />
          ) : null}
          {canStopRepeat ? (
            <MenuRow
              danger
              icon="repeat"
              label="Hentikan pengulangan"
              meta="Jadwal ini tetap dikerjakan. Tidak ada lanjutannya."
              navigates={false}
              onPress={handleRequestStopRepeat}
            />
          ) : null}
        </MenuRowGroup>
      ) : null}
    </Screen>
  );
}

// Gaya kalimat "belum ada apa-apa" di seksi Hasil kerja. SATU nilai untuk
// ketiga kalimatnya supaya tidak ada yang bisa menyimpang sendiri.
const emptyResultStyle = { color: colors.textMuted, fontSize: 14, lineHeight: 20 };

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


// getActivityTone() dan WorkResultCard dihapus: bentuk baris hasil kerja kini
// milik WorkResultList, dipakai bersama layar pekerja.

// SATU tabel keadaan jadwal, menggantikan formatScheduleStatus + getScheduleTone
// + scheduleDueDatePill yang dulu berdampingan di layar ini.
//
// Ketiganya bersama-sama menghasilkan DUA chip di kepala layar — satu berbunyi
// "Belum dikerjakan", satu lagi "Terlambat 3 hari" — yang menyatakan keadaan
// yang sama dengan dua kosakata yang berbeda, dan salah satunya (chip tempo)
// mengulang tanggal yang sudah tertulis di baris fakta di bawahnya. Sekarang
// satu badge, satu kata, satu bentuk.
//
// PENANDA BENTUK di tiap keadaan, bukan hanya warna — aturan yang sama yang
// melahirkan StatusMarker di batch 1a: nada warna dilarang jadi satu-satunya
// pembeda. Pemetaannya:
//
//   Dibatalkan           circle-outline  danger   rencananya ada, isinya kosong
//   Hangus               cross           danger   lewat toleransi, tidak bisa ditunda lagi
//   Telat N hari         triangle-up     danger   tunggakan, masih bisa dikerjakan
//   Jatuh tempo hari ini square          warning
//   Ditunda              triangle-down   warning  didorong ke belakang
//   Selesai              circle-filled   success
//   Belum dikerjakan     (tanpa penanda) muted    keadaan dasar: belum ada apa-apa, dan tidak ada yang salah
//
// Baris terakhir sengaja POLOS. Aturan pada prop `marker` di <Badge> menyimpan
// penanda bentuk untuk chip yang membawa STATUS; "Belum dikerjakan" adalah
// ketiadaan status, dan memberinya bentuk membuat kosakata bentuk berarti "ini
// sebuah chip", yang tidak berguna.
//
// "Hangus" dan "Telat" SENGAJA memakai kata dan bentuk yang berbeda, dan itu
// yang diminta adendum §4.6. Kata "Terlambat" tidak dipakai untuk satu pun dari
// keduanya di layar ini — baris daftar di /owner/schedules memakai pasangan kata
// dan bentuk yang sama persis.
type ScheduleStatusMark = {
  label: string;
  marker?: StatusMarkerShape;
  tone: BadgeTone;
};

function scheduleStatusMark(schedule: CareScheduleDetail, todayIso: string): ScheduleStatusMark {
  if (schedule.isCancelled) {
    return { label: 'Dibatalkan', marker: 'circle-outline', tone: 'danger' };
  }

  if (schedule.tasks.length > 0 && schedule.tasks.every((task) => task.status === 'completed')) {
    return { label: 'Selesai', marker: 'circle-filled', tone: 'success' };
  }

  // Ember waktu yang SAMA yang dipakai daftar jadwal untuk menempatkan baris ini
  // di section Telat/Hari ini/Mendatang. Dipakai ulang, bukan dihitung ulang:
  // badge yang berbunyi "Jatuh tempo hari ini" pada jadwal yang barusan duduk di
  // bawah label "Telat" adalah dua jawaban untuk satu pertanyaan.
  const bucket = scheduleTimeBucket(schedule, schedule.tasks, todayIso);

  if (bucket === 'missed') {
    return { label: 'Hangus', marker: 'cross', tone: 'danger' };
  }

  if (bucket === 'overdue') {
    const days = Math.max(1, dayDifference(scheduleOverdueSinceIso(schedule), todayIso));

    return { label: `Telat ${days} hari`, marker: 'triangle-up', tone: 'danger' };
  }

  if (bucket === 'today') {
    return { label: 'Jatuh tempo hari ini', marker: 'square', tone: 'warning' };
  }

  // Diperiksa SESUDAH ember waktu: tugas yang ditunda ke tanggal yang sudah
  // lewat tetap tunggakan lebih dulu, dan "Ditunda" pada baris yang telat tiga
  // hari menutupi kabar yang lebih mendesak.
  if (schedule.tasks.some((task) => task.status === 'postponed')) {
    return { label: 'Ditunda', marker: 'triangle-down', tone: 'warning' };
  }

  return { label: 'Belum dikerjakan', tone: 'muted' };
}

// Tanggal acuan penghitungan keterlambatan, sama persis dengan yang dipakai
// daftar jadwal. Tugas boleh punya due_date sendiri, jadi dipakai tenggat
// TERAWAL yang belum selesai; kalau jadwal belum punya tugas sama sekali,
// acuannya tanggal jadwal itu sendiri.
function scheduleOverdueSinceIso(schedule: CareScheduleDetail): string {
  const openDueDates = schedule.tasks
    .filter((task) => task.status !== 'completed')
    .map((task) => task.dueDate);

  if (openDueDates.length === 0) {
    return schedule.scheduledDate;
  }

  return openDueDates.reduce((earliest, dueDate) => (dueDate < earliest ? dueDate : earliest));
}

// Kalimat konfirmasi pembatalan, dirakit — bukan satu template. Dipindahkan dari
// layar Edit Jadwal bersama tombolnya (adendum §1.8), dengan satu perbedaan:
// nama pekerja dibaca dari peta profil yang memang sudah dipegang layar ini,
// bukan dari daftar pekerja aktif. Jadwal berulang wajib disebut supaya pemilik
// tahu membatalkan ikut menghentikan rantainya.
//
// TANPA KATA "HAPUS", dan itu mengikat (adendum §1.8). Yang terjadi adalah
// PEMBATALAN: barisnya tetap ada di database, tugasnya tetap tercatat, dan
// jadwalnya masih bisa dibuka sesudahnya. Kata "hapus" akan salah menamai apa
// yang terjadi, persis seperti "Pohon sudah tidak ada" di batch 4b.
function buildCancelConfirmMessage(
  schedule: CareScheduleDetail,
  workerNames: Record<string, string>
): string {
  const names = Array.from(
    new Set(
      schedule.tasks
        .map((task) => workerNames[task.assignedTo])
        .filter((name): name is string => Boolean(name))
    )
  );

  const lead =
    schedule.tasks.length === 0
      ? 'Jadwal ini belum punya tugas, jadi tidak ada pekerjaan aktif yang dibatalkan.'
      : names.length > 0
        ? `Tugas dari jadwal ini tidak lagi muncul sebagai pekerjaan aktif untuk ${names.join(', ')}.`
        : 'Tugas dari jadwal ini tidak lagi muncul sebagai pekerjaan aktif.';

  const repeatNote =
    schedule.repeatEveryDays !== null
      ? ' Pengulangannya ikut berhenti, jadi tidak ada jadwal lanjutan yang dibuat.'
      : '';

  return `${lead}${repeatNote} Catatannya tetap tersimpan, tapi pembatalan ini tidak bisa ditarik kembali.`;
}

// Menentukan `isLocked`, yang mematikan "Edit jadwal" DAN baris "Batalkan
// jadwal" — jadi inilah aturan yang benar-benar terlihat di perangkat, bukan
// penjaga di sisi database.
//
// Sejak migrasi 052: hanya aktivitas ber-status 'completed' yang mengunci.
// Baris 'postponed' dulu ikut mengunci, sehingga tugas yang ditunda pekerja
// membuat owner kehabisan aksi sama sekali — tidak bisa mengedit, tidak bisa
// membatalkan, padahal pekerjaannya justru belum terjadi.
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

