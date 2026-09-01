import * as Clipboard from 'expo-clipboard';
import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { Linking, Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { BottomSheet } from '../../../src/components/bottom-sheet';
import { Icon, type IconName } from '../../../src/components/icons';
import { Avatar, MemberRow } from '../../../src/components/member-row';
import { useSnackbar } from '../../../src/components/snackbar';
import {
  Button,
  Card,
  ErrorBanner,
  LoadingState,
  MetaRow,
  Screen,
  TopAppBar,
} from '../../../src/components/ui';
import { tokens } from '../../../src/constants/theme';
import { useAuth } from '../../../src/context/auth-context';
import { getFarmDetail } from '../../../src/services/farmService';
import {
  approveWorker,
  getActiveWorkers,
  getPendingWorkers,
  rejectWorker,
  removeWorker,
} from '../../../src/services/memberService';
import type { Farm, WorkerMembership } from '../../../src/types/domain';

// Pengajuan dan anggota diambil lewat DUA RPC terpisah — get_pending_workers dan
// get_active_workers — bukan satu query gabungan yang disaring di klien. Versi
// lama memakai getWorkerMemberships lalu memfilter status di sini, dan itulah
// yang membuat header berbunyi "Anggota · 3 orang" sementara barisnya lima:
// pending ikut terender di daftar yang sama tapi tidak ikut dihitung.
// get_pending_workers sempat tercatat sebagai kode mati di audit; sekarang
// dipakai sebagaimana mestinya.

type SheetState = { mode: 'active' | 'pending'; worker: WorkerMembership };
type ConfirmStep = 'reject' | 'remove';

export default function OwnerFarmHubScreen() {
  const { currentFarm, profile } = useAuth();
  const showSnackbar = useSnackbar();
  const [farm, setFarm] = React.useState<Farm | null>(currentFarm?.farm ?? null);
  const [pendingWorkers, setPendingWorkers] = React.useState<WorkerMembership[]>([]);
  const [activeWorkers, setActiveWorkers] = React.useState<WorkerMembership[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [sheet, setSheet] = React.useState<SheetState | null>(null);
  const [confirmStep, setConfirmStep] = React.useState<ConfirmStep | null>(null);

  const farmId = currentFarm?.farmId;
  const ownerName = profile?.fullName ?? 'Pemilik kebun';
  // Pemilik + pekerja aktif. Pengajuan TIDAK dihitung — pending bukan anggota.
  const memberCount = 1 + activeWorkers.length;

  const load = React.useCallback(async () => {
    if (!farmId) {
      setError('Data kebun aktif tidak ditemukan.');
      setFarm(null);
      setPendingWorkers([]);
      setActiveWorkers([]);
      return;
    }

    setError(null);

    const [farmResult, pendingResult, activeResult] = await Promise.all([
      getFarmDetail(farmId),
      getPendingWorkers(farmId),
      getActiveWorkers(farmId),
    ]);

    if (farmResult.error) {
      setError(farmResult.error.message);
      setFarm(null);
      setPendingWorkers([]);
      setActiveWorkers([]);
      return;
    }

    setFarm(farmResult.data);

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

  function closeSheet() {
    if (busy) {
      return;
    }

    setSheet(null);
    setConfirmStep(null);
  }

  async function handleCopyJoinCode() {
    if (!farm?.joinCode) {
      return;
    }

    await Clipboard.setStringAsync(farm.joinCode);
    showSnackbar('Kode disalin');
  }

  // Pemilik dalam kasus ini tinggal jauh dari kebunnya, jadi kodenya hampir pasti
  // dikirim lewat aplikasi pesan. Menyalin lalu berpindah aplikasi itu empat
  // langkah; berbagi satu langkah.
  async function handleShareJoinCode() {
    if (!farm?.joinCode) {
      return;
    }

    await Share.share({ message: `Kode kebun ${farm.name}: ${farm.joinCode}` });
  }

  async function handleApprove(worker: WorkerMembership) {
    setBusy(true);
    const result = await approveWorker({ membershipId: worker.membershipId });
    setBusy(false);

    if (result.error) {
      showSnackbar(result.error.message);
      return;
    }

    setSheet(null);
    setConfirmStep(null);
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

    setSheet(null);
    setConfirmStep(null);
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

    setSheet(null);
    setConfirmStep(null);
    await load();
    showSnackbar(`Akses ${worker.fullName} dinonaktifkan`);
  }

  // TopAppBar ber-onBack, BUKAN MainTabHeader. Layar ini bukan tab root: ia
  // dibuka lewat push dari baris "Anggota" di Beranda, dan MainTabHeader tidak
  // pernah merender tombol kembali (TopAppBar hanya merendernya kalau `onBack`
  // dikirim, dan MainTabHeader tidak mengirimnya). Sebelum ini layar tersebut
  // sama sekali tidak punya afordans mundur di layarnya sendiri.
  //
  // Judulnya "Anggota", sama dengan label baris di Beranda yang mengantar ke
  // sini — judul yang berbeda dari pintu masuknya membuat orang bertanya-tanya
  // apakah ia sampai di tempat yang benar.
  const header = <TopAppBar title="Anggota" onBack={() => router.back()} />;

  if (loading) {
    return <LoadingState message="Memuat kebun..." />;
  }

  if (!farm) {
    return (
      <Screen header={header}>
        <ErrorBanner message={error} />
        <Card>
          <Text style={{ color: tokens.color.text.secondary, lineHeight: 21 }}>Data kebun gagal dimuat.</Text>
          <Button title="Coba lagi" onPress={handleRetry} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen header={header}>
      <ErrorBanner message={error} />

      {/* Identitas kebun — nama, lokasi, luas — beserta tombol edit-nya PINDAH
          ke Beranda, tempat ia jadi judul halaman yang sesungguhnya. Layar ini
          tinggal berisi orang: kode untuk mengundang, pengajuan yang masuk,
          anggota yang ada, dan jejak akses. Jalan ke /owner/farm-profile kini
          lewat baris "Data kebun" di kelompok navigasi Beranda — chip "Ubah
          data kebun" yang dulu disebut di sini sudah ikut dicabut. */}

      {/* Satu-satunya kartu yang dipertahankan di layar ini: isinya benda yang
          disalin dan dibagikan, bukan sekadar teks.

          DUA TOMBOL IKON-SAJA DICABUT. Ikon tanpa label adalah bahasa yang
          harus dipelajari lebih dulu, dan sebagian pemakai aplikasi ini orang
          lanjut usia yang belum pernah mempelajarinya. Salin pindah ke kodenya
          sendiri — benda yang memang ingin disalin — dan Bagikan jadi tombol
          berlabel di bawah kartu. */}
      <Card padding={tokens.layout.cardPadding}>
        <Text selectable style={styles.cardLabel}>
          Kode kebun
        </Text>
        {/* Pressable membungkus, bukan onPress di Text: pembungkus memberi
            target sentuh setinggi tapTarget, sedangkan tinggi Text sendiri
            hanya sebesar barisnya.

            `selectable` DIPERTAHANKAN pada Text-nya. Ia tidak memasang
            penanggap tekan sendiri, jadi ketukan tetap sampai ke Pressable;
            yang ia tambahkan hanya seleksi teks pada tekan-lama. Kalau di
            perangkat ternyata seleksi menelan ketukannya, KETUKAN yang menang
            dan `selectable` yang dibuang — bukan sebaliknya. */}
        <Pressable
          accessibilityHint="Menyalin kode kebun ke papan klip"
          accessibilityLabel={`Salin kode kebun ${farm.joinCode}`}
          accessibilityRole="button"
          onPress={handleCopyJoinCode}
          style={({ pressed }) => ({
            justifyContent: 'center',
            minHeight: tokens.layout.tapTarget,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text selectable style={styles.joinCode}>
            {farm.joinCode}
          </Text>
        </Pressable>
        {/* Aksinya harus DIKATAKAN. Tanpa baris ini tidak ada apa pun yang
            memberi tahu bahwa kodenya bisa diketuk — teks tidak terlihat seperti
            tombol, dan itu memang disengaja supaya kodenya tetap terbaca sebagai
            kode. */}
        <Text selectable style={styles.joinCodeHint}>
          Ketuk kode untuk menyalin
        </Text>
      </Card>

      {/* Tombol lebar berlabel, satu kata. Tanpa umpan balik tambahan: sheet
          bagikan milik sistem yang muncul sesudahnya sudah jadi umpan baliknya. */}
      <Button title="Bagikan" variant="secondary" onPress={handleShareJoinCode} />

      {/* Hilang total kalau tidak ada pengajuan — pemilik tidak perlu diberi tahu
          bahwa tidak ada yang perlu dia kerjakan. */}
      {pendingWorkers.length > 0 ? (
        <>
          <SectionLabel
            title="Pengajuan masuk"
            trailing={
              <Text style={{ color: tokens.color.text.secondary, fontSize: 14 }}>{pendingWorkers.length}</Text>
            }
          />
          <RowGroup>
            {pendingWorkers.map((worker) => (
              <PendingRow
                key={worker.membershipId}
                worker={worker}
                onReview={() => setSheet({ mode: 'pending', worker })}
              />
            ))}
          </RowGroup>
        </>
      ) : null}

      <SectionLabel
        title="Anggota"
        trailing={<Text style={{ color: tokens.color.text.secondary, fontSize: 14 }}>{memberCount} orang</Text>}
      />
      <RowGroup>
        <MemberRow name={ownerName} meta="Pemilik · kamu" tone="accent" />
        {activeWorkers.map((worker) => (
          <MemberRow
            key={worker.membershipId}
            name={worker.fullName}
            meta={`Pekerja · sejak ${formatDayMonth(worker.joinedAt)}`}
            tone="neutral"
            trailing={
              <Pressable
                accessibilityLabel={`Opsi untuk ${worker.fullName}`}
                accessibilityRole="button"
                hitSlop={{ bottom: 8, left: 8, right: 8, top: 8 }}
                onPress={() => setSheet({ mode: 'active', worker })}
                style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, padding: tokens.space.xs })}
              >
                <Icon name="dots" size={20} color={tokens.color.text.tertiary} />
              </Pressable>
            }
          />
        ))}
      </RowGroup>

      {/* Tanpa angka. Penghitung lamanya dihitung dari farm_members berstatus
          rejected/removed, sementara layar tujuannya membaca farm_access_events
          sejak Fase 2 — dan baris stale mulai terhapus sejak Fase 3, jadi
          angkanya makin jauh dari isi layarnya. Pemilik tidak mengambil keputusan
          apa pun dari angka itu. */}
      <NavRow icon="clock" title="Riwayat akses" onPress={() => router.push('/owner/workers')} />

      <BottomSheet
        onClose={closeSheet}
        title={buildSheetTitle(sheet, confirmStep)}
        visible={sheet !== null}
      >
        {sheet ? (
          <SheetBody
            busy={busy}
            confirmStep={confirmStep}
            sheet={sheet}
            onApprove={() => void handleApprove(sheet.worker)}
            onCancelConfirm={() => setConfirmStep(null)}
            onReject={() => void handleReject(sheet.worker)}
            onRemove={() => void handleRemove(sheet.worker)}
            onRequestConfirm={setConfirmStep}
          />
        ) : null}
      </BottomSheet>
    </Screen>
  );
}

// Isi sheet dipisah jadi fungsi sendiri karena ia punya DUA langkah yang saling
// menggantikan di wadah yang sama — bukan dialog baru bertumpuk di atas sheet
// seperti versi lama. Polanya sama dengan sheet keputusan laporan operasional.
function SheetBody({
  busy,
  confirmStep,
  onApprove,
  onCancelConfirm,
  onReject,
  onRemove,
  onRequestConfirm,
  sheet,
}: {
  busy: boolean;
  confirmStep: ConfirmStep | null;
  onApprove: () => void;
  onCancelConfirm: () => void;
  onReject: () => void;
  onRemove: () => void;
  onRequestConfirm: (step: ConfirmStep) => void;
  sheet: SheetState;
}) {
  if (confirmStep) {
    return (
      <ConfirmBody
        busy={busy}
        consequence={
          confirmStep === 'reject'
            ? 'Dia harus mengajukan ulang kalau kamu berubah pikiran.'
            : `${sheet.worker.fullName} akan kehilangan akses ke kebun ini dan perlu mengajukan ulang dengan kode kebun.`
        }
        confirmLabel={confirmStep === 'reject' ? 'Ya, tolak' : 'Ya, nonaktifkan'}
        onCancel={onCancelConfirm}
        onConfirm={confirmStep === 'reject' ? onReject : onRemove}
      />
    );
  }

  if (sheet.mode === 'pending') {
    return (
      <View style={{ gap: tokens.space.lg }}>
        <PhoneRow phone={sheet.worker.phone} />
        <MetaRow label="Diajukan" value={formatDateTimeFull(sheet.worker.createdAt)} />
        {/* Bukan cuma "Terima" — konsekuensinya harus terbaca di tombolnya. */}
        <Button title="Terima sebagai pekerja" loading={busy} onPress={onApprove} />
        <TextAction
          title="Tolak pengajuan"
          tone="danger"
          disabled={busy}
          onPress={() => onRequestConfirm('reject')}
        />
      </View>
    );
  }

  return (
    <View style={{ gap: tokens.space.lg }}>
      <PhoneRow phone={sheet.worker.phone} />
      <MetaRow label="Bergabung" value={formatDateTimeFull(sheet.worker.joinedAt)} />
      <TextAction
        title="Nonaktifkan akses"
        tone="danger"
        disabled={busy}
        onPress={() => onRequestConfirm('remove')}
      />
    </View>
  );
}

function ConfirmBody({
  busy,
  confirmLabel,
  consequence,
  onCancel,
  onConfirm,
}: {
  busy: boolean;
  confirmLabel: string;
  consequence: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <View style={{ gap: tokens.space.lg }}>
      <View
        style={{
          alignItems: 'center',
          alignSelf: 'flex-start',
          backgroundColor: tokens.color.status.danger.bg,
          borderRadius: tokens.radius.pill,
          height: 48,
          justifyContent: 'center',
          width: 48,
        }}
      >
        <Icon name="alert-triangle" size={24} color={tokens.color.status.danger.text} />
      </View>
      <Text
        selectable
        style={{
          color: tokens.color.text.secondary,
          fontSize: tokens.type.body.fontSize,
          lineHeight: tokens.type.body.lineHeight,
        }}
      >
        {consequence}
      </Text>
      {/* Jalan keluar yang aman jadi tombol utama; aksi merusaknya tombol teks. */}
      <Button title="Kembali" disabled={busy} onPress={onCancel} />
      <TextAction title={confirmLabel} tone="danger" loading={busy} onPress={onConfirm} />
    </View>
  );
}

// Nomor HP adalah satu-satunya bukti identitas yang dipegang pemilik, jadi ia
// harus bisa dicocokkan dengan kontak di HP-nya sekilas — karena itu dikelompokkan,
// bukan deretan angka mentah. Tombol teleponnya memakai tel:, BUKAN tautan
// WhatsApp: menebak format internasional dari nomor yang mungkin tidak rapi akan
// gagal diam-diam.
function PhoneRow({ phone }: { phone: string | null }) {
  const formatted = formatPhoneNumber(phone);
  const dialTarget = buildDialTarget(phone);

  return (
    <View style={{ alignItems: 'flex-end', flexDirection: 'row', gap: tokens.space.md }}>
      <View style={{ flex: 1 }}>
        <MetaRow label="Nomor telepon" value={formatted} />
      </View>
      {dialTarget ? (
        <IconActionButton
          label="Telepon pemohon"
          onPress={() => void Linking.openURL(dialTarget)}
          icon={<PhoneGlyph color={tokens.color.brand.base} />}
        />
      ) : null}
    </View>
  );
}

function PendingRow({ onReview, worker }: { onReview: () => void; worker: WorkerMembership }) {
  return (
    <View
      style={{
        alignItems: 'center',
        flexDirection: 'row',
        gap: tokens.space.md,
        paddingVertical: tokens.space.md,
      }}
    >
      <Avatar name={worker.fullName} tone="warning" />
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          numberOfLines={1}
          style={{
            color: tokens.color.text.primary,
            fontSize: tokens.type.bodyStrong.fontSize,
            fontWeight: '700',
            lineHeight: tokens.type.bodyStrong.lineHeight,
          }}
        >
          {worker.fullName}
        </Text>
        <Text
          numberOfLines={1}
          style={{
            color: tokens.color.status.warning.text,
            fontSize: tokens.type.meta.fontSize,
            lineHeight: tokens.type.meta.lineHeight,
          }}
        >
          {`Mengajukan ${formatDayMonth(worker.createdAt)}`}
        </Text>
      </View>
      <Button title="Tinjau" variant="secondary" size="small" onPress={onReview} />
    </View>
  );
}

// Pemisah antar baris pakai garis tipis, bukan kartu pembungkus.
function RowGroup({ children }: { children: React.ReactNode }) {
  const rows = React.Children.toArray(children);

  return (
    <View>
      {rows.map((row, index) => (
        <View
          key={index}
          style={index > 0 ? { borderTopColor: tokens.color.line.hairline, borderTopWidth: 1 } : undefined}
        >
          {row}
        </View>
      ))}
    </View>
  );
}

function NavRow({
  icon,
  onPress,
  subtitle,
  title,
}: {
  icon: IconName;
  onPress: () => void;
  subtitle?: string;
  title: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: 'center',
        flexDirection: 'row',
        gap: tokens.space.md,
        opacity: pressed ? 0.6 : 1,
        paddingVertical: tokens.space.md,
      })}
    >
      <View
        style={{
          alignItems: 'center',
          backgroundColor: tokens.color.surface.subtle,
          borderRadius: tokens.radius.pill,
          height: 38,
          justifyContent: 'center',
          width: 38,
        }}
      >
        <Icon name={icon} size={20} color={tokens.color.brand.base} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          style={{
            color: tokens.color.text.primary,
            fontSize: tokens.type.bodyStrong.fontSize,
            fontWeight: '700',
          }}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={{
              color: tokens.color.text.secondary,
              fontSize: tokens.type.meta.fontSize,
              lineHeight: tokens.type.meta.lineHeight,
            }}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Icon name="chevron-right" size={20} color={tokens.color.text.tertiary} />
    </Pressable>
  );
}

function IconActionButton({
  icon,
  label,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: 'center',
        backgroundColor: pressed ? tokens.color.brand.soft : tokens.color.surface.card,
        borderColor: tokens.color.line.card,
        borderCurve: 'continuous',
        borderRadius: 11,
        borderWidth: 1,
        height: 36,
        justifyContent: 'center',
        width: 36,
      })}
    >
      {icon}
    </Pressable>
  );
}

