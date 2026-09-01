import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { tokens } from '../constants/theme';
import type { Farm } from '../types/domain';
import { buildFarmMetaLine } from '../utils/farmFormat';
import { ChipButton } from './ui';

// Dua blok yang dipakai BERSAMA oleh Beranda pemilik dan Beranda pekerja.
// Keduanya lahir dari peleburan halaman Kebun ke Beranda: identitas kebun tidak
// lagi punya halaman sendiri, dan kondisi kebun kini muncul di dua tempat dengan
// bobot visual yang berbeda. Ditaruh di satu file karena keduanya hanya hidup di
// dua layar itu, dan selalu berdampingan.

// Judul halaman yang sebenarnya. Ukurannya sengaja sebesar kode pohon di layar
// detail pohon (tokens.type.display) dan warnanya hijau primer: begitu Beranda
// terbuka, "kebun yang mana" terjawab sekali, besar, lalu tidak diulang lagi di
// header layar mana pun.
//
// `onEditPress` opsional — hanya pemilik yang boleh mengubah data kebun, jadi
// di Beranda pekerja chip-nya tidak dirender sama sekali (bukan dirender lalu
// dinonaktifkan).
//
// SEJAK PUTARAN INI PROP ITU TIDAK PUNYA SATU PUN PEMANGGIL. Chip "Ubah data
// kebun" dicabut dari Beranda pemilik; jalan ke /owner/farm-profile sekarang
// lewat baris "Data kebun" di kelompok navigasi Beranda. Propnya sengaja
// DIBIARKAN, tidak dihapus — pembersihannya bukan bagian putaran ini, dan
// menghapus API komponen bersama sambil mengubah tata letak dua Beranda
// menggabungkan dua perubahan yang seharusnya bisa ditinjau terpisah.
export function FarmIdentityBlock({
  farm,
  onEditPress,
}: {
  farm: Pick<Farm, 'areaSize' | 'location' | 'name'>;
  onEditPress?: () => void;
}) {
  const metaLine = buildFarmMetaLine(farm);
  const name = farm.name?.trim();

  return (
    <View style={styles.identity}>
      {/* accessibilityRole="header" dipasang setelah judul layar dibuang dari
          kedua Beranda. Sebelumnya heading layar ini dipegang TopAppBar di
          dalam MainTabHeader; tanpa ini, kedua Beranda jadi layar tanpa satu
          pun heading, dan TalkBack kehilangan titik lompat pertamanya. Baris
          ini memang judul isi layar — ia menjawab "kebun yang mana" — jadi
          perannya nyata, bukan teks tersembunyi yang dikarang. */}
      <Text accessibilityRole="header" selectable style={styles.identityName}>
        {name ? name : 'Kebun'}
      </Text>
      {/* Baris kosong TIDAK dirender: kebun yang belum mengisi lokasi maupun
          luas tidak perlu diberi pemisah "·" yang menggantung. */}
      {metaLine ? (
        <Text selectable style={styles.identityMeta}>
          {metaLine}
        </Text>
      ) : null}
      {onEditPress ? (
        <View style={styles.identityChip}>
          <ChipButton active={false} label="Ubah data kebun" onPress={onEditPress} />
        </View>
      ) : null}
    </View>
  );
}

// Tiga angka pohon: Total, Sehat, Perlu dicek. TANPA bar proporsi.
//
// Lahir di Beranda pemilik lalu DIPINDAH ke sini begitu Beranda pekerja
// membutuhkan bentuk yang sama persis. Disalin ke dua tempat, aturan warna di
// bawah akan hidup dua kali dan bisa berbeda tanpa ada yang gagal typecheck —
// dan dua Beranda yang mewarnai angka berbeda untuk kebun yang sama adalah
// persis jenis selisih yang paling lama tidak ketahuan.
//
// Kontraknya sengaja SEMPIT: tiga angka, tidak lebih. Tidak ada prop ukuran,
// tidak ada prop warna, tidak ada slot. Kedua Beranda kini satu gaya, jadi
// perbedaan ukuran yang dulu dibawa TreeConditionSummary lewat `size` tidak
// punya pemakai lagi.
//
// "Perlu dicek" adalah SELURUH pohon non-sehat, termasuk yang mati — cerminan
// dashboardService.countProblemTrees (current_condition <> 'healthy') dan
// countTreeConditions di Beranda pekerja, yang keduanya memakai pembelahan yang
// sama. Definisinya tidak disentuh di putaran ini.
export function TreeStatRow({
  healthyTrees,
  problemTrees,
  totalTrees,
}: {
  healthyTrees: number;
  problemTrees: number;
  totalTrees: number;
}) {
  return (
    <View style={styles.statRow}>
      <StatColumn color={tokens.color.text.primary} label="Total" value={totalTrees} />
      <StatColumn color={tokens.color.status.success.text} label="Sehat" value={healthyTrees} />
      {/* Warna hanya menyala saat angkanya benar-benar ada isinya; nol tetap
          netral supaya kebun sehat tidak diberi warna peringatan. Warna di sini
          penegas, bukan pembawa pesan — labelnya yang mengatakan apa artinya. */}
      <StatColumn
        color={problemTrees > 0 ? tokens.color.status.warning.text : tokens.color.text.primary}
        label="Perlu dicek"
        value={problemTrees}
      />
    </View>
  );
}

