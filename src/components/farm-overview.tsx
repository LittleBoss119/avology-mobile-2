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
      <Text selectable style={styles.identityName}>
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

// Bar proporsi + tiga angka.
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
  identity: { gap: tokens.space.xs },
  identityName: { ...tokens.type.display, color: tokens.color.brand.base },
  identityMeta: { ...tokens.type.bodySmall, color: tokens.color.text.secondary },
  identityChip: { alignSelf: 'flex-start', paddingTop: tokens.space.sm },

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
