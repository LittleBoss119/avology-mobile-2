import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { tokens } from '../../../src/constants/theme';
import {
  Button,
  Card,
  ErrorBanner,
  LoadingState,
  MenuRowGroup,
  Screen,
  SectionHeader,
} from '../../../src/components/ui';
import { FarmIdentityBlock, TreeStatRow } from '../../../src/components/farm-overview';
import { Icon, type IconName } from '../../../src/components/icons';
import { useAuth } from '../../../src/context/auth-context';
import { getRecentFarmCareActivities } from '../../../src/services/careActivityService';
import { getOwnerDashboardSummary } from '../../../src/services/dashboardService';
import type { OwnerDashboardSummary, RecentFarmCareActivity } from '../../../src/types/domain';
import { daysSinceLocal } from '../../../src/utils/dateDiff';
import { formatCareCategory } from '../../../src/utils/displayFormat';
import { toWibIsoDate } from '../../../src/utils/taskDueDate';

type ActionRowItem = {
  key: string;
  title: string;
  subtitle?: string;
  value: number;
  route: string;
};

export default function OwnerDashboardScreen() {
  const { currentFarm } = useAuth();
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [summary, setSummary] = React.useState<OwnerDashboardSummary | null>(null);
  // KEADAAN TERPISAH dari `summary`, dan itu inti pemisahan kegagalannya.
  // Array kosong berarti "tidak ada aktivitas ATAU pengambilannya gagal" —
  // kedua keadaan itu menghasilkan hal yang sama di layar, yaitu kartunya tidak
  // dirender sama sekali. Kartu ini tambahan, bukan isi utama.
  const [recentActivities, setRecentActivities] = React.useState<RecentFarmCareActivity[]>([]);

  const farmId = currentFarm?.farmId;

  const loadDashboard = React.useCallback(async () => {
    if (!farmId) {
      setError('Data kebun aktif tidak ditemukan.');
      setSummary(null);
      setRecentActivities([]);
      return;
    }

    setError(null);

    // BERDAMPINGAN, bukan berurutan dan bukan di dalam getOwnerDashboardSummary.
    // Keduanya berangkat bersama, dan kegagalan salah satunya tidak menyentuh
    // yang lain — lihat penanganan masing-masing di bawah.
    const [result, recentResult] = await Promise.all([
      getOwnerDashboardSummary({ farmId }),
      getRecentFarmCareActivities({ farmId }),
    ]);

    // Kartu "Terakhir dikerjakan" DILEPAS DIAM-DIAM saat gagal: tidak ada
    // ErrorBanner, tidak ada perubahan pada `error`, dan sisa Beranda tidak
    // tahu-menahu. Satu kartu yang tidak muncul jauh lebih baik daripada
    // Beranda yang tidak bisa dibuka — dan pemilik tidak bisa berbuat apa pun
    // dengan kabar bahwa satu kartu tambahan gagal dimuat.
    //
    // Ditangani LEBIH DULU dari cabang galat summary di bawah, supaya ia tetap
    // dibereskan walau summary-nya yang jatuh.
    setRecentActivities(recentResult.error ? [] : recentResult.data);

    if (result.error) {
      setError('Data beranda belum bisa dimuat.');
      setSummary(null);
      return;
    }

    setSummary(result.data);
  }, [farmId]);

  useFocusEffect(
    React.useCallback(() => {
      setLoading(true);
      loadDashboard().finally(() => setLoading(false));
    }, [loadDashboard])
  );

  if (loading) {
    return <LoadingState message="Memuat dashboard pemilik..." />;
  }

  const farm = currentFarm?.farm;

  // Tanpa prop `header`: judul layar dibuang karena tab bar di bawah sudah
  // menamai layar ini dan menyalakannya. `applyTopInset` WAJIB ikut — inset
  // atas selama ini datang dari TopAppBar di dalam MainTabHeader (ui.tsx),
  // bukan dari Screen, jadi tanpa prop ini isi layar menempel ke status bar.
  return (
    <Screen applyTopInset>
      {/* Hero. Sapaan "Halo, {nama}" dulu berdiri di sini dan sudah lama
          dihapus: ia memakai baris paling atas layar untuk menyebut nama orang
          yang sedang memegang HP-nya sendiri, sementara tempat itu milik
          identitas kebun — satu-satunya hal di layar ini yang menjawab "aku
          sedang melihat apa".

          Kini juga TANPA chip "Ubah data kebun". Jalan ke /owner/farm-profile
          lewat baris "Data kebun" di kelompok navigasi paling bawah, supaya
          setelan kebun berkumpul di satu tempat alih-alih menggantung sebagai
          chip di bawah namanya sendiri. */}
      {farm ? <FarmIdentityBlock farm={farm} /> : null}
      <ErrorBanner message={error} />

      {summary === null ? null : (
        <View style={styles.sections}>
          {/* KEBUN TANPA POHON mengganti kartu ini, BUKAN menghilangkannya:
              tiga angka nol tidak mengabarkan apa-apa, sedangkan satu kalimat
              plus jalan masuk mengabarkan apa yang harus dilakukan berikutnya.
              Kartu Perawatan di bawah memang hilang total dalam keadaan itu —
              kebun tanpa pohon tidak bisa punya tugas perawatan. */}
          {summary.totalTrees === 0 ? <EmptyTreesCard /> : <TreeCard summary={summary} />}

          {summary.totalTrees === 0 ? null : <CareCard summary={summary} />}

          {/* HILANG SELURUHNYA saat tidak ada aktivitas — bukan kartu berisi
              kalimat "belum ada apa-apa", yang menempati ruang sebesar
              pekerjaan sungguhan untuk mengabarkan bahwa tidak ada kabar.
              Array kosong juga keadaan yang sama saat pengambilannya gagal. */}
          {recentActivities.length === 0 ? null : (
            <RecentWorkCard activities={recentActivities} />
          )}

          <Card padding={tokens.layout.cardPadding}>
            <MenuRowGroup>
              {/* Baris fase HILANG saat kebun belum punya pohon — layar
                  tujuannya pasti kosong, dan mengantar ke sana hanya memberi
                  jalan buntu. Dua baris sisanya tetap: keduanya berguna justru
                  pada kebun yang baru dibuat. */}
              {summary.totalTrees === 0 ? null : (
                <NavRow
                  icon="flower"
                  title="Fase pohon"
                  meta={buildPhaseMeta(summary)}
                  onPress={() => router.push('/owner/growth-monitoring')}
                />
              )}
              <NavRow
                icon="user"
                title="Anggota"
                meta={buildPendingMeta(summary)}
                onPress={() => router.push('/owner/farm')}
              />
              <NavRow
                icon="building-warehouse"
                title="Data kebun"
                onPress={() => router.push('/owner/farm-profile')}
              />
            </MenuRowGroup>
          </Card>
        </View>
      )}
    </Screen>
  );
}