// Satu kolom angka rata tengah. Diekspor karena kartu Tugas di Beranda pekerja
// memakai bentuk yang sama dengan DUA kolom, bukan tiga — dan menyalin
// tipografinya ke sana berarti dua kartu bersebelahan di satu layar yang bisa
// diam-diam berbeda ukuran angkanya.
export function StatColumn({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: number;
}) {
  return (
    <View style={styles.statCol}>
      <Text selectable style={[styles.statValue, { color }]}>
        {value}
      </Text>
      <Text selectable style={styles.statLabel}>
        {label}
      </Text>
    </View>
  );
}

// Bar proporsi + tiga angka.
//
// TIDAK LAGI DIPAKAI sejak kedua Beranda pindah ke TreeStatRow di atas.
// Dibiarkan utuh, tidak dihapus: ia menyimpan keputusan tentang bagaimana
// proporsi sehat/perlu-dicek digambarkan, dan itu mungkin dipakai lagi setelah
// UAT. Pembersihannya keputusan tersendiri.
//
// DUA segmen, bukan tiga: sumber angkanya hanya membedakan `healthy` dari
// "selain healthy" (dashboardService.countProblemTrees), dan memecah "rusak"
// jadi potongan sendiri berarti query baru. Bar ini menampilkan persis apa yang
// diketahui — sehat versus perlu dicek — bukan kategori yang datanya belum
// ada.
//
// `size` membedakan pemakaiannya: 'lg' di Beranda pemilik, tempat blok ini
// satu-satunya kartu bersurface; 'sm' di Beranda pekerja, tempat ia sengaja
// dibuat lebih ringan supaya kartu "Tugas hari ini" tetap yang paling berat.
export function TreeConditionSummary({
  healthyTrees,
  problemTrees,
  size = 'lg',
  totalTrees,
}: {
  healthyTrees: number;
  problemTrees: number;
  size?: 'lg' | 'sm';
  totalTrees: number;
}) {
  const valueStyle = size === 'lg' ? styles.metricValueLg : styles.metricValueSm;

  return (
    <View style={styles.conditionGroup}>
      <ConditionBar healthyTrees={healthyTrees} problemTrees={problemTrees} />
      <View style={styles.metrics}>
        <ConditionMetric
          color={tokens.color.text.primary}
          label="Total"
          value={totalTrees}
          valueStyle={valueStyle}
        />
        <ConditionMetric
          color={tokens.color.status.success.text}
          label="Sehat"
          value={healthyTrees}
          valueStyle={valueStyle}
        />
        {/* "Perlu dicek", BUKAN "Perhatian". Angkanya adalah SELURUH pohon
            non-sehat — termasuk yang mati — sedangkan "Perhatian" di layar lain
            (badge kartu pohon, chip filter, legenda peta) berarti tepat satu
            status: needs_attention. Memakai kata yang sama untuk dua himpunan
            yang berbeda membuat pemilik menghitung "Perhatian 3" di sini lalu
            tidak menemukan satu pun pohon berlabel "Perhatian" di daftar.

            YANG DIGANTI HANYA KATANYA. Angkanya sengaja tetap seluruh non-sehat:
            mengurangi pohon mati akan mengosongkan ruas ini dari bar, dan karena
            kedua ruas ConditionBar memakai `flex` dan selalu memenuhi lebar
            penuh, kebun yang mayoritas pohonnya mati justru akan tampil sebagai
            bar hijau penuh. Beranda pekerja juga menghitung angka ini sendiri
            (worker/index.tsx countTreeConditions) dengan definisi yang sengaja
            disamakan; mengubah satu sisi saja membuat kedua Beranda berselisih
            untuk kebun yang sama. */}
        <ConditionMetric
          color={problemTrees > 0 ? tokens.color.status.warning.text : tokens.color.text.primary}
          label="Perlu dicek"
          value={problemTrees}
          valueStyle={valueStyle}
        />
      </View>
    </View>
  );
}

