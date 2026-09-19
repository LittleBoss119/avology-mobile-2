import { router } from 'expo-router';
import React from 'react';
import { Text, TextInput, View } from 'react-native';

import { Button, Card, ErrorBanner, Screen, TopAppBar } from '../../src/components/ui';
import { tokens } from '../../src/constants/theme';
import { colors as palette, fonts, radius as shapeRadius, touch } from '../../src/theme/tokens';
import { useAuth } from '../../src/context/auth-context';
import { previewFarmByJoinCode, requestJoinFarm } from '../../src/services/memberService';
import type { FarmPreview } from '../../src/types/domain';

const JOIN_CODE_LENGTH = 8;

// Angka yang SAMA dengan setiap pencarian bertunda lain di repo ini —
// owner/trees/index.tsx:168, worker/trees/index.tsx:166,
// owner/schedules/index.tsx:170. Tidak ada angka baru yang dikarang di layar
// ini.
//
// farm-map-screen.tsx dulu jadi rujukan keempat; kolom pencariannya sudah
// dicabut bersama seluruh kontrol filter denah, jadi ia tidak punya jeda lagi.
const PREVIEW_DEBOUNCE_MS = 250;

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

// SATU layar, SATU keadaan yang tumbuh. Kolom kode tidak pernah hilang; kartu
// kebun muncul di bawahnya begitu kodenya cocok.
//
// Alasan aslinya tidak berubah, dan justru makin dipenuhi bentuk ini: tombol
// kembali di app bar harus SELALU berarti "keluar dari alur gabung", tidak
// pernah "mundur satu langkah". Dua arti untuk satu tombol adalah hal yang
// paling cepat membingungkan pengguna yang tidak akrab teknologi.
//
// Dulu niat itu dijaga dengan cara menahan kedua langkah di satu rute, lalu
// menyediakan tombol "Ganti" untuk berpindah antar langkah. Sekarang tidak ada
// lagi langkah untuk dipindahi: kolom kodenya selalu ada di tempatnya, jadi
// mengganti kode cukup dengan mengetik ulang. Tombol "Ganti" ikut hilang
// bersama langkah yang dulu dijaganya.
//
// Konsekuensinya pencarian kebun berjalan sendiri saat kode genap 8 karakter —
// tanpa tombol "Lanjut". Satu-satunya tombol di layar ini adalah tombol yang
// benar-benar mengirim sesuatu.