// Kartu Pohon. TANPA bar proporsi — tiga angka saja.
//
// Barnya dicabut karena ia hanya bisa membedakan sehat dari "selain sehat", dan
// dua ruas berwarna yang selalu memenuhi lebar penuh menjanjikan pembacaan yang
// lebih teliti daripada yang datanya sanggup berikan. Angkanya sendiri sudah
// mengatakan hal yang sama tanpa janji itu.
//
// "Perlu dicek" masih mencakup pohon MATI — definisi problemTrees tidak
// disentuh di putaran ini (dashboardService.countProblemTrees: current_condition
// <> 'healthy'). Memisahkannya menyentuh angka yang dipakai bersama Beranda
// pekerja, dan itu ditunda ke setelah UAT.
function TreeCard({ summary }: { summary: OwnerDashboardSummary }) {
  return (
    <Pressable onPress={() => router.push('/owner/trees')}>
      <Card padding={tokens.layout.cardPadding}>
        <View style={styles.cardHeader}>
          <Text selectable style={styles.cardTitle}>
            Pohon
          </Text>
          <Icon name="chevron-right" size={tokens.icon.sm} color={tokens.color.text.tertiary} />
        </View>
        <TreeStatRow
          healthyTrees={summary.healthyTrees}
          problemTrees={summary.problemTrees}
          totalTrees={summary.totalTrees}
        />
      </Card>
    </Pressable>
  );
}