// Kebun tanpa pohon menyisakan alur kosong berwarna hairline, BUKAN bar yang
// hilang: bentuknya tetap terbaca sebagai takaran yang belum terisi, dan tinggi
// bloknya tidak melompat begitu pohon pertama ditambahkan.
function ConditionBar({ healthyTrees, problemTrees }: { healthyTrees: number; problemTrees: number }) {
  const measured = healthyTrees + problemTrees;

  return (
    <View style={styles.bar}>
      {measured > 0 ? (
        <>
          {healthyTrees > 0 ? (
            <View style={{ backgroundColor: tokens.color.status.success.text, flex: healthyTrees }} />
          ) : null}
          {problemTrees > 0 ? (
            <View style={{ backgroundColor: tokens.color.status.warning.text, flex: problemTrees }} />
          ) : null}
        </>
      ) : null}
    </View>
  );
}

function ConditionMetric({
  color,
  label,
  value,
  valueStyle,
}: {
  color: string;
  label: string;
  value: number;
  valueStyle: object;
}) {
  return (
    <View style={styles.metricCol}>
      <Text selectable style={[valueStyle, { color }]}>
        {value}
      </Text>
      <Text selectable style={styles.metricLabel}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // RATA TENGAH, dan itu berlaku untuk KEDUA peran — blok ini dipakai bersama
  // Beranda pemilik dan Beranda pekerja, dan perataan tengahnya memang
  // diinginkan di keduanya. Nama kebun adalah hero layar, satu dari empat hal
  // yang boleh rata tengah menurut aturan desain yang berlaku (nama kebun, blok
  // angka statistik, keadaan kosong, tombol utama).
  //
  // `alignItems` DAN `textAlign` dua-duanya perlu: alignItems memusatkan kotak
  // Text-nya, textAlign memusatkan baris di dalamnya saat nama kebun cukup
  // panjang untuk membungkus jadi dua baris.
  identity: { alignItems: 'center', gap: tokens.space.xs },
  identityName: { ...tokens.type.display, color: tokens.color.brand.base, textAlign: 'center' },
  identityMeta: { ...tokens.type.bodySmall, color: tokens.color.text.secondary, textAlign: 'center' },
  identityChip: { alignSelf: 'flex-start', paddingTop: tokens.space.sm },

  // Blok angka statistik — rata tengah. Nilainya dipindah APA ADANYA dari
  // app/(owner)/owner/index.tsx supaya kartu Pohon di Beranda pemilik tidak
  // bergeser sedikit pun oleh pemindahan ini. `flex: 1` membagi lebar rata,
  // jadi angka satu digit dan tiga digit tetap duduk di kolom yang sama lebarnya.
  statRow: { flexDirection: 'row', gap: tokens.space.md },
  statCol: { alignItems: 'center', flex: 1 },
  statValue: { ...tokens.type.title },
  statLabel: {
    ...tokens.type.meta,
    color: tokens.color.text.secondary,
    marginTop: tokens.space.xs,
    textAlign: 'center',
  },

  conditionGroup: { gap: tokens.space.md },
  bar: {
    backgroundColor: tokens.color.line.hairline,
    borderRadius: tokens.radius.pill,
    flexDirection: 'row',
    height: tokens.space.sm,
    overflow: 'hidden',
  },
  metrics: { flexDirection: 'row', gap: tokens.space.md },
  metricCol: { flex: 1 },
  metricValueLg: { ...tokens.type.title },
  metricValueSm: { ...tokens.type.subheading },
  metricLabel: { ...tokens.type.meta, color: tokens.color.text.secondary, marginTop: tokens.space.xs },
});
