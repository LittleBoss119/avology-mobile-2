import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';

import { ConfirmDialog } from '../../../src/components/bottom-sheet';
import { Icon } from '../../../src/components/icons';
import { Avatar, MemberRow } from '../../../src/components/member-row';
import { useSnackbar } from '../../../src/components/snackbar';
import {
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  LoadingState,
  Screen,
  SectionLabel,
  TopAppBar,
} from '../../../src/components/ui';
import { tokens } from '../../../src/constants/theme';
import { useAuth } from '../../../src/context/auth-context';
import {
  approveWorker,
  getActiveWorkers,
  getPendingWorkers,
  rejectWorker,
  removeWorker,
} from '../../../src/services/memberService';
import type { WorkerMembership } from '../../../src/types/domain';

// Pengajuan dan anggota diambil lewat DUA RPC terpisah — get_pending_workers dan
// get_active_workers — bukan satu query gabungan yang disaring di klien. Versi
// lama memakai getWorkerMemberships lalu memfilter status di sini, dan itulah
// yang membuat header berbunyi "Anggota · 3 orang" sementara barisnya lima:
// pending ikut terender di daftar yang sama tapi tidak ikut dihitung.
//
// PETAK KODE KEBUN TIDAK ADA LAGI DI LAYAR INI (batch 7b, langkah 2b).
//
// Ia pindah ke layar Data kebun bersama tombol "Bagikan kode" (§39). Kode kebun
// adalah data KEBUN, bukan data orang; dua tampilan untuk satu kode berarti dua
// tempat yang bisa menyimpang, dan yang menyimpang di sini bukan gaya melainkan
// panjangnya — petak lama mencetak kodenya sebagai satu teks monospace,
// sementara layar Gabung kebun dan Data kebun memakai delapan petak. Bersama
// petaknya ikut pergi: getFarmDetail (satu-satunya pembacanya di layar ini),
// tombol "Bagikan", Clipboard, Share, dan ShareGlyph.
//
// BENTUK BARUNYA (§41), menggantikan bottom sheet dua langkah:
//
//   * Pengajuan  -> dua TOMBOL BERLABEL, "Setujui" dan "Tolak", langsung di
//     barisnya. Bukan satu tombol "Tinjau" yang membuka lembar, dan sama sekali
//     bukan sepasang ikon centang-silang: dua ikon berdampingan untuk dua
//     keputusan berlawanan adalah tempat paling mahal untuk salah tekan di
//     seluruh aplikasi ini, dan menolak orang yang seharusnya diterima tidak
//     bisa dibatalkan dari layar ini.
//   * Pekerja aktif -> BARIS YANG BISA DITEKAN, dan ketukannya membuka dialog
//     konfirmasi. Menu "⋯" di ujung baris dicabut: ia ikon tanpa label yang
//     membuka lembar berisi satu aksi, yaitu tiga lapis untuk satu keputusan.
//
// TELEPON DITAMPILKAN DI BARISNYA, bukan disembunyikan di balik lembar. Ia
// satu-satunya cara pemilik mengenali siapa yang mengajukan — dan itu juga
// alasan nomor HP wajib diisi saat mendaftar (§37).

type PendingAction = { kind: 'reject'; worker: WorkerMembership };
type ActiveAction = { kind: 'remove'; worker: WorkerMembership };