// Kartu Perawatan. Dua baris, bukan satu angka gabungan: "telat" dan "hari ini"
// menuntut dua tindakan yang berbeda mendesaknya, dan menjumlahkannya
// menyembunyikan perbedaan itu.
//
// Keduanya sudah ada di OwnerDashboardSummary sejak sebelum putaran ini
// (overdueTasks dan todayTasks) — tidak ada query yang ditambahkan.
function CareCard({ summary }: { summary: OwnerDashboardSummary }) {
  return (
    <Pressable onPress={() => router.push('/owner/schedules')}>
      <Card padding={tokens.layout.cardPadding}>
        <View style={styles.cardHeader}>
          <Text selectable style={styles.cardTitle}>
            Perawatan
          </Text>
          <Icon name="chevron-right" size={tokens.icon.sm} color={tokens.color.text.tertiary} />
        </View>
        <View>
          <CareRow
            color={
              summary.overdueTasks > 0 ? tokens.color.status.danger.text : tokens.color.text.primary
            }
            label="Telat"
            value={summary.overdueTasks}
          />
          <View style={styles.divider} />
          <CareRow color={tokens.color.text.primary} label="Hari ini" value={summary.todayTasks} />
        </View>
      </Card>
    </Pressable>
  );
}

// Kartu "Terakhir dikerjakan". Menjawab pertanyaan ketiga pemilik — apakah
// pekerjaannya benar-benar dikerjakan — yang sebelumnya tidak dijawab di mana
// pun di aplikasi ini.
//
// TIDAK BISA DIKETUK, dan itu keputusan, bukan kelalaian. Ia kartu yang DIBACA,
// bukan pintu: tanpa chevron, tanpa Pressable, tanpa tombol. Rute detail
// aktivitas memang ada —
// /owner/trees/[treeId]/records/care/[recordId] (tree-record-detail-screen) —
// tapi ia menuntut treeId, sedangkan satu aktivitas di sini bisa mencakup
// ratusan pohon dan tidak ada satu pun yang benar untuk dituju. Sengaja tidak
// disambungkan.
//
// SUBJEK TIAP BARIS ADALAH PEKERJAAN PADA POHON, bukan orangnya. Baris atas
// menyebut jenis pekerjaan dan berapa pohon; nama pencatat turun ke baris kedua
// sebagai atribusi, bersama waktunya. Bentuk yang membalik ini — "Om Ari
// mengerjakan…" — akan membuat kartunya terbaca sebagai daftar absensi, dan
// aplikasi ini sistem manajemen kebun, bukan manajemen pekerja.
function RecentWorkCard({ activities }: { activities: RecentFarmCareActivity[] }) {
  return (
    <Card padding={tokens.layout.cardPadding}>
      {/* Tanpa cardHeader ber-chevron seperti dua kartu di atasnya: judul saja,
          karena tidak ada tujuan yang bisa dituju dari sini. */}
      <Text selectable style={styles.cardTitle}>
        Terakhir dikerjakan
      </Text>
      <View>
        {activities.map((activity, index) => (
          <React.Fragment key={activity.id}>
            {index > 0 ? <View style={styles.divider} /> : null}
            <RecentWorkRow activity={activity} />
          </React.Fragment>
        ))}
      </View>
    </Card>
  );
}