// Tombol teks. <Button variant="ghost"> selalu memakai warna merek, sedangkan
// aksi merusak butuh warna bahaya tanpa blok berwarna, dan ui.tsx tidak boleh
// disentuh di fase ini.
function TextAction({
  disabled = false,
  loading = false,
  onPress,
  title,
  tone = 'brand',
}: {
  disabled?: boolean;
  loading?: boolean;
  onPress: () => void;
  title: string;
  tone?: 'brand' | 'danger';
}) {
  const color = tone === 'danger' ? tokens.color.status.danger.text : tokens.color.brand.base;
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: tokens.layout.tapTarget,
        opacity: pressed || isDisabled ? 0.5 : 1,
      })}
    >
      <Text selectable={false} style={{ color, fontSize: 16, fontWeight: '700' }}>
        {loading ? 'Memproses...' : title}
      </Text>
    </Pressable>
  );
}

function SectionLabel({ title, trailing }: { title: string; trailing?: React.ReactNode }) {
  return (
    <View
      style={{
        alignItems: 'center',
        flexDirection: 'row',
        gap: tokens.space.md,
        justifyContent: 'space-between',
        paddingTop: tokens.space.xs,
      }}
    >
      <Text
        style={{
          color: tokens.color.text.primary,
          fontSize: tokens.type.heading.fontSize,
          fontWeight: tokens.type.heading.fontWeight,
          lineHeight: tokens.type.heading.lineHeight,
        }}
      >
        {title}
      </Text>
      {trailing}
    </View>
  );
}