export default function OwnerFarmHubScreen() {
  const { currentFarm } = useAuth();
  const showSnackbar = useSnackbar();
  const [pendingWorkers, setPendingWorkers] = React.useState<WorkerMembership[]>([]);
  const [activeWorkers, setActiveWorkers] = React.useState<WorkerMembership[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  // Satu state untuk dua dialog yang tidak pernah terbuka bersamaan, tapi
  // TIPENYA dibedakan: 'reject' dan 'remove' berakhir di RPC yang berbeda
  // dengan akibat yang berbeda, dan satu boolean bersama adalah tempat yang
  // tepat untuk salah cabang.
  const [confirm, setConfirm] = React.useState<PendingAction | ActiveAction | null>(null);
  // Baris pengajuan yang tombolnya sedang menunggu jawaban server. Per-baris,
  // bukan satu bendera untuk seluruh layar: pemilik dengan tiga pengajuan
  // masuk harus tetap melihat dua baris lain hidup saat satu sedang diproses.
  const [pendingBusyId, setPendingBusyId] = React.useState<string | null>(null);

  const farmId = currentFarm?.farmId;

  const load = React.useCallback(async () => {
    if (!farmId) {
      setError('Data kebun aktif tidak ditemukan.');
      setPendingWorkers([]);
      setActiveWorkers([]);
      return;
    }

    setError(null);

    const [pendingResult, activeResult] = await Promise.all([
      getPendingWorkers(farmId),
      getActiveWorkers(farmId),
    ]);

    if (pendingResult.error) {
      setError(pendingResult.error.message);
      setPendingWorkers([]);
    } else {
      setPendingWorkers(pendingResult.data);
    }

    if (activeResult.error) {
      setError(activeResult.error.message);
      setActiveWorkers([]);
    } else {
      setActiveWorkers(
        [...activeResult.data].sort((first, second) => toTime(first.joinedAt) - toTime(second.joinedAt))
      );
    }
  }, [farmId]);

  useFocusEffect(
    React.useCallback(() => {
      setLoading(true);
      load().finally(() => setLoading(false));
    }, [load])
  );

  function handleRetry() {
    setLoading(true);
    load().finally(() => setLoading(false));
  }

  // MENYETUJUI TIDAK MINTA KONFIRMASI, dan itu bukan kelalaian. Menyetujui bisa
  // ditarik kembali lewat "Keluarkan" di seksi di bawahnya; menolak tidak bisa
  // ditarik kembali dari layar ini sama sekali — pemohonnya harus mengajukan
  // ulang. Konfirmasi dipasang pada yang tidak bisa dibatalkan, bukan pada
  // setiap tombol yang menulis sesuatu.
  async function handleApprove(worker: WorkerMembership) {
    setPendingBusyId(worker.membershipId);

    const result = await approveWorker({ membershipId: worker.membershipId });

    setPendingBusyId(null);

    if (result.error) {
      showSnackbar(result.error.message);
      return;
    }

    await load();
    showSnackbar(`${worker.fullName} ditambahkan sebagai pekerja`);
  }

  async function handleReject(worker: WorkerMembership) {
    setBusy(true);

    const result = await rejectWorker({ membershipId: worker.membershipId });

    setBusy(false);

    if (result.error) {
      showSnackbar(result.error.message);
      return;
    }

    setConfirm(null);
    await load();
    showSnackbar(`Pengajuan ${worker.fullName} ditolak`);
  }

  async function handleRemove(worker: WorkerMembership) {
    setBusy(true);

    const result = await removeWorker({ membershipId: worker.membershipId });

    setBusy(false);

    if (result.error) {
      showSnackbar(result.error.message);
      return;
    }

    setConfirm(null);
    await load();
    showSnackbar(`${worker.fullName} dikeluarkan dari kebun`);
  }

  // TopAppBar ber-onBack, BUKAN MainTabHeader. Layar ini bukan tab root: ia
  // dibuka lewat push dari baris "Anggota" di seksi KEBUN tab Profil, dan
  // MainTabHeader tidak pernah merender tombol kembali.
  //
  // Judulnya "Anggota", sama dengan label baris yang mengantar ke sini — judul
  // yang berbeda dari pintu masuknya membuat orang bertanya-tanya apakah ia
  // sampai di tempat yang benar.
  const header = <TopAppBar title="Anggota" onBack={() => router.back()} />;

  if (loading) {
    return <LoadingState header={header} message="Memuat anggota..." />;
  }

  return (
    <Screen header={header}>
      <ErrorBanner message={error} />

      {/* Hilang total kalau tidak ada pengajuan — pemilik tidak perlu diberi
          tahu bahwa tidak ada yang perlu dia kerjakan. */}
      {pendingWorkers.length > 0 ? (
        <View style={{ gap: tokens.space.sm }}>
          <SectionLabel title="Menunggu persetujuan" />
          <View>
            {pendingWorkers.map((worker, index) => (
              <PendingRow
                key={worker.membershipId}
                busy={pendingBusyId === worker.membershipId}
                disabled={busy || (pendingBusyId !== null && pendingBusyId !== worker.membershipId)}
                showHairline={index > 0}
                worker={worker}
                onApprove={() => void handleApprove(worker)}
                onReject={() => setConfirm({ kind: 'reject', worker })}
              />
            ))}
          </View>
        </View>
      ) : null}

      <View style={{ gap: tokens.space.sm }}>
        {/* Jumlahnya MASUK KE DALAM judulnya, bukan berdiri sebagai angka rata
            kanan yang harus dipasangkan sendiri oleh mata. Bentuk yang sama
            dengan label seksi di layar Fase pohon. */}
        <SectionLabel title={`Pekerja aktif · ${activeWorkers.length}`} />
        {activeWorkers.length === 0 ? (
          <EmptyState
            title="Belum ada pekerja"
            subtitle="Bagikan kode kebun dari layar Data kebun supaya pekerja bisa mengajukan diri."
          />
        ) : (
          <View>
            {activeWorkers.map((worker, index) => (
              <View
                key={worker.membershipId}
                style={
                  index > 0
                    ? { borderTopColor: tokens.color.line.hairline, borderTopWidth: 1 }
                    : undefined
                }
              >
                {/* Barisnya YANG DITEKAN, bukan ikon kecil di ujungnya.
                    Chevron-nya dibawa MemberRow lewat slot `trailing`, dan ia
                    penanda "ada yang terbuka di sini" — bukan tombol kedua yang
                    berdiri sendiri. */}
                <MemberRow
                  meta={buildWorkerMeta(worker)}
                  name={worker.fullName}
                  tone="neutral"
                  trailing={<ChevronHint />}
                  onPress={() => setConfirm({ kind: 'remove', worker })}
                />
              </View>
            ))}
          </View>
        )}
      </View>

      {error && pendingWorkers.length === 0 && activeWorkers.length === 0 ? (
        <Card>
          <Text style={{ color: tokens.color.text.secondary, lineHeight: 21 }}>
            Daftar anggota gagal dimuat.
          </Text>
          <Button title="Coba lagi" onPress={handleRetry} />
        </Card>
      ) : null}

      {/* SATU dialog, dua kata-kata. Keduanya merusak dan keduanya bernada
          danger; yang berbeda adalah apa yang hilang, dan itulah yang ditulis
          di kalimatnya.

          "Tugas yang sudah dicatat tetap tersimpan." adalah kalimat §41 apa
          adanya. Ia menjawab ketakutan yang sebenarnya: pemilik yang ragu
          mengeluarkan pekerja bukan ragu soal aksesnya, melainkan soal apakah
          pekerjaan yang sudah tercatat ikut terhapus bersama orangnya. */}
      <ConfirmDialog
        cancelLabel="Batal"
        confirmLabel={confirm?.kind === 'reject' ? 'Tolak' : 'Keluarkan'}
        loading={busy}
        message={
          confirm?.kind === 'reject'
            ? 'Dia harus mengajukan ulang dengan kode kebun kalau kamu berubah pikiran.'
            : 'Tugas yang sudah dicatat tetap tersimpan.'
        }
        title={
          confirm
            ? confirm.kind === 'reject'
              ? `Tolak pengajuan ${confirm.worker.fullName}?`
              : `Keluarkan ${confirm.worker.fullName}?`
            : ''
        }
        tone="danger"
        visible={confirm !== null}
        onCancel={() => {
          if (!busy) {
            setConfirm(null);
          }
        }}
        onConfirm={() => {
          if (!confirm) {
            return;
          }

          if (confirm.kind === 'reject') {
            void handleReject(confirm.worker);
            return;
          }

          void handleRemove(confirm.worker);
        }}
      />
    </Screen>
  );
}

// Baris pengajuan: avatar, nama, telepon, tanggal, lalu DUA TOMBOL BERLABEL.
//
// Tombolnya di BARIS SENDIRI di bawah identitasnya, bukan berdesakan di sisi
// kanan nama. Dua tombol selebar separuh baris punya target sentuh yang layak;
// dua tombol yang berbagi sisa lebar setelah nama tidak, dan nama orang bisa
// panjang.
//
// "Setujui" sekunder, "Tolak" merah tanpa latar. Yang pertama SENGAJA bukan
// tombol utama berlatar penuh: dua keputusan ini setara beratnya, dan mendorong
// mata ke salah satunya adalah hal yang justru tidak boleh dilakukan layar ini.
function PendingRow({
  busy,
  disabled,
  onApprove,
  onReject,
  showHairline,
  worker,
}: {
  busy: boolean;
  disabled: boolean;
  onApprove: () => void;
  onReject: () => void;
  showHairline: boolean;
  worker: WorkerMembership;
}) {
  return (
    <View
      style={{
        borderTopColor: tokens.color.line.hairline,
        borderTopWidth: showHairline ? 1 : 0,
        gap: tokens.space.md,
        paddingVertical: tokens.space.md,
      }}
    >
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: tokens.space.md }}>
        <Avatar name={worker.fullName} tone="warning" />
        <View style={{ flex: 1, gap: 2 }}>
          <Text
            numberOfLines={1}
            selectable
            style={{
              color: tokens.color.text.primary,
              fontSize: tokens.type.bodyStrong.fontSize,
              fontWeight: tokens.type.bodyStrong.fontWeight,
              lineHeight: tokens.type.bodyStrong.lineHeight,
            }}
          >
            {worker.fullName}
          </Text>
          {/* `selectable` pada nomornya, dan itu bukan kebiasaan yang disalin:
              pemilik yang ingin menelepon pemohon menyalin nomornya dari sini.
              Tombol telepon ikon-saja yang dulu ada di dalam lembar dicabut
              bersama lembarnya. */}
          <Text
            numberOfLines={1}
            selectable
            style={{
              color: tokens.color.text.secondary,
              fontSize: tokens.type.bodySmall.fontSize,
              lineHeight: tokens.type.bodySmall.lineHeight,
            }}
          >
            {buildPendingMeta(worker)}
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: tokens.space.sm }}>
        <View style={{ flex: 1 }}>
          <Button
            title="Setujui"
            variant="secondary"
            emphasis="strong"
            disabled={disabled}
            loading={busy}
            onPress={onApprove}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="Tolak" variant="danger" disabled={disabled || busy} onPress={onReject} />
        </View>
      </View>
    </View>
  );
}

