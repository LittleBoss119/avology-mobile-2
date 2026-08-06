import { router } from 'expo-router';
import React from 'react';
import { Platform, Pressable, Text, TextInput, View } from 'react-native';

import { Button, ErrorBanner, Screen, TopAppBar } from '../../src/components/ui';
import { tokens } from '../../src/constants/theme';
import { useAuth } from '../../src/context/auth-context';
import { previewFarmByJoinCode, requestJoinFarm } from '../../src/services/memberService';
import type { FarmPreview } from '../../src/types/domain';

const JOIN_CODE_LENGTH = 8;

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

// Alur gabung jadi DUA LANGKAH. Sebelumnya user menekan satu tombol dan
// pengajuannya langsung terkirim tanpa dia pernah tahu kebun apa yang dituju —
// satu huruf salah ketik berarti pengajuan nyasar ke kebun asing.
//
// Langkah 2 menggantikan langkah 1 di layar yang SAMA, bukan rute baru. Dengan
// begitu tombol kembali di app bar selalu berarti "keluar dari alur gabung",
// bukan "mundur satu langkah" — dua arti untuk satu tombol adalah hal yang
// paling cepat membingungkan pengguna yang tidak akrab teknologi. Perpindahan
// antar langkah diurus tombol "Ganti" yang eksplisit.

export default function JoinFarmScreen() {
  const { refresh } = useAuth();
  const [joinCode, setJoinCode] = React.useState('');
  const [preview, setPreview] = React.useState<FarmPreview | null>(null);
  const [codeError, setCodeError] = React.useState<string | null>(null);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [checking, setChecking] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  const isConfirmStep = preview !== null;

  async function handleCheckCode() {
    setChecking(true);
    setCodeError(null);

    const result = await previewFarmByJoinCode({ joinCode });

    if (result.error) {
      setCodeError(result.error.message);
      setChecking(false);
      return;
    }

    setPreview(result.data);
    setChecking(false);
  }

  function handleChangeCode() {
    setPreview(null);
    setJoinCode('');
    setCodeError(null);
    setSubmitError(null);
  }

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError(null);

    const result = await requestJoinFarm({ joinCode });

    if (result.error) {
      setSubmitError(result.error.message);
      setSubmitting(false);
      return;
    }

    // Tidak ada modal sukses: berpindah ke layar tunggu sudah menjadi
    // konfirmasinya. Route guard yang menentukan tujuannya.
    await refresh();
    setSubmitting(false);
    router.replace('/');
  }

  return (
    <Screen
      autoScrollOnFocus
      header={<TopAppBar title="Gabung kebun" onBack={goBackToAccessChoice} />}
      footer={
        isConfirmStep ? (
          <Button title="Ajukan gabung" loading={submitting} onPress={handleSubmit} />
        ) : undefined
      }
    >
      {isConfirmStep ? (
        <>
          <ErrorBanner message={submitError} />
          <ConfirmStep code={joinCode} disabled={submitting} preview={preview} onChangeCode={handleChangeCode} />
        </>
      ) : (
        <View style={{ gap: tokens.space.xl }}>
          <JoinCodeField error={codeError} value={joinCode} onChangeText={setJoinCode} />
          {/* Tombol menempel di bawah kolom, bukan di dasar layar: ini form satu
              kolom, dan tombol di dasar layar akan tertutup papan ketik. */}
          <Button
            title="Lanjut"
            disabled={joinCode.length < JOIN_CODE_LENGTH}
            loading={checking}
            onPress={handleCheckCode}
          />
        </View>
      )}
    </Screen>
  );
}