function RecentWorkRow({ activity }: { activity: RecentFarmCareActivity }) {
  const attribution = buildAttribution(activity);

  return (
    <View style={styles.recentRow}>
      <Text selectable numberOfLines={1} style={styles.recentTitle}>
        {`${buildWorkLabel(activity)} · ${activity.treeCount} pohon`}
      </Text>
      {/* Baris kedua HILANG seluruhnya kalau tidak ada satu pun yang bisa
          dikatakan — waktu tidak terbaca DAN nama tidak terbaca. Baris kosong
          yang menyisakan tingginya lebih buruk daripada baris yang tidak ada. */}
      {attribution ? (
        <Text selectable numberOfLines={1} style={styles.recentMeta}>
          {attribution}
        </Text>
      ) : null}
    </View>
  );
}

// Jenis pekerjaan. formatCareCategory (displayFormat.ts) adalah pemformat yang
// SUDAH ADA dan dipakai layar tugas, jadwal, dan riwayat pohon — dipakai apa
// adanya supaya kata yang sama muncul di semua tempat.
//
// Judul tugas hanya cadangan TERAKHIR, dan hanya bisa terpakai kalau baris
// terjadwal punya category kosong DAN tugasnya terbaca. Ia diketik pemilik dan
// panjangnya tidak terkendali — numberOfLines={1} di pemanggil yang menahannya
// supaya tidak membungkus, dan bagian "· N pohon" tetap ikut terpotong bersama
// baris itu, bukan terdorong keluar.
//
// 'Perawatan' adalah jalur terakhir: baris terjadwal tanpa category di kedua
// sisi dan tanpa judul. Kata generik lebih jujur daripada tanda hubung, yang
// menyuruh pembacanya menebak apakah datanya kosong atau gagal dimuat.
function buildWorkLabel(activity: RecentFarmCareActivity): string {
  if (activity.category) {
    return formatCareCategory(activity.category);
  }

  return activity.taskTitle ?? 'Perawatan';
}

// Baris kedua: '<waktu> · <nama pencatat>'. Keduanya opsional dan pemisahnya
// ikut hilang bersama bagian yang kosong — bukan '· ' yang menggantung.
function buildAttribution(activity: RecentFarmCareActivity): string | null {
  return [buildRelativeDay(activity.performedAt), activity.performerName]
    .filter(Boolean)
    .join(' · ') || null;
}

// 'Hari ini' / 'Kemarin' / '<n> hari lalu'. FRASA BARU — tidak ada padanannya
// di repo. Yang terdekat, formatAgendaSectionTitle (taskDueDate.ts), mengenal
// 'Hari ini' tapi hanya sebagai bagian dari 'Hari ini · 27 Jun 2026' dan
// pasangannya menatap ke DEPAN ('Besok'), sedangkan kartu ini seluruhnya ke
// belakang.
//
// TIDAK ADA aritmetika tanggal yang ditulis di sini. performed_at adalah
// timestamptz; toWibIsoDate satu-satunya jembatan resmi ke tanggal murni di
// basis kode ini, dan daysSinceLocal yang menghitung selisihnya.
//
// null kalau tanggalnya tidak terbaca — BUKAN '0 hari lalu', yang akan terbaca
// sebagai "baru saja" padahal artinya "tidak tahu". Nol sendiri angka yang
// benar untuk hari ini, dan itulah kenapa nol punya katanya sendiri.
function buildRelativeDay(performedAt: string): string | null {
  const iso = toWibIsoDate(performedAt);

  if (!iso) {
    return null;
  }

  const days = daysSinceLocal(iso);

  if (days === null) {
    return null;
  }

  if (days === 0) {
    return 'Hari ini';
  }

  return days === 1 ? 'Kemarin' : `${days} hari lalu`;
}

// Kebun tanpa pohon. Kalimat dan label tombol dipertahankan PERSIS dari bentuk
// sebelumnya — keduanya sudah ada di kode dan sudah benar, jadi tidak ada teks
// baru yang dikarang di sini.
function EmptyTreesCard() {
  return (
    <Card padding={tokens.layout.cardPadding}>
      <Text selectable style={styles.emptyCardText}>
        Belum ada pohon yang dicatat di kebun ini.
      </Text>
      <Button title="Tambah pohon" variant="secondary" onPress={() => router.push('/owner/trees/create')} />
    </Card>
  );
}

