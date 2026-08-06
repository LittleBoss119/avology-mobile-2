import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import React from 'react';
import { Modal, Platform, Pressable, Share, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Icon } from '../../src/components/icons';
import { useSnackbar } from '../../src/components/snackbar';
import { Button, ErrorBanner, Field, Screen, TopAppBar } from '../../src/components/ui';
import { tokens } from '../../src/constants/theme';
import { useAuth } from '../../src/context/auth-context';
import { createFarm, getFarmDetail } from '../../src/services/farmService';

const MIN_FARM_NAME_LENGTH = 3;

// Layar ini bisa dicapai lewat DUA jalan dengan bentuk stack yang berbeda:
// didorong dari layar pilih akses (ada entri untuk dimundurkan), atau
// didaratkan guard lewat router.replace() dari layar pemberitahuan (stack-nya
// kosong, dan router.back() melempar "GO_BACK was not handled"). Jadi mundur
// hanya dipakai kalau memang ada tujuannya; kalau tidak, tombol kembali berarti
// keluar ke layar pilih akses.
function goBackToAccessChoice() {
  if (router.canGoBack()) {
    router.back();
    return;
  }

  router.replace('/onboarding');
}

type CreatedFarm = { farmName: string; joinCode: string | null };

export default function CreateFarmScreen() {
  const { refresh } = useAuth();
  const showSnackbar = useSnackbar();
  const [name, setName] = React.useState('');
  const [location, setLocation] = React.useState('');
  const [areaSize, setAreaSize] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [starting, setStarting] = React.useState(false);
  const [created, setCreated] = React.useState<CreatedFarm | null>(null);

  // Tombol mati sampai nama kebun layak. Lebih jujur daripada membiarkan user
  // menekan lalu dilempar pesan galat.
  const canSubmit = name.trim().length >= MIN_FARM_NAME_LENGTH;

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);

    const parsedAreaSize = areaSize.trim() ? Number(areaSize) : null;

    if (parsedAreaSize !== null && (!Number.isFinite(parsedAreaSize) || parsedAreaSize <= 0)) {
      setError('Luas lahan harus berupa angka lebih dari 0.');
      setSubmitting(false);
      return;
    }

    const result = await createFarm({
      name,
      location,
      areaSize: parsedAreaSize,
    });

    if (result.error) {
      setError(result.error.message);
      setSubmitting(false);
      return;
    }

    // TANPA refresh() dan TANPA navigasi. Begitu relasi diperbarui, guard di
    // _layout.tsx langsung memindahkan layar ke dashboard pemilik — modalnya
    // tidak akan pernah sempat terlihat. Jadi relasi sengaja dibiarkan basi
    // sampai user menekan "Mulai".
    //
    // Detail kebun diambil langsung lewat RLS: pemanggil sudah jadi pemilik
    // aktif kebun itu sejak create_farm_with_owner, meski context belum tahu.
    const detail = await getFarmDetail(result.data.farmId);

    setCreated({
      // Kebunnya SUDAH terbuat. Kalau pengambilan detailnya gagal, jangan
      // menahan user — tampilkan modal tanpa bagian kode, dan pemilik tetap bisa
      // menemukan kodenya di tab Kebun.
      farmName: detail.error ? name.trim() : detail.data.name,
      joinCode: detail.error ? null : detail.data.joinCode ?? null,
    });
    setSubmitting(false);
  }

  async function handleCopyJoinCode() {
    if (!created?.joinCode) {
      return;
    }

    await Clipboard.setStringAsync(created.joinCode);
    showSnackbar('Kode disalin');
  }

  async function handleShareJoinCode() {
    if (!created?.joinCode) {
      return;
    }

    await Share.share({ message: `Kode kebun ${created.farmName}: ${created.joinCode}` });
  }

  // Satu-satunya tempat refresh() dipanggil di layar ini. Sesudah ini guard yang
  // memindahkan ke dashboard pemilik — tidak ada navigasi imperatif di sini.
  async function handleStart() {
    setStarting(true);
    await refresh();
  }

  return (
    <Screen
      autoScrollOnFocus
      header={<TopAppBar title="Buat kebun" onBack={goBackToAccessChoice} />}
      footer={
        // Hanya satu tombol. Tombol "Batal" dihapus: sudah ada tombol kembali di
        // app bar, dan dua jalan keluar untuk hal yang sama cuma kebisingan.
        <Button title="Buat kebun" disabled={!canSubmit} loading={submitting} onPress={handleSubmit} />
      }
    >
      <ErrorBanner message={error} />
      <View style={{ gap: tokens.space.xl }}>
        {/* Tanpa tanda bintang. Yang ditandai justru yang opsional — bintang itu
            konvensi web yang tidak berarti apa-apa bagi pengguna layar ini.
            Placeholder berupa contoh nilai yang masuk akal, bukan nama produk. */}
        <Field label="Nama kebun" value={name} onChangeText={setName} placeholder="Kebun Ngawi" />
        <Field
          label="Lokasi · opsional"
          value={location}
          onChangeText={setLocation}
          placeholder="Ngawi, Jawa Timur"
        />
        <Field
          label="Luas lahan · opsional"
          value={areaSize}
          onChangeText={setAreaSize}
          placeholder="6500 m²"
          keyboardType="decimal-pad"
        />
      </View>

      <FarmCreatedModal
        farm={created}
        starting={starting}
        onCopy={handleCopyJoinCode}
        onShare={handleShareJoinCode}
        onStart={handleStart}
      />
    </Screen>
  );
}