function ConfirmStep({
  code,
  disabled,
  onChangeCode,
  preview,
}: {
  code: string;
  disabled: boolean;
  onChangeCode: () => void;
  preview: FarmPreview;
}) {
  return (
    <View style={{ gap: tokens.space.xxl }}>
      <View
        style={{
          alignItems: 'center',
          borderBottomColor: tokens.color.line.hairline,
          borderBottomWidth: 1,
          flexDirection: 'row',
          gap: tokens.space.md,
          justifyContent: 'space-between',
          paddingBottom: tokens.space.lg,
        }}
      >
        <Text selectable style={[codeTextStyle, { fontSize: 18, letterSpacing: 3 }]}>{code}</Text>
        <Pressable
          accessibilityRole="button"
          hitSlop={{ bottom: 8, left: 8, right: 8, top: 8 }}
          onPress={onChangeCode}
          disabled={disabled}
          style={({ pressed }) => ({ opacity: pressed || disabled ? 0.5 : 1 })}
        >
          <Text
            selectable={false}
            style={{
              color: tokens.color.brand.base,
              fontSize: tokens.type.bodyStrong.fontSize,
              fontWeight: '700',
            }}
          >
            Ganti
          </Text>
        </Pressable>
      </View>

      <View style={{ gap: tokens.space.sm }}>
        <Text
          selectable
          style={{
            color: tokens.color.text.primary,
            fontSize: tokens.type.title.fontSize,
            fontWeight: tokens.type.title.fontWeight,
            lineHeight: tokens.type.title.lineHeight,
          }}
        >
          {preview.farmName}
        </Text>
        {preview.location ? (
          <Text
            selectable
            style={{
              color: tokens.color.text.secondary,
              fontSize: tokens.type.body.fontSize,
              lineHeight: tokens.type.body.lineHeight,
            }}
          >
            {preview.location}
          </Text>
        ) : null}
      </View>

      {/* Baris pemilik hilang seluruhnya kalau namanya null — bukan baris kosong,
          bukan teks karangan. Secara data ini mustahil (tiap kebun punya tepat
          satu pemilik aktif), tapi RPC-nya memakai left join sehingga null tetap
          mungkin secara tipe. */}
      {preview.ownerName ? (
        <View style={{ gap: tokens.space.xs }}>
          <Text
            selectable
            style={{
              color: tokens.color.text.tertiary,
              fontSize: tokens.type.meta.fontSize,
              lineHeight: tokens.type.meta.lineHeight,
            }}
          >
            Pemilik
          </Text>
          <Text
            selectable
            style={{
              color: tokens.color.text.primary,
              fontSize: tokens.type.bodyStrong.fontSize,
              fontWeight: tokens.type.bodyStrong.fontWeight,
              lineHeight: tokens.type.bodyStrong.lineHeight,
            }}
          >
            {preview.ownerName}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

// Lokal di layar ini: <Field> dari ui.tsx tidak menerima maxLength, textAlign,
// maupun gaya monospace, dan ui.tsx tidak boleh disentuh di fase ini.
function JoinCodeField({
  error,
  onChangeText,
  value,
}: {
  error: string | null;
  onChangeText: (next: string) => void;
  value: string;
}) {
  return (
    <View style={{ gap: tokens.space.sm }}>
      <Text selectable style={{ color: tokens.color.text.primary, fontSize: 14, fontWeight: '700' }}>
        Kode kebun
      </Text>
      <TextInput
        // Tanpa ini user melihat ketikannya huruf kecil padahal sistem
        // menerimanya — bikin ragu apakah dia mengetik benar.
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={JOIN_CODE_LENGTH}
        onChangeText={(next) => onChangeText(next.toUpperCase())}
        // Sengaja TANPA placeholder. "Contoh: AVOL-ABC123" salah di ketiga
        // cirinya — kode sebenarnya 8 karakter heksadesimal tanpa awalan
        // (contoh 85CBFCD4) — dan penggantinya, delapan tanda hubung rapat,
        // terbaca seperti garis coret alih-alih tempat kosong, yang bisa tampak
        // seperti kolom nonaktif. Label "Kode kebun" di atas kolom yang rata
        // tengah dan berjarak sudah cukup menjelaskan.
        value={value}
        style={[
          codeTextStyle,
          {
            backgroundColor: tokens.color.surface.card,
            borderColor: error ? tokens.color.status.danger.text : tokens.color.line.card,
            borderCurve: 'continuous',
            borderRadius: tokens.radius.control,
            borderWidth: 1,
            height: tokens.layout.fieldHeight,
            paddingHorizontal: tokens.space.lg,
            textAlign: 'center',
          },
        ]}
      />
      {/* Galat tampil sebaris di bawah kolom, bukan snackbar yang keburu hilang. */}
      {error ? (
        <Text
          selectable
          style={{
            color: tokens.color.status.danger.text,
            fontSize: tokens.type.bodySmall.fontSize,
            lineHeight: tokens.type.bodySmall.lineHeight,
          }}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const codeTextStyle = {
  color: tokens.color.text.primary,
  fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  fontSize: 24,
  fontWeight: '700',
  letterSpacing: 6,
} as const;