// Baris di dalam kartu Perawatan: label rata KIRI, angka di kanan. Rata tengah
// dipakai untuk blok angka statistik (kartu Pohon di atas), bukan untuk baris
// berlabel seperti ini.
function CareRow({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <View style={styles.careRow}>
      <Text selectable style={styles.careLabel}>
        {label}
      </Text>
      <Text selectable style={[styles.careValue, { color }]}>
        {value}
      </Text>
    </View>
  );
}

// Label sampingan fase. HILANG seluruhnya saat kedua angkanya nol — barisnya
// tetap ada, tapi "0 berbunga · 0 berbuah" adalah kabar bahwa tidak ada kabar.
//
// Kedua angka ditulis bersama walau salah satunya nol: keduanya menjawab
// pertanyaan yang sama ("fase apa yang sedang berjalan"), dan menampilkan hanya
// yang tidak nol membuat pembacanya menebak apakah yang satunya nol atau tidak
// dihitung sama sekali.
function buildPhaseMeta(summary: OwnerDashboardSummary): string | undefined {
  if (summary.floweringTrees === 0 && summary.fruitingTrees === 0) {
    return undefined;
  }

  return `${summary.floweringTrees} berbunga · ${summary.fruitingTrees} berbuah`;
}

// Label sampingan Anggota adalah PENGAJUAN YANG MENUNGGU, bukan jumlah anggota.
// Pengajuan menuntut keputusan pemilik; jumlah anggota tidak menuntut apa pun,
// dan angka yang tidak menuntut apa-apa di baris navigasi hanya melatih mata
// untuk mengabaikan tempat itu.
function buildPendingMeta(summary: OwnerDashboardSummary): string | undefined {
  return summary.pendingWorkers > 0 ? `${summary.pendingWorkers} menunggu` : undefined;
}

// Border danger, bukan Card putih. Yang membedakan seksi ini dari sisa layar
// bukan lagi elevasi permukaan melainkan warnanya — dan karena seksinya hilang
// saat kosong, warna itu tidak pernah jadi latar tetap yang mati rasa.
function ActionRow({ row }: { row: ActionRowItem }) {
  return (
    <Pressable onPress={() => router.push(row.route)} style={styles.actionRow}>
      <View style={styles.rowMain}>
        <Text selectable style={styles.rowTitle}>
          {row.title}
        </Text>
        {row.subtitle ? (
          <Text selectable style={styles.rowSubtitle}>
            {row.subtitle}
          </Text>
        ) : null}
      </View>
      {row.value > 0 ? (
        <Text selectable style={styles.actionValue}>
          {row.value}
        </Text>
      ) : null}
      <Icon name="chevron-right" size={tokens.icon.sm} color={tokens.color.text.tertiary} />
    </Pressable>
  );
}

// `meta` menggantikan `value?: number` yang lama. Alasannya: dua dari tiga baris
// kini membawa keterangan yang BUKAN satu angka telanjang — "3 berbunga · 5
// berbuah" dan "2 menunggu". Angka tanpa kata di ujung baris menuntut pembacanya
// menebak angka apa itu, dan tebakannya berbeda untuk tiap baris.
//
// Undefined berarti baris ini memang tidak punya keterangan; bagian itu tidak
// dirender sama sekali, bukan dirender sebagai teks kosong atau "-".
function NavRow({
  icon,
  meta,
  onPress,
  title,
}: {
  icon: IconName;
  meta?: string;
  onPress: () => void;
  title: string;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.navRow}>
      <Icon name={icon} size={tokens.icon.md} color={tokens.color.brand.base} />
      <Text selectable style={[styles.rowTitle, styles.rowMain]}>
        {title}
      </Text>
      {meta ? (
        <Text selectable numberOfLines={1} style={styles.navMeta}>
          {meta}
        </Text>
      ) : null}
      <Icon name="chevron-right" size={tokens.icon.sm} color={tokens.color.text.tertiary} />
    </Pressable>
  );
}