function FarmCreatedModal({
  farm,
  onCopy,
  onShare,
  onStart,
  starting,
}: {
  farm: CreatedFarm | null;
  onCopy: () => void;
  onShare: () => void;
  onStart: () => void;
  starting: boolean;
}) {
  return (
    <Modal
      animationType="fade"
      // Tanpa jalan keluar selain "Mulai": kebunnya sudah terbuat, dan menutup
      // modal tanpa menekan tombol akan meninggalkan user di form yang isinya
      // sudah tidak berlaku.
      onRequestClose={() => undefined}
      statusBarTranslucent
      transparent
      visible={farm !== null}
    >
      <View
        style={{
          alignItems: 'center',
          backgroundColor: tokens.color.overlay.scrim,
          flex: 1,
          justifyContent: 'center',
          padding: tokens.space.xxl,
        }}
      >
        <View
          style={{
            backgroundColor: tokens.color.surface.card,
            borderCurve: 'continuous',
            borderRadius: tokens.radius.card,
            gap: tokens.space.lg,
            padding: tokens.space.xxl,
            width: '100%',
          }}
        >
          <View
            style={{
              alignItems: 'center',
              alignSelf: 'center',
              backgroundColor: tokens.color.brand.soft,
              borderRadius: tokens.radius.pill,
              height: 64,
              justifyContent: 'center',
              width: 64,
            }}
          >
            <Icon name="check" size={32} color={tokens.color.brand.base} />
          </View>

          <Text
            selectable
            style={{
              color: tokens.color.text.primary,
              fontSize: tokens.type.heading.fontSize,
              fontWeight: tokens.type.heading.fontWeight,
              lineHeight: tokens.type.heading.lineHeight,
              textAlign: 'center',
            }}
          >
            {`${farm?.farmName ?? 'Kebun'} dibuat`}
          </Text>

          {farm?.joinCode ? (
            <>
              <Text
                selectable
                style={{
                  color: tokens.color.text.secondary,
                  fontSize: tokens.type.body.fontSize,
                  lineHeight: tokens.type.body.lineHeight,
                  textAlign: 'center',
                }}
              >
                Bagikan kode ini ke pekerja kamu.
              </Text>

              <View
                style={{
                  alignItems: 'center',
                  backgroundColor: tokens.color.surface.subtle,
                  borderCurve: 'continuous',
                  borderRadius: tokens.radius.cardInner,
                  flexDirection: 'row',
                  gap: tokens.space.md,
                  justifyContent: 'space-between',
                  padding: tokens.space.lg,
                }}
              >
                <Text
                  selectable
                  style={{
                    color: tokens.color.text.primary,
                    flex: 1,
                    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
                    fontSize: 24,
                    fontWeight: '700',
                    letterSpacing: 2,
                  }}
                >
                  {farm.joinCode}
                </Text>
                <View style={{ flexDirection: 'row', gap: tokens.space.sm }}>
                  <IconActionButton
                    label="Salin kode"
                    onPress={onCopy}
                    icon={<Icon name="copy" size={20} color={tokens.color.brand.base} />}
                  />
                  <IconActionButton
                    label="Bagikan kode"
                    onPress={onShare}
                    icon={<ShareGlyph color={tokens.color.brand.base} />}
                  />
                </View>
              </View>
            </>
          ) : null}

          <Button title="Mulai" loading={starting} onPress={onStart} />
        </View>
      </View>
    </Modal>
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

// Belum ada di src/components/icons.tsx, dan file itu di luar cakupan fase ini.
// Path dari Tabler Icons (MIT) varian outline, konvensi sama: viewBox 24, fill
// none, stroke membulat.
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