// Penanda "baris ini membuka sesuatu". Bentuknya chevron, dan ia SATU-SATUNYA
// isyarat visual yang tersisa setelah menu "⋯" dicabut — barisnya sendiri tidak
// berbingkai dan tidak berlatar.
function ChevronHint() {
  // Ikon, bukan karakter '›'. Karakter teks dirender oleh font perangkat dan
  // bentuk maupun garis dasarnya berbeda antar Android — alasan yang sama yang
  // membuat StatusMarker menolak glif teks. Ukuran dan warnanya disamakan
  // dengan chevron pada <MenuRow> supaya dua bentuk baris yang mengantar ke
  // sesuatu tidak punya dua chevron yang berbeda.
  return <Icon name="chevron-right" size={tokens.icon.md} color={tokens.color.text.tertiary} />;
}

function buildPendingMeta(worker: WorkerMembership): string {
  const phone = formatPhoneNumber(worker.phone);

  return [phone, `Mengajukan ${formatDayMonth(worker.createdAt)}`]
    .filter((part): part is string => Boolean(part))
    .join(' · ');
}

// 'telepon · sejak 12 Mar'. Nomor lebih dulu, dan itu bukan urutan yang
// dikarang: ia yang dipakai mengenali orangnya, sedangkan tanggal bergabung
// keterangan yang jarang menentukan apa pun.
function buildWorkerMeta(worker: WorkerMembership): string {
  const phone = formatPhoneNumber(worker.phone);

  return [phone, `sejak ${formatDayMonth(worker.joinedAt)}`]
    .filter((part): part is string => Boolean(part))
    .join(' · ');
}

// Nomor HP dikelompokkan empat-empat supaya bisa dicocokkan sekilas dengan
// kontak di HP pemilik, bukan dibaca sebagai deret angka panjang.
function formatPhoneNumber(value?: string | null): string | null {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  const digits = trimmed.replace(/\D/g, '');

  if (!digits) {
    return null;
  }

  const groups = digits.match(/.{1,4}/g) ?? [digits];
  return `${trimmed.startsWith('+') ? '+' : ''}${groups.join(' ')}`;
}

function toTime(value?: string | null): number {
  if (!value) {
    return 0;
  }

  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function formatDayMonth(value?: string | null): string {
  if (!value) {
    return '-';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}