// Baris polos dengan divider tipis, tanpa Card. Isinya angka yang dipantau
// sesekali, bukan ditindaklanjuti.
//
// DUA DARI TIGA BARIS BISA DITEKAN, dan yang ketiga sengaja tidak.
//
// 'Pohon berbunga' dan 'Pohon berbuah' menuju /owner/growth-monitoring — layar
// itu isinya PERSIS kedua daftar tersebut, satu bagian untuk masing-masing, jadi
// tidak ada yang perlu ditebak. Sebelum ini layar tersebut tidak punya satu pun
// jalan masuk dan hanya bisa dicapai lewat deep link.
//
// 'Tugas hari ini' DIBIARKAN sebagai baris biasa. Ia bukan tentang fase pohon,
// dan tujuannya tidak jelas dari sini — /owner/tasks dan /owner/schedules
// sama-sama masuk akal, dan keduanya menyaring hal yang berbeda dari "hari ini".
// Menebak salah satunya berarti memasang jalan masuk yang mungkin membawa
// pemiliknya ke daftar yang bukan angka yang barusan ia tekan. Keputusan itu
// belum diambil, jadi barisnya tetap seperti sekarang.
//
// Perbedaannya TERLIHAT tanpa harus menyentuh: baris yang bisa ditekan punya
// chevron, yang tidak, tidak. Warna tidak dipakai untuk membedakan keduanya.
type MonitorItem = {
  key: string;
  label: string;
  route?: string;
  value: number;
};

function MonitorList({ summary }: { summary: OwnerDashboardSummary }) {
  const items: MonitorItem[] = [
    {
      key: 'flowering',
      label: 'Pohon berbunga',
      route: '/owner/growth-monitoring',
      value: summary.floweringTrees,
    },
    {
      key: 'fruiting',
      label: 'Pohon berbuah',
      route: '/owner/growth-monitoring',
      value: summary.fruitingTrees,
    },
    { key: 'today', label: 'Tugas hari ini', value: summary.todayTasks },
  ];

  return (
    <View>
      {items.map((item, index) => (
        <React.Fragment key={item.key}>
          {index > 0 ? <View style={styles.divider} /> : null}
          <MonitorRow item={item} />
        </React.Fragment>
      ))}
    </View>
  );
}

function MonitorRow({ item }: { item: MonitorItem }) {
  // Disalin ke const lebih dulu supaya penyempitan tipenya ikut masuk ke dalam
  // closure onPress. Membaca item.route langsung di sana menuntut `as string`,
  // dan penegasan tipe untuk hal yang sudah dijaga tiga baris di atasnya hanya
  // memindahkan tanggung jawab dari compiler ke pembaca.
  const route = item.route;
  const content = (
    <>
      <Text selectable style={styles.monitorLabel}>
        {item.label}
      </Text>
      <Text selectable style={styles.monitorValue}>
        {item.value}
      </Text>
      {route ? (
        <Icon name="chevron-right" size={tokens.icon.sm} color={tokens.color.text.tertiary} />
      ) : null}
    </>
  );

  if (!route) {
    return <View style={styles.row}>{content}</View>;
  }

  // Bentuknya mengikuti NavRow di berkas yang sama: Pressable ber-styles.row
  // dengan chevron di ujung kanan. Sengaja bukan komponen baru — dua baris
  // sejenis di satu layar tidak boleh punya dua cara ditekan.
  return (
    <Pressable
      accessibilityHint="Buka monitoring fase"
      accessibilityRole="button"
      onPress={() => router.push(route)}
      style={styles.row}
    >
      {content}
    </Pressable>
  );
}

