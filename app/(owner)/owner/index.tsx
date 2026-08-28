import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { tokens } from '../../../src/constants/theme';
import {
  Button,
  Card,
  ErrorBanner,
  LoadingState,
  MainTabHeader,
  Screen,
  SectionHeader,
} from '../../../src/components/ui';
import { FarmIdentityBlock, TreeConditionSummary } from '../../../src/components/farm-overview';
import { Icon, type IconName } from '../../../src/components/icons';
import { useAuth } from '../../../src/context/auth-context';
import { getOwnerDashboardSummary } from '../../../src/services/dashboardService';
import type { OwnerDashboardSummary } from '../../../src/types/domain';

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

  const farmId = currentFarm?.farmId;

  const loadDashboard = React.useCallback(async () => {
    if (!farmId) {
      setError('Data kebun aktif tidak ditemukan.');
      setSummary(null);
      return;
    }

    setError(null);

    const result = await getOwnerDashboardSummary({ farmId });

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
  const actionRows = summary ? buildActionRows(summary) : [];

  return (
    <Screen header={<MainTabHeader title="Beranda" />}>
      {/* Sapaan "Halo, {nama}" dihapus. Ia memakan baris paling atas layar untuk
          menyebut nama orang yang sedang memegang HP-nya sendiri; tempat itu
          sekarang milik identitas kebun, satu-satunya hal di layar ini yang
          benar-benar menjawab pertanyaan "aku sedang melihat apa". */}
      {farm ? (
        <FarmIdentityBlock farm={farm} onEditPress={() => router.push('/owner/farm-profile')} />
      ) : null}
      <ErrorBanner message={error} />

      {summary === null ? null : (
        <View style={styles.sections}>
          {/* Satu-satunya kartu bersurface di layar ini. Kebun tanpa pohon TIDAK
              menghapus kartunya dan tidak menghapus apa pun di bawahnya — blok
              identitas, Pantauan, dan dua baris navigasi tetap berdiri. Yang
              berganti hanya ISI kartu: bar dan tiga angka nol tidak mengabarkan
              apa-apa, sedangkan satu kalimat plus jalan masuk mengabarkan apa
              yang harus dilakukan berikutnya. */}
          <Pressable onPress={() => router.push('/owner/trees')}>
            <Card padding={tokens.layout.cardPadding}>
              <View style={styles.cardHeader}>
                <Text selectable style={styles.cardTitle}>
                  Kondisi kebun
                </Text>
                <Icon name="chevron-right" size={tokens.icon.sm} color={tokens.color.text.tertiary} />
              </View>
              {summary.totalTrees === 0 ? (
                <View style={styles.emptyCardBody}>
                  <Text selectable style={styles.emptyCardText}>
                    Belum ada pohon yang dicatat di kebun ini.
                  </Text>
                  <Button
                    title="Tambah pohon"
                    variant="secondary"
                    onPress={() => router.push('/owner/trees/create')}
                  />
                </View>
              ) : (
                <TreeConditionSummary
                  healthyTrees={summary.healthyTrees}
                  problemTrees={summary.problemTrees}
                  totalTrees={summary.totalTrees}
                />
              )}
            </Card>
          </Pressable>

          {/* Kosong berarti HILANG, bukan "tidak ada yang perlu ditindaklanjuti".
              Kalimat itu adalah kabar bahwa tidak ada kabar, dan ia menempati
              ruang yang sama besarnya dengan pekerjaan yang sungguhan. */}
          {actionRows.length > 0 ? (
            <View style={styles.section}>
              <SectionHeader title="Perlu tindakan" />
              <View style={styles.actionGroup}>
                {actionRows.map((row) => (
                  <ActionRow key={row.key} row={row} />
                ))}
              </View>
            </View>
          ) : null}

          <View style={styles.section}>
            <SectionHeader title="Pantauan" />
            <MonitorList summary={summary} />
          </View>

          {/* Jalan masuk ke Kebun setelah ia dicabut dari bottom nav — bukan
              pekerjaan yang menunggu, jadi berada di luar "Perlu tindakan" dan
              tanpa SectionHeader sendiri. Divider tipis yang memisahkannya dari
              Pantauan sudah cukup menandai bahwa baris ini jenis lain.

              Baris kedua ("Laporan") ikut dibuang bersama modul laporan
              operasional di migrasi 053. */}
          <View style={styles.destinations}>
            <View style={styles.divider} />
            <NavRow
              icon="user"
              title="Anggota kebun"
              onPress={() => router.push('/owner/farm')}
            />
            {/* Ukuran petak kebun. Jalan masuknya SENGAJA hanya dari sini, bukan
                dari peta denah: peta punya persoalan offset gulung yang belum
                diselesaikan, dan menambah jalur ke sana sekarang berarti
                menautkan dua persoalan yang belum tentu selesai bersamaan. */}
            <View style={styles.divider} />
            <NavRow
              icon="adjustments-horizontal"
              title="Ukuran denah kebun"
              onPress={() => router.push('/owner/farm-grid')}
            />
          </View>
        </View>
      )}
    </Screen>
  );
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

function NavRow({
  icon,
  onPress,
  title,
  value,
}: {
  icon: IconName;
  onPress: () => void;
  title: string;
  value?: number;
}) {
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <Icon name={icon} size={tokens.icon.md} color={tokens.color.text.tertiary} />
      <Text selectable style={[styles.rowTitle, styles.rowMain]}>
        {title}
      </Text>
      {value !== undefined && value > 0 ? (
        <Text selectable style={styles.rowValue}>
          {value}
        </Text>
      ) : null}
      <Icon name="chevron-right" size={tokens.icon.sm} color={tokens.color.text.tertiary} />
    </Pressable>
  );
}

// Baris polos dengan divider tipis, tanpa Card. Isinya tidak berubah: angka yang
// dipantau sesekali, bukan ditindaklanjuti.
function MonitorList({ summary }: { summary: OwnerDashboardSummary }) {
  const items = [
    { key: 'flowering', label: 'Pohon berbunga', value: summary.floweringTrees },
    { key: 'fruiting', label: 'Pohon berbuah', value: summary.fruitingTrees },
    { key: 'today', label: 'Tugas hari ini', value: summary.todayTasks },
  ];

  return (
    <View>
      {items.map((item, index) => (
        <React.Fragment key={item.key}>
          {index > 0 ? <View style={styles.divider} /> : null}
          <View style={styles.row}>
            <Text selectable style={styles.monitorLabel}>
              {item.label}
            </Text>
            <Text selectable style={styles.monitorValue}>
              {item.value}
            </Text>
          </View>
        </React.Fragment>
      ))}
    </View>
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
  emptyCardText: { ...tokens.type.body, color: tokens.color.text.secondary },

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
