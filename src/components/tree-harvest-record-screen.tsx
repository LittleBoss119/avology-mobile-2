import { router } from 'expo-router';
import React from 'react';
import { Text } from 'react-native';

import {
  GRADE_PANEN,
  GRADE_PANEN_LABELS,
  MAX_BERAT_PANEN_KG,
  type GradePanen,
} from '../constants/gradePanen';
import { tokens } from '../constants/theme';
import { createHarvestRecord } from '../services/harvestService';
import { getTreeDetail } from '../services/treeService';
import type { Tree } from '../types/domain';
import { MAX_ANGKA_DESIMAL, parseDecimalInput, sanitizeDecimalInput } from '../utils/decimalInput';
import { formatTreeDisplayCode, formatTreeLocation } from '../utils/treeFormat';
import { useSnackbar } from './snackbar';
import {
  Button,
  Card,
  DateField,
  ErrorBanner,
  Field,
  FormSection,
  LoadingState,
  MetaRow,
  OptionGroup,
  Screen,
  TopAppBar,
} from './ui';

type HarvestFormErrors = { jumlah?: string };

export function TreeHarvestRecordScreen({
  basePath,
  treeId,
}: {
  basePath: '/owner/trees' | '/worker/trees';
  treeId?: string;
}) {
  const showSnackbar = useSnackbar();
  const [error, setError] = React.useState<string | null>(null);
  const [eventDate, setEventDate] = React.useState(formatDateInput(new Date()));
  const [fieldErrors, setFieldErrors] = React.useState<HarvestFormErrors>({});
  const [grade, setGrade] = React.useState<GradePanen | null>(null);
  const [beratKg, setBeratKg] = React.useState('');
  const [fruitCount, setFruitCount] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [note, setNote] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [tree, setTree] = React.useState<Tree | null>(null);

  React.useEffect(() => {
    let isMounted = true;

    async function loadTree() {
      if (!treeId) {
        setError('Data pohon tidak ditemukan.');
        setLoading(false);
        return;
      }

      setError(null);
      const result = await getTreeDetail({ treeId });

      if (!isMounted) {
        return;
      }

      if (result.error) {
        setError(result.error.message);
        setLoading(false);
        return;
      }

      if (basePath === '/worker/trees' && result.data.isArchived) {
        setError('Pohon yang diarsipkan tidak tersedia untuk pekerja.');
        setLoading(false);
        return;
      }

      setTree(result.data);
      setLoading(false);
    }

    loadTree();

    return () => {
      isMounted = false;
    };
  }, [basePath, treeId]);

  async function handleSubmit() {
    if (!tree) {
      setError('Data pohon tidak ditemukan.');
      return;
    }

    const jumlahMessage = validateJumlahPanen();

    if (jumlahMessage) {
      setFieldErrors({ jumlah: jumlahMessage });
      return;
    }

    setFieldErrors({});
    setSubmitting(true);
    setError(null);

    const result = await createHarvestRecord({
      farmId: tree.farmId,
      fruitCondition: grade,
      fruitCount: fruitCount.trim() ? Number(fruitCount) : null,
      harvestWeightKg: parseDecimalInput(beratKg),
      harvestedAt: eventDate,
      note,
      treeId: tree.id,
    });

    if (result.error) {
      setError(result.error.message);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    showSnackbar('Panen tercatat');
    router.replace(`${basePath}/${tree.id}`);
  }

  // Minimal salah satu dari berat atau jumlah buah. Cerminan constraint
  // harvest_records_amount_present_check, dan RPC menegakkan aturan yang sama —
  // ini hanya supaya pekerja dapat jawaban tanpa menunggu jaringan.
  function validateJumlahPanen(): string | null {
    const beratTeks = beratKg.trim();
    const jumlahTeks = fruitCount.trim();

    if (!beratTeks && !jumlahTeks) {
      return 'Isi berat panen atau jumlah buah, minimal salah satu.';
    }

    if (beratTeks) {
      const berat = parseDecimalInput(beratTeks);

      if (berat === null) {
        return 'Berat panen harus lebih dari 0.';
      }

      // Dijaga di sini, bukan diserahkan ke constraint database. Pelanggaran
      // constraint sampai ke layar sebagai "Terjadi kendala saat memproses
      // data." — kalimat yang tidak menyebut angka mana yang kebesaran.
      if (berat > MAX_BERAT_PANEN_KG) {
        return 'Berat panen terlalu besar.';
      }
    }

    if (jumlahTeks) {
      const jumlah = Number(jumlahTeks);

      if (!Number.isInteger(jumlah) || jumlah <= 0) {
        return 'Jumlah buah harus lebih dari 0.';
      }
    }

    return null;
  }

  if (loading) {
    return <LoadingState message="Memuat pohon..." />;
  }

  return (
    <Screen
      header={<TopAppBar title="Catat panen" onBack={() => router.back()} />}
      stickyFooter={<Button title="Simpan" loading={submitting} onPress={handleSubmit} />}
    >
      <ErrorBanner message={error} />

      {tree ? (
        <Card variant="highlight">
          <Text selectable style={{ color: tokens.color.text.primary, ...tokens.type.subheading }}>
            Konteks Pohon
          </Text>
          <MetaRow label="Kode pohon" value={formatTreeDisplayCode(tree)} />
          <MetaRow label="Lokasi" value={formatTreeLocation(tree)} />
          <MetaRow label="Varietas" value={tree.activePlanting?.variety ?? 'Belum diisi'} />
        </Card>
      ) : null}

      {/* URUTAN DISENGAJA: berat DI ATAS jumlah buah. Seluruh target pemilik
          kebun berbasis kilogram (2 kg/m², 13 ton dari 6.500 m²), jadi berat
          adalah metrik utama dan jumlah buah sekunder. Field yang di atas lebih
          sering diisi. */}
      <FormSection title="Hasil panen" description="Isi berat panen, jumlah buah, atau keduanya.">
        <DateField label="Tanggal panen *" onChangeDate={setEventDate} value={eventDate} />
        <Field
          error={fieldErrors.jumlah}
          keyboardType="decimal-pad"
          label="Berat panen (kg)"
          onChangeText={(value) => {
            setBeratKg(sanitizeDecimalInput(value, MAX_ANGKA_DESIMAL));
            setFieldErrors((prev) => ({ ...prev, jumlah: undefined }));
          }}
          placeholder="Contoh: 12,5"
          value={beratKg}
        />
        <Field
          keyboardType="number-pad"
          label="Jumlah buah"
          onChangeText={(value) => {
            setFruitCount(value.replace(/[^0-9]/g, ''));
            setFieldErrors((prev) => ({ ...prev, jumlah: undefined }));
          }}
          placeholder="Contoh: 12"
          value={fruitCount}
        />
      </FormSection>

      {/* Grade WAJIB dipilih dari daftar, tidak boleh diketik. Kolom ini dulu
          teks bebas dan sudah terlanjur berisi "Bagus", "Baik", "Good", dan
          "Good test harvest" — empat nilai untuk satu maksud, dari satu orang.
          Menekan chip yang sudah aktif membatalkan pilihan, karena grade
          memang opsional. */}
      <FormSection title="Grade" description="Opsional. Mutu panen menurut penilaian di lapangan.">
        <OptionGroup
          options={GRADE_PANEN.map((option) => ({
            disabled: submitting,
            label: GRADE_PANEN_LABELS[option],
            value: option,
          }))}
          value={grade}
          onChange={(value) => setGrade(grade === value ? null : (value as GradePanen))}
        />
      </FormSection>

      <FormSection title="Catatan tambahan">
        <Field label="" multiline onChangeText={setNote} placeholder="Opsional" value={note} />
      </FormSection>
    </Screen>
  );
}

function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