// Dua ikon yang belum ada di src/components/icons.tsx, dan file itu di luar
// cakupan fase ini. Path-nya dari Tabler Icons (MIT) varian outline, digambar
// dengan konvensi yang sama: viewBox 24, fill none, stroke membulat.
function PhoneGlyph({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 4h4l2 5l-2.5 1.5a11 11 0 0 0 5 5l1.5 -2.5l5 2v4a2 2 0 0 1 -2 2a16 16 0 0 1 -15 -15a2 2 0 0 1 2 -2"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function ShareGlyph({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M18 6m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M18 18m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M8.7 10.7l6.6 -3.4" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M8.7 13.3l6.6 3.4" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function buildSheetTitle(sheet: SheetState | null, confirmStep: ConfirmStep | null): string {
  if (!sheet) {
    return '';
  }

  if (confirmStep === 'reject') {
    return `Tolak pengajuan ${sheet.worker.fullName}?`;
  }

  if (confirmStep === 'remove') {
    return `Nonaktifkan akses ${sheet.worker.fullName}?`;
  }

  return sheet.worker.fullName;
}

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

function buildDialTarget(value?: string | null): string | null {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  const digits = trimmed.replace(/\D/g, '');

  if (!digits) {
    return null;
  }

  return `tel:${trimmed.startsWith('+') ? '+' : ''}${digits}`;
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

function formatDateTimeFull(value?: string | null): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleString('id-ID', {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

const styles = StyleSheet.create({
  // Label kartu, bentuknya sama dengan judul kartu di Beranda pemilik supaya
  // kartu di dua layar berbeda tidak punya dua tingkat judul yang berbeda.
  // Rata KIRI: ia label, dan aturan desain hanya memusatkan kode kebunnya.
  cardLabel: { ...tokens.type.label, color: tokens.color.text.secondary },

  // RATA TENGAH — kode kebun salah satu dari tiga hal yang boleh rata tengah di
  // layar ini. Monospace supaya angka nol dan huruf O tidak tertukar saat
  // dibacakan lewat telepon, dan letterSpacing supaya karakternya bisa dieja
  // satu per satu.
  joinCode: {
    color: tokens.color.text.primary,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 2,
    textAlign: 'center',
  },
  // Ikut rata tengah karena ia keterangan dari kode di atasnya, bukan label yang
  // berdiri sendiri.
  joinCodeHint: {
    ...tokens.type.meta,
    color: tokens.color.text.secondary,
    textAlign: 'center',
  },
});