function buildActionRows(summary: OwnerDashboardSummary): ActionRowItem[] {
  const rows: ActionRowItem[] = [];

  if (summary.unfinishedTasks > 0) {
    rows.push({
      key: 'unfinished',
      title: 'Tugas belum selesai',
      subtitle: summary.overdueTasks > 0 ? `${summary.overdueTasks} sudah lewat tenggat` : undefined,
      value: summary.unfinishedTasks,
      route: '/owner/schedules',
    });
  }

  return rows;
}

const styles = StyleSheet.create({
  sections: { gap: tokens.layout.sectionGap },
  section: { gap: tokens.space.md },

  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardTitle: { ...tokens.type.label, color: tokens.color.text.secondary },
  emptyCardBody: { gap: tokens.space.md },
  // Rata tengah: keadaan kosong salah satu dari empat hal yang boleh rata
  // tengah menurut aturan desain yang berlaku.
  emptyCardText: { ...tokens.type.body, color: tokens.color.text.secondary, textAlign: 'center' },

  // Gaya blok angka statistik PINDAH ke farm-overview.tsx bersama TreeStatRow —
  // kedua Beranda memakainya, jadi ia tidak lagi milik layar ini.

  // Baris di kartu Perawatan: label kiri, angka kanan.
  careRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: tokens.layout.rowMinHeight,
    paddingVertical: tokens.space.sm,
  },
  careLabel: { ...tokens.type.body, color: tokens.color.text.secondary },
  careValue: { ...tokens.type.subheading },

  // Baris kartu "Terakhir dikerjakan": dua baris teks, RATA KIRI. Tanpa
  // justifyContent 'space-between' seperti careRow — di sini tidak ada angka
  // yang berdiri sendiri di kanan; jumlah pohon menyatu ke dalam kalimatnya.
  recentRow: { gap: 2, paddingVertical: tokens.space.md },
  recentTitle: { ...tokens.type.body, color: tokens.color.text.primary },
  // Lebih kecil DAN lebih redup daripada baris di atasnya — dua saluran, bukan
  // hanya warna. Atribusi memang lapisan kedua: yang dicari pemilik lebih dulu
  // adalah pekerjaan apa atas berapa pohon.
  recentMeta: { ...tokens.type.meta, color: tokens.color.text.tertiary },

  // Baris navigasi di dalam kartu. minHeight mengikuti controlHeight seperti
  // MenuRow di ui.tsx, supaya tiga baris ini setinggi baris menu di layar lain.
  navRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: tokens.space.md,
    minHeight: tokens.layout.controlHeight,
  },
  navMeta: { ...tokens.type.meta, color: tokens.color.text.secondary, flexShrink: 1 },

  actionGroup: { gap: tokens.space.sm },
  actionRow: {
    alignItems: 'center',
    borderColor: tokens.color.status.danger.border,
    borderCurve: 'continuous',
    borderRadius: tokens.radius.cardInner,
    borderWidth: 1,
    flexDirection: 'row',
    gap: tokens.space.md,
    minHeight: tokens.layout.rowMinHeight,
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.md,
  },
  actionValue: { ...tokens.type.subheading, color: tokens.color.status.danger.text },

  destinations: { gap: 0 },
  divider: {
    backgroundColor: tokens.color.line.hairline,
    height: StyleSheet.hairlineWidth,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: tokens.space.md,
    minHeight: tokens.layout.rowMinHeight,
    paddingVertical: tokens.space.md,
  },
  rowMain: { flex: 1 },
  rowTitle: { ...tokens.type.body, color: tokens.color.text.primary },
  rowSubtitle: { ...tokens.type.meta, color: tokens.color.status.danger.text },
  rowValue: { ...tokens.type.subheading, color: tokens.color.text.primary },
  monitorLabel: { ...tokens.type.body, color: tokens.color.text.secondary, flex: 1 },
  monitorValue: { ...tokens.type.bodyStrong, color: tokens.color.text.primary },
});