export default function JoinFarmScreen() {
  const { refresh } = useAuth();
  const [joinCode, setJoinCode] = React.useState('');
  const [preview, setPreview] = React.useState<FarmPreview | null>(null);
  const [codeError, setCodeError] = React.useState<string | null>(null);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [checking, setChecking] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  // Pencarian kebun, dipicu oleh KODENYA sendiri dan bukan oleh tombol.
  //
  // Efek ini bergantung pada `joinCode`, jadi setiap ketukan huruf membatalkan
  // jalannya yang sebelumnya lewat fungsi pembersih di bawah. Itu sekaligus
  // jawaban untuk balasan basi: `cancelled` ditutup sebelum efek berikutnya
  // mulai, sehingga balasan pencarian yang kodenya sudah tidak berlaku lagi
  // dibuang di tempat dan tidak pernah menyentuh state. Pola `let cancelled`
  // ini sama dengan polling di access-status-screen.tsx.
  //
  // Tiga setState di puncak memenuhi aturan "kode diubah setelah kartu muncul":
  // kartu, galat kode, dan galat pengiriman semuanya milik kode SEBELUMNYA,
  // jadi ketiganya dibersihkan begitu kodenya bergerak — sebelum apa pun yang
  // baru dimulai. Efek ini hanya berjalan saat `joinCode` berubah, jadi kartu
  // yang sudah muncul tidak akan dihapus oleh render biasa.
  React.useEffect(() => {
    const code = joinCode.trim();

    setPreview(null);
    setCodeError(null);
    setSubmitError(null);

    if (code.length !== JOIN_CODE_LENGTH) {
      setChecking(false);
      return;
    }

    let cancelled = false;

    // Dinyalakan SEBELUM jeda tunda, bukan sesudahnya. Begitu huruf kedelapan
    // masuk, pengguna langsung melihat bahwa aplikasinya sedang mengerjakan
    // sesuatu; menunda penanda sampai panggilan benar-benar berangkat
    // menyisakan 250 ms layar yang terlihat mati.
    setChecking(true);

    const timer = setTimeout(() => {
      void (async () => {
        const result = await previewFarmByJoinCode({ joinCode: code });

        if (cancelled) {
          return;
        }

        setChecking(false);

        if (result.error) {
          setCodeError(result.error.message);
          return;
        }

        setPreview(result.data);
      })();
    }, PREVIEW_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [joinCode]);

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

  // Lokasi dan nama pemilik disatukan jadi SATU baris sekunder, dengan pemisah
  // ' · ' — konvensi yang sama dengan buildFarmMetaLine (farmFormat.ts:26).
  // Bagian yang kosong HILANG alih-alih jadi placeholder, jadi tidak ada
  // pemisah yang menggantung; kalau keduanya kosong, barisnya tidak dirender
  // sama sekali. Nama pemilik bisa null secara tipe karena RPC-nya memakai left
  // join (lihat migrasi 037), meski secara data tiap kebun punya tepat satu
  // pemilik aktif.
  //
  // Kata "Pemilik" menempel di depan namanya, BUKAN jadi baris berlabel
  // sendiri. Tanpa penanda itu barisnya berbunyi "Ngawi, Jawa Timur · Budi
  // Santoso", dan nama orang yang berdiri di samping nama tempat bisa terbaca
  // sebagai nama dusun kedua. Penandanya ikut ke mana pun namanya pergi: kalau
  // lokasinya kosong, barisnya jadi "Pemilik Budi Santoso" — tetap bermakna,
  // tetap tanpa pemisah menggantung.
  const previewLocation = preview?.location?.trim();
  const previewOwnerName = preview?.ownerName?.trim();
  const previewMetaLine = [
    previewLocation,
    previewOwnerName ? `Pemilik ${previewOwnerName}` : undefined,
  ]
    .filter((part): part is string => Boolean(part))
    .join(' · ');

  return (
    <Screen
      autoScrollOnFocus
      header={<TopAppBar title="Gabung kebun" onBack={goBackToAccessChoice} />}
      // Satu tombol sepanjang waktu, di tempat yang tidak pernah bergeser.
      // Nonaktif sampai ada kebun yang benar-benar ditemukan — menekan "Ajukan
      // gabung" tanpa tahu kebun tujuannya adalah persis kesalahan yang alur ini
      // dibuat untuk mencegah.
      //
      // `loading` mengunci tombolnya selama pengiriman: Button menyetel
      // disabled={disabled || loading} pada Pressable-nya (ui.tsx), jadi ketukan
      // kedua tidak bisa membuat pengajuan kembar. Mekanismenya sudah ada; tidak
      // ada penguncian tambahan yang dibuat di sini.
      footer={
        <Button
          title="Ajukan gabung"
          disabled={preview === null}
          loading={submitting}
          onPress={handleSubmit}
        />
      }
    >
      {/* Galat PENGIRIMAN pengajuan — tetap di puncak layar sebagai spanduk,
          tidak berubah. Galat PENCARIAN kode punya jalurnya sendiri, sebaris di
          bawah kolom kode, karena ia milik kolom itu. */}
      <ErrorBanner message={submitError} />

      <JoinCodeField
        error={codeError}
        status={checking ? 'Mencari kebun...' : null}
        value={joinCode}
        onChangeText={setJoinCode}
      />

      {/* Kartu tumbuh DI BAWAH kolom kode, tidak menggantikannya. Tanpa baris
          "Kode" dan tanpa tombol "Ganti": kodenya sudah terbaca di kolom tepat
          di atas kartu ini, dan mengubahnya dilakukan dengan mengetik ulang di
          kolom itu. Kalimat "Kamu akan mengajukan diri ke kebun ini" juga
          dicabut — tombol di dasar layar sudah mengatakannya. */}
      {preview ? (
        <View style={{ gap: tokens.space.lg }}>
          <Card>
            <View style={{ gap: tokens.space.xs }}>
              <Text
                selectable
                style={{
                  color: tokens.color.brand.base,
                  fontSize: tokens.type.title.fontSize,
                  fontWeight: tokens.type.title.fontWeight,
                  lineHeight: tokens.type.title.lineHeight,
                }}
              >
                {preview.farmName}
              </Text>
              {previewMetaLine ? (
                <Text
                  selectable
                  style={{
                    color: tokens.color.text.secondary,
                    fontSize: tokens.type.bodySmall.fontSize,
                    lineHeight: tokens.type.bodySmall.lineHeight,
                  }}
                >
                  {previewMetaLine}
                </Text>
              ) : null}
            </View>
          </Card>

          {/* DIPERTAHANKAN apa adanya. Ini satu-satunya kalimat di layar ini
              yang menerangkan apa yang terjadi SESUDAH tombol ditekan — kenapa
              layar berikutnya cuma menunggu dan tidak melakukan apa-apa. */}
          <Text
            selectable
            style={{
              color: tokens.color.text.tertiary,
              fontSize: tokens.type.meta.fontSize,
              lineHeight: tokens.type.meta.lineHeight,
            }}
          >
            Pemilik kebun akan meninjau pengajuanmu dulu sebelum kamu bisa mulai bekerja.
          </Text>
        </View>
      ) : null}
    </Screen>
  );
}

// Lokal di layar ini: <Field> dari ui.tsx tidak menerima maxLength, textAlign,
// maupun gaya monospace, dan ui.tsx tidak boleh disentuh di fase ini.
// DELAPAN petak, bukan enam.
//
// Spek redesign menulis "6 petak besar" dan aturan "Huruf besar semua, 6
// karakter". Itu keliru terhadap data: kode kebun dibuat di database oleh
// generate_join_code() sebagai `upper(substr(md5(...), 1, 8))` — DELAPAN
// karakter heksadesimal kapital (migrasi 006:72). Enam petak berarti kode yang
// sah tidak akan pernah muat, dan tombol "Gabung" tidak akan pernah menyala.
//
// Memperbaikinya ke enam menuntut migrasi database dan perubahan validasi, dan
// batch 2 melarang keduanya. Jadi jumlah petaknya mengikuti kenyataan, bukan
// spek — persis seperti panjang kata sandi dan nama pemilik di batch yang sama.
//
// SATU TextInput, delapan petak. Petaknya cuma gambar; yang menerima ketikan,
// tempelan, dan saran keyboard tetap satu kolom tunggal yang dibentangkan
// transparan di atasnya. Delapan input terpisah akan memecah tempelan kode dari
// WhatsApp — cara kode ini benar-benar sampai ke tangan pekerja — menjadi satu
// huruf di kotak pertama.
function JoinCodeField({
  error,
  onChangeText,
  status,
  value,
}: {
  error: string | null;
  onChangeText: (next: string) => void;
  // Penanda pencarian, satu baris teks di bawah kolom. SENGAJA bukan pemintal
  // di dalam tombol: tombol satu-satunya di layar ini milik "Ajukan gabung",
  // dan memutar pemintal di sana selama pencarian akan mengabarkan bahwa
  // pengajuan sedang dikirim padahal belum. Repo ini belum punya penanda
  // sebaris semacam ini di mana pun — yang ada cuma LoadingState yang mengganti
  // seluruh layar, dan itu akan menelan kolom yang sedang diketik.
  status: string | null;
  value: string;
}) {
  const characters = Array.from({ length: JOIN_CODE_LENGTH }, (_, index) => value[index] ?? '');

  return (
    <View style={{ gap: tokens.space.sm }}>
      <Text
        selectable
        style={{ color: palette.textPrimary, fontFamily: fonts.sansSemiBold, fontSize: 14 }}
      >
        Kode kebun
      </Text>

      {/* Pembungkus setinggi petaknya. TextInput di dalamnya dibentangkan
          absolut menutupi seluruh baris, jadi menekan petak mana pun menaruh
          kursor — tidak ada petak yang "mati". */}
      <View>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {characters.map((character, index) => (
            <View
              key={index}
              style={{
                alignItems: 'center',
                backgroundColor: palette.surfaceRaised,
                borderColor: error
                  ? palette.statusBuruk
                  : character
                    ? palette.accent
                    : palette.borderStrong,
                borderCurve: 'continuous',
                borderRadius: shapeRadius.control,
                // Petak terisi bergaris accent 1,5px — penanda maju yang sama
                // dengan prop `editing` pada Field. Tanpa itu, satu-satunya yang
                // menandai kemajuan adalah hurufnya sendiri, dan pada layar yang
                // kena silau huruf tunggal jauh lebih sulit dilihat daripada
                // garis kotaknya.
                borderWidth: character ? 1.5 : 1,
                // flex 1 + aspectRatio, bukan lebar tetap: delapan petak harus
                // muat di layar tersempit tanpa angka yang ditebak per perangkat.
                flex: 1,
                height: touch.field,
                justifyContent: 'center',
              }}
            >
              <Text
                selectable={false}
                style={{
                  color: palette.textPrimary,
                  fontFamily: fonts.sansSemiBold,
                  // 20, bukan 24: delapan petak di layar 360 menyisakan ~36px
                  // per petak, dan huruf 24 menyentuh dinding kotaknya.
                  fontSize: 20,
                }}
              >
                {character}
              </Text>
            </View>
          ))}
        </View>

        <TextInput
          // Tanpa ini user melihat ketikannya huruf kecil padahal sistem
          // menerimanya — bikin ragu apakah dia mengetik benar.
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={JOIN_CODE_LENGTH}
          onChangeText={(next) => onChangeText(next.toUpperCase())}
          // Tanpa placeholder: petak kosong SUDAH menunjukkan ada berapa
          // karakter yang diminta dan di mana masing-masing duduk — pekerjaan
          // yang dulu coba dilakukan placeholder dan selalu gagal.
          value={value}
          style={{
            // TRANSPARAN dan dibentangkan di atas petak. Warna teksnya juga
            // transparan supaya ketikan aslinya tidak terbaca ganda di atas
            // huruf yang sudah digambar petak.
            //
            // Kursor sengaja dibiarkan tampil (tidak di-caretHidden): ia satu-
            // satunya isyarat bahwa kolom sedang aktif, dan tanpa itu orang yang
            // mengetuk tidak tahu keyboard sudah siap menerima.
            bottom: 0,
            color: 'transparent',
            fontSize: 20,
            left: 0,
            position: 'absolute',
            right: 0,
            textAlign: 'center',
            top: 0,
          }}
        />
      </View>

      {/* SATU baris aturan, selalu tampil — bukan helperText yang lenyap begitu
          ada galat. Ia menyebut dua hal yang tidak bisa disimpulkan dari petak
          kosong: bahwa hurufnya kapital semua, dan ada berapa. */}
      <Text
        selectable
        style={{
          color: palette.textMuted,
          fontFamily: fonts.sans,
          fontSize: 14,
          lineHeight: 20,
        }}
      >
        Huruf besar semua, {JOIN_CODE_LENGTH} karakter.
      </Text>

      {/* Galat tampil sebaris di bawah kolom, bukan snackbar yang keburu hilang.
          Galat mengalahkan penanda pencarian, mengikuti aturan yang sama yang
          dipakai Field di ui.tsx untuk error versus helperText — keduanya tidak
          pernah tampil bersamaan. Ukuran keduanya disamakan supaya pergantian
          antar keduanya tidak menggeser apa pun di bawahnya. */}
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
      ) : status ? (
        <Text
          selectable
          style={{
            color: tokens.color.text.tertiary,
            fontSize: tokens.type.bodySmall.fontSize,
            lineHeight: tokens.type.bodySmall.lineHeight,
          }}
        >
          {status}
        </Text>
      ) : null}
    </View>
  );
}

