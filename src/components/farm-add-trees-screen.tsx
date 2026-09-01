import { router } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { tokens } from '../constants/theme';
import { useAuth } from '../context/auth-context';
import {
  consumePendingNewTreePositions,
  peekPendingNewTreePositions,
} from '../lib/pendingNewTreePositions';
import { createTreesAtPositions } from '../services/treeService';
import type { CreateTreesAtPositionsData } from '../types/domain';
// formatFullDate, BUKAN formatDateOnly. Yang pertama mengurai 'YYYY-MM-DD'
// lewat komponennya sehingga tidak bisa bergeser sehari oleh zona waktu; yang
// kedua melewatkan string itu ke new Date(), yang menafsirkannya sebagai tengah
// malam UTC. Kalimat konfirmasi ini yang dibaca orang sebelum melahirkan baris
// yang tidak bisa dihapus — tanggalnya tidak boleh meleset.
import { formatFullDate } from '../utils/taskDueDate';
import { ConfirmDialog } from './bottom-sheet';
import { Icon } from './icons';
import { useSnackbar } from './snackbar';
import { Button, ErrorBanner, Field, FormSection, DateField, Screen, TopAppBar } from './ui';

// Menambahkan pohon ke BANYAK posisi kosong sekaligus, dari himpunan yang
// dipilih di peta denah.
//
// Kembarannya untuk satu posisi adalah app/(owner)/owner/trees/create.tsx, dan
// layar ini SENGAJA bukan turunannya. Tiga hal membedakannya, dan ketiganya
// disengaja:
//
//   * VARIETAS OPSIONAL di sini, WAJIB di sana. create_tree_with_planting dan
//     create_trees_at_positions sama-sama menerima null sejak 055; yang
//     mewajibkannya di layar satu-satu adalah validateTreeForm, dan itu TIDAK
//     diubah. Mengisi varietas untuk satu pohon yang sedang ditatap itu murah;
//     menuntutnya sebelum sembilan puluh posisi boleh lahir hanya menghentikan
//     penyiapan kebun karena hal yang bisa dilengkapi kapan saja.
//
//   * TANPA FOTO, dan tanpa mengimpor photoAttachmentService sama sekali. Satu
//     foto untuk sembilan puluh pohon tidak punya arti, dan sembilan puluh foto
//     bukan alur yang layar ini janjikan.
//
//   * KONFIRMASI WAJIB. Di sana taruhannya satu baris yang posisinya masih bisa
//     dikoreksi lewat update_tree_with_planting; di sini sebanyak yang dipilih,
//     dan baris trees TIDAK BISA DIHAPUS sama sekali — prevent_tree_delete_trigger
//     (006:416) menolak setiap DELETE, dan mengarsipkan tidak membebaskan
//     kodenya karena trees_unique_code_per_farm bukan constraint partial
//     (054:248). Salah membuat sembilan puluh pohon berarti sembilan puluh
//     posisi terkunci selamanya.
//
// TANPA prop apa pun, termasuk basePath. Sama dengan farm-care-record-screen:
// mode pilih di peta hanya ada untuk pemilik (tombol "Pilih" dipagari isOwner,
// dan tombol itu satu-satunya jalan masuk), jadi layar ini punya TEPAT SATU
// pemanggil. Prop yang nilainya cuma satu adalah keluwesan palsu.
//
// TANPA PEMUATAN DATA SAMA SEKALI. Layar catat perawatan memanggil getTrees
// untuk menyaring ulang siklus aktif, karena create_care_activity tidak
// memeriksanya di database. Di sini kebalikannya: create_trees_at_positions
// menyaring SENDIRI — posisi terisi, di luar petak, dan cacat bentuk semuanya
// disaring di dalam transaksinya lalu dilaporkan balik. Menyaring ulang di sini
// berarti dua definisi "posisi bisa dipakai" yang harus dijaga tetap sama, dan
// yang di klien pasti kalah baru karena ia membaca snapshot yang lebih lama.

// Sebanyak ini kode posisi ditampilkan sebelum sisanya dilipat. Angka dan
// alasannya sama dengan farm-care-record-screen: tiga baris chip pada layar
// ponsel — cukup untuk mengenali apa yang terpilih, belum cukup untuk
// menenggelamkan formulir di bawahnya.
const VISIBLE_CODE_LIMIT = 12;

// Urutan yang sama dengan create_trees_at_positions dan compareTreePosition di
// farm-care-record-screen: baris dulu sebagai ANGKA, lalu kolom. Urutan teks
// menaruh '10-A' sebelum '2-A', yang bukan urutan apa pun yang dikenali orang
// yang sedang berdiri di kebun.
//
// Kode yang barisnya tidak terbaca angka jatuh ke belakang alih-alih melempar:
// bentuk kanonik memang dijamin peta, tapi urutan bukan tempat yang tepat untuk
// menegakkannya — RPC yang menolaknya, dan penolakan itu yang dilaporkan.
function comparePositionCode(left: string, right: string): number {
  const leftRow = Number.parseInt(left, 10);
  const rightRow = Number.parseInt(right, 10);
  const leftSafe = Number.isNaN(leftRow) ? Number.MAX_SAFE_INTEGER : leftRow;
  const rightSafe = Number.isNaN(rightRow) ? Number.MAX_SAFE_INTEGER : rightRow;

  if (leftSafe !== rightSafe) {
    return leftSafe - rightSafe;
  }

  return left.localeCompare(right);
}

// Chip kode posisi yang bisa dibuang. Kembaran dekat RemovableCodeChip di
// farm-care-record-screen.tsx, dan sengaja DISALIN alih-alih diangkat ke
// ui.tsx: mengangkatnya berarti menyentuh berkas bersama terbesar di repo demi
// satu kebutuhan tahap ini. Keduanya presentasional murni dan tidak menyimpan
// aturan apa pun, jadi menyimpang satu sama lain tidak bisa merusak perilaku.
function RemovableCodeChip({ code, onRemove }: { code: string; onRemove: () => void }) {
  return (
    <Pressable
      accessibilityLabel={`Buang ${code} dari daftar`}
      accessibilityRole="button"
      onPress={onRemove}
      style={({ pressed }) => ({
        alignItems: 'center',
        backgroundColor: tokens.color.brand.soft,
        borderColor: tokens.color.brand.border,
        borderCurve: 'continuous',
        borderRadius: tokens.radius.pill,
        borderWidth: 1,
        flexDirection: 'row',
        gap: tokens.space.xs,
        minHeight: 36,
        opacity: pressed ? 0.82 : 1,
        paddingHorizontal: tokens.space.md,
      })}
    >
      <Text
        selectable={false}
        numberOfLines={1}
        style={{ color: tokens.color.brand.dark, ...tokens.type.meta, fontWeight: '700' }}
      >
        {code}
      </Text>
      <Icon name="x" size={tokens.icon.xs} color={tokens.color.brand.base} />
    </Pressable>
  );
}

// Satu kotak keterangan pada layar hasil.
//
// SATU KOTAK PER ALASAN, dan itu inti dari cara layar ini melaporkan. Migrasi
// 062 sengaja TIDAK mengembalikan satu rejected_message gabungan supaya tiap
// alasan bisa dijelaskan dengan kalimatnya sendiri; menggabungkannya kembali di
// sini akan membuang keputusan itu di lapisan terakhir, tepat di depan orang
// yang paling membutuhkannya.
function ResultBlock({
  codes,
  message,
  title,
  tone,
}: {
  codes?: string[];
  message: string;
  title: string;
  tone: 'success' | 'warning' | 'danger' | 'neutral';
}) {
  const palette = tokens.color.status[tone];

  return (
    <View
      style={{
        backgroundColor: palette.bg,
        borderColor: palette.border,
        borderCurve: 'continuous',
        borderRadius: tokens.radius.cardInner,
        borderWidth: 1,
        gap: tokens.space.xs,
        padding: tokens.space.md,
      }}
    >
      <Text selectable style={{ color: palette.text, ...tokens.type.bodySmall, fontWeight: '700' }}>
        {title}
      </Text>
      <Text selectable style={{ color: palette.text, ...tokens.type.bodySmall }}>
        {message}
      </Text>

      {/* Kodenya dirangkai jadi satu paragraf, bukan chip. Chip di layar hasil
          mengundang ketukan yang tidak akan menjawab apa pun — dan daftar ini
          bisa memuat puluhan kode yang hanya perlu dibaca, lalu disalin lewat
          selectable kalau pemilik ingin memeriksanya di peta. */}
      {codes && codes.length > 0 ? (
        <Text selectable style={{ color: palette.text, ...tokens.type.meta }}>
          {[...codes].sort(comparePositionCode).join(', ')}
        </Text>
      ) : null}
    </View>
  );
}

export function FarmAddTreesScreen() {
  const { currentFarm } = useAuth();
  const showSnackbar = useSnackbar();
  const [confirmVisible, setConfirmVisible] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [expanded, setExpanded] = React.useState(false);
  const [plantedAt, setPlantedAt] = React.useState(formatDateInput(new Date()));
  const [result, setResult] = React.useState<CreateTreesAtPositionsData | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [variety, setVariety] = React.useState('');

  // Kode posisi dari peta, DIBACA DI FASE RENDER — bukan di dalam effect.
  //
  // INI YANG MEMBUAT PENGHAPUSAN DI EFFECT AMAN, dan urutannya wajib dipahami
  // sebelum menyentuh salah satunya:
  //
  //   render (peek di sini)  ->  effect penghapus
  //
  // React menjalankan SELURUH fase render sebelum effect mana pun. Jadi begitu
  // pembacaannya duduk di penginisialisasi useState, kodenya sudah tersimpan di
  // state layar ini sebelum consume sempat menyala, dan urutan deklarasi antar
  // effect berhenti menentukan apa pun.
  //
  // Versi pertama farm-care-record-screen membaca di dalam effect PEMUATAN
  // sementara effect penghapus dideklarasikan di atasnya, dan gagal 100% karena
  // kotaknya selalu sudah kosong saat dibaca. Pola yang benar itu yang disalin
  // ke sini — letak PEEK-nya, bukan cuma letak consume-nya.
  //
  // peek SENGAJA tidak menghapus: penginisialisasi useState boleh dipanggil
  // lebih dari sekali, dan versi yang menghapus akan mengosongkan daftarnya
  // pada pemanggilan kedua. Yang menghapus tetap effect di bawah, tepat sekali.
  const [initialCodes] = React.useState<readonly string[]>(
    () => peekPendingNewTreePositions() ?? []
  );

  // Daftar yang bisa dipangkas. Diturunkan dari initialCodes sekali, lalu hidup
  // sendiri — membuang chip tidak boleh menyentuh kotak titipan, yang sudah
  // dikosongkan effect di bawah.
  //
  // Diurutkan menurut posisi, bukan menurut urutan ketukan di peta: yang dibaca
  // pemilik sebelum menekan simpan harus bisa ditelusuri baris demi baris di
  // kebun, bukan mengikuti jejak jarinya.
  const [codes, setCodes] = React.useState<string[]>(() =>
    [...initialCodes].sort(comparePositionCode)
  );

  const farmId = currentFarm?.farmId;

  // Titipannya dipakai TEPAT SEKALI. Aman berada di effect justru karena kedua
  // pembacaannya sudah selesai di fase render (lihat catatan panjang di atas).
  React.useEffect(() => {
    consumePendingNewTreePositions();
  }, []);

  const trimmedVariety = variety.trim();
  const visibleCodes = expanded ? codes : codes.slice(0, VISIBLE_CODE_LIMIT);

  function goBackToMap() {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/owner/trees/map');
  }

  function removeCode(code: string) {
    setCodes((current) => current.filter((item) => item !== code));
  }

  // Menekan simpan TIDAK menulis apa pun. Ia memvalidasi lalu membuka
  // konfirmasi; penulisannya ada di handleConfirmedSave.
  function handleSavePress() {
    if (!plantedAt) {
      setError('Tanggal tanam wajib diisi.');
      return;
    }

    setError(null);
    setConfirmVisible(true);
  }

  async function handleConfirmedSave() {
    if (!farmId) {
      setConfirmVisible(false);
      setError('Data kebun aktif tidak ditemukan.');
      return;
    }

    if (codes.length === 0) {
      setConfirmVisible(false);
      setError('Tidak ada posisi yang bisa ditambahkan.');
      return;
    }

    setSubmitting(true);

    const created = await createTreesAtPositions({
      farmId,
      plantedAt,
      positionCodes: codes,
      variety: trimmedVariety,
    });

    setSubmitting(false);
    setConfirmVisible(false);

    if (created.error) {
      setError(created.error.message);
      return;
    }

    // GERBANG "BERSIH". Hanya hasil yang sepenuhnya bersih yang melewati layar
    // hasil; sisanya jatuh ke bawah dan mengisi `result` seperti sebelumnya.
    if (isCleanResult(created.data)) {
      // Snackbar DULU, baru pindah layar. Providernya duduk di root
      // (app/_layout.tsx), jadi pesannya bertahan melewati navigasi — pola yang
      // sama dipakai farm-profile.tsx. Urutan terbalik juga akan tampil, tapi
      // menaruh pesannya lebih dulu membuat urutan bacanya sama dengan urutan
      // kodenya.
      showSnackbar(buildSuccessMessage(created.data.createdCodes.length, trimmedVariety));
      goBackToMap();
      return;
    }

    // TANPA navigasi di sini. Yang memindahkan layar adalah tombol di layar
    // hasil — kalau dipanggil sekarang, hasilnya tidak akan pernah sempat
    // terbaca. Pola tunda-muat-ulang yang sama dipakai farm-care-record-screen
    // dan create-farm.tsx.
    //
    // Ini berlaku JUGA saat nol pohon dibuat. RPC yang menolak seluruh
    // himpunannya tetap BERHASIL — nol dibuat adalah hasil yang sah, bukan
    // galat sistem — dan laporan penolakannya justru satu-satunya hal berguna
    // yang bisa disampaikan pada keadaan itu.
    setResult(created.data);
  }

  // ---------- Layar hasil ----------
  //
  // MENGGANTIKAN formulir, bukan menumpanginya sebagai modal. Layar catat
  // perawatan memakai modal karena hasilnya satu kalimat; di sini hasilnya bisa
  // memuat tiga kelompok penolakan berisi puluhan kode, dan sebuah modal yang
  // isinya melebihi tinggi layar butuh penggulung sendiri di dalam penggulung
  // milik Screen — persis tumpukan yang membuat peta tidak memakai Screen.
  //
  // Sifat tunda-muat-ulangnya tetap: navigasi hanya terjadi lewat tombol, dan
  // tombol kembali di TopAppBar memanggil handler yang SAMA, jadi tidak ada
  // jalan keluar yang melewatkan pemuatan ulang peta.
  if (result) {
    const rejectedTotal =
      result.rejectedOccupied.length +
      result.rejectedOutOfGrid.length +
      result.rejectedMalformed.length;

    return (
      <Screen
        header={<TopAppBar title="Hasil tambah pohon" onBack={goBackToMap} />}
        stickyFooter={<Button onPress={goBackToMap} title="Kembali ke denah" variant="primary" />}
      >
        {result.createdCodes.length > 0 ? (
          <ResultBlock
            codes={result.createdCodes}
            message={
              trimmedVariety
                ? `Varietas ${trimmedVariety}, ditanam ${formatFullDate(plantedAt)}.`
                : `Ditanam ${formatFullDate(plantedAt)}. Varietas belum diisi dan bisa dilengkapi dari detail tiap pohon.`
            }
            title={`${result.createdCodes.length} pohon dibuat`}
            tone="success"
          />
        ) : (
          <ResultBlock
            message="Tidak ada satu pun posisi yang bisa dipakai. Rinciannya di bawah — tidak ada yang tersimpan, dan tidak ada yang perlu dibatalkan."
            title="Tidak ada pohon yang dibuat"
            tone="neutral"
          />
        )}

        {/* KETIGA EMBER TERPISAH. Ketiganya berarti hal yang berbeda bagi orang
            yang membacanya: yang pertama berarti "sudah ada pohonnya", yang
            kedua "petak kebunnya lebih kecil dari yang kamu pilih", yang ketiga
            "ada yang salah di aplikasi". Satu kalimat gabungan akan menyuruh
            pemilik menebak yang mana yang menimpanya. */}
        {result.rejectedOccupied.length > 0 ? (
          <ResultBlock
            codes={result.rejectedOccupied}
            message="Posisi ini sudah punya pohon. Kode posisi tidak pernah dibebaskan, jadi posisinya tetap terpakai."
            title={`${result.rejectedOccupied.length} posisi sudah ditempati`}
            tone="warning"
          />
        ) : null}

        {result.rejectedOutOfGrid.length > 0 ? (
          <ResultBlock
            codes={result.rejectedOutOfGrid}
            message="Posisi ini berada di luar ukuran petak kebun. Perbesar ukuran petak lebih dulu kalau kebunnya memang sudah meluas."
            title={`${result.rejectedOutOfGrid.length} posisi di luar petak`}
            tone="warning"
          />
        ) : null}

        {result.rejectedMalformed.length > 0 ? (
          <ResultBlock
            codes={result.rejectedMalformed}
            message="Bentuk kode posisi ini tidak sah. Ini seharusnya tidak pernah terjadi dari denah kebun — laporkan kalau kamu melihatnya."
            title={`${result.rejectedMalformed.length} kode posisi tidak sah`}
            tone="danger"
          />
        ) : null}

        {/* BUKAN PENOLAKAN, dan dinyatakan begitu. Kode yang terkirim dua kali
            tetap dibuat satu kali dan sudah ikut terhitung di blok pertama. */}
        {result.duplicateCodes.length > 0 ? (
          <ResultBlock
            codes={result.duplicateCodes}
            message="Kode ini terkirim lebih dari sekali dan dibuat satu kali saja. Bukan kegagalan — hanya penjelasan kenapa jumlah yang dibuat lebih sedikit dari jumlah yang dipilih."
            title={`${result.duplicateCodes.length} posisi terkirim ganda`}
            tone="neutral"
          />
        ) : null}

        {/* Angka saja, tanpa daftar: entri kosong tidak punya kode yang bisa
            disebutkan kembali. */}
        {result.blankCount > 0 ? (
          <ResultBlock
            message="Entri kosong ini dilewati. Ia tidak punya kode posisi yang bisa ditampilkan."
            title={`${result.blankCount} entri kosong dilewati`}
            tone="neutral"
          />
        ) : null}

        {rejectedTotal === 0 && result.duplicateCodes.length === 0 && result.blankCount === 0 ? (
          <Text selectable style={{ color: tokens.color.text.secondary, ...tokens.type.bodySmall }}>
            Seluruh posisi yang dipilih berhasil ditambahkan.
          </Text>
        ) : null}
      </Screen>
    );
  }

  // ---------- Formulir ----------

  return (
    <Screen
      header={<TopAppBar title="Tambah pohon" onBack={goBackToMap} />}
      stickyFooter={
        <Button
          disabled={codes.length === 0}
          loading={submitting}
          onPress={handleSavePress}
          title="Simpan"
        />
      }
    >
      <ErrorBanner message={error} />

      <FormSection
        title="Posisi yang akan ditanami"
        description="Daftar ini datang dari denah kebun. Ketuk kode untuk membuangnya; menambah posisi dilakukan dari peta."
      >
        {codes.length === 0 ? (
          <View style={{ gap: tokens.space.md }}>
            <Text selectable style={{ color: tokens.color.text.secondary, ...tokens.type.bodySmall }}>
              {initialCodes.length === 0
                ? 'Tidak ada posisi yang diserahkan dari denah. Pilih posisi kosongnya lebih dulu di peta.'
                : 'Semua posisi sudah dibuang dari daftar. Tidak ada yang bisa ditambahkan.'}
            </Text>
            <Button onPress={goBackToMap} size="small" title="Pilih ulang di denah" variant="secondary" />
          </View>
        ) : (
          <View style={{ gap: tokens.space.md }}>
            <Text selectable style={{ color: tokens.color.text.secondary, ...tokens.type.bodySmall }}>
              {`${codes.length} pohon akan dibuat`}
            </Text>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space.sm }}>
              {visibleCodes.map((code) => (
                <RemovableCodeChip key={code} code={code} onRemove={() => removeCode(code)} />
              ))}
            </View>

            {/* Dilipat, bukan digulung di dalam kotak sendiri: penggulung
                vertikal di dalam penggulung vertikal milik Screen akan berebut
                gestur yang sama. Melipat membiarkan halamannya yang menggulung.

                Syaratnya panjang DAFTAR, bukan berapa yang sedang tersembunyi.
                Kalau diukur dari yang tersembunyi, tombolnya tetap tampil
                setelah pemilik memangkas daftar di bawah batas sambil terbuka —
                tombol yang menjanjikan melipat sesuatu yang sudah tidak ada. */}
            {codes.length > VISIBLE_CODE_LIMIT ? (
              <Button
                onPress={() => setExpanded((current) => !current)}
                size="small"
                title={expanded ? 'Sembunyikan sebagian' : `Lihat semua (${codes.length})`}
                variant="quiet"
              />
            ) : null}
          </View>
        )}
      </FormSection>

      <FormSection
        title="Data penanaman"
        description="Satu tanggal tanam dan satu varietas berlaku untuk seluruh posisi di daftar ini."
      >
        <View style={{ gap: tokens.space.sm }}>
          <DateField label="Tanggal tanam *" onChangeDate={setPlantedAt} value={plantedAt} />
        </View>
      </FormSection>

      {/* OPSIONAL, dan dikatakan terus terang beserta jalan keluarnya. Layar
          tambah pohon satu-satu tetap mewajibkannya lewat validateTreeForm, dan
          itu TIDAK diubah — perbedaannya disengaja, lihat catatan di kepala
          berkas. */}
      <FormSection
        title="Varietas"
        description="Opsional. Bisa dikosongkan sekarang dan dilengkapi belakangan dari detail tiap pohon."
      >
        <Field label="" onChangeText={setVariety} placeholder="Contoh: Alpukat mentega" value={variety} />
      </FormSection>

      {/* KONFIRMASI WAJIB, dan sengaja berbeda dari layar tambah pohon
          satu-satu yang tidak punya konfirmasi sama sekali. Di sana posisinya
          masih bisa dikoreksi lewat update_tree_with_planting; di sini
          jumlahnya sebanyak yang dipilih, dan baris trees tidak punya jalur
          hapus sama sekali. */}
      <ConfirmDialog
        cancelLabel="Periksa lagi"
        confirmLabel="Ya, tambahkan sekarang"
        loading={submitting}
        message={buildConfirmMessage({
          count: codes.length,
          plantedAt,
          variety: trimmedVariety,
        })}
        title="Tambahkan pohon sekarang?"
        visible={confirmVisible}
        onCancel={() => {
          if (!submitting) {
            setConfirmVisible(false);
          }
        }}
        onConfirm={() => void handleConfirmedSave()}
      />
    </Screen>
  );
}

// Satu-satunya keadaan yang boleh MELEWATI layar hasil.
//
// TIGA ember penolakan, dan ketiganya saling lepas: 062 menyaring berlapis —
// bentuk, lalu petak, lalu keterisian — sehingga satu kode masuk ke tepat satu
// ember. Kosongnya ketiga berarti tidak ada satu pun kode yang ditolak.
//
// created_codes.length > 0 BUKAN pengulangan dari ketiganya. Ia menutup keadaan
// "nol ditolak, nol dibuat": kalau itu mungkin terjadi, ia harus tetap masuk
// layar hasil, bukan dilaporkan sebagai sukses yang tidak melahirkan apa pun.
//
// duplicate_codes dan blank_count SENGAJA TIDAK ikut. Keduanya bukan kegagalan:
//
//   * duplicate_codes — kode yang terkirim dua kali TETAP DIBUAT satu kali dan
//     ikut muncul di created_codes (062:210-214). Ia dilaporkan supaya klien
//     yang mengira mengirim N tahu kenapa yang lahir kurang dari N, bukan
//     karena ada yang gagal. Menahan pemilik di layar hasil untuk itu berarti
//     menyebut peleburan sebagai penolakan.
//   * blank_count — entri kosong dilewati, dan tidak ada kode yang bisa
//     disebutkan kembali untuknya.
//
// Keduanya tetap PUNYA bloknya sendiri di layar hasil, jadi kalau ada penolakan
// sungguhan yang menahan pemilik di sana, keterangannya tetap terbaca.
function isCleanResult(data: CreateTreesAtPositionsData): boolean {
  return (
    data.rejectedOccupied.length === 0 &&
    data.rejectedOutOfGrid.length === 0 &&
    data.rejectedMalformed.length === 0 &&
    data.createdCodes.length > 0
  );
}

// Kalimat snackbar untuk cabang bersih.
//
// Kalimat keduanya ADA KARENA layar hasil dilompati. Di sana, blok created
// membawa keterangan bahwa varietas kosong bisa dilengkapi dari detail tiap
// pohon; itu satu-satunya informasi yang hilang saat cabang bersih memotong
// jalan, jadi ia dibawa serta ke sini dalam bentuk sependek mungkin.
//
// Jumlahnya dari created_codes, bukan created_tree_ids. Keduanya selalu
// sepanjang yang sama — 062 merakitnya dari SATU array_agg atas CTE new_trees
// yang sama dengan ORDER BY yang sama — tapi kode posisi adalah yang benar-benar
// dihitung pemilik saat menandai sel di peta.
function buildSuccessMessage(createdCount: number, variety: string): string {
  const base = `${createdCount} pohon dibuat`;

  return variety ? base : `${base}. Varietas bisa dilengkapi nanti.`;
}

// Kalimat konfirmasi. Menyebut jumlah, tanggal, dan varietas kalau diisi, lalu
// menutup dengan akibat yang tidak bisa ditarik kembali.
//
// Kalimat terakhirnya BUKAN basa-basi hukum: baris trees tidak bisa dihapus
// (prevent_tree_delete_trigger), dan kodenya tidak pernah dibebaskan oleh apa
// pun karena trees_unique_code_per_farm bukan constraint partial. Ini
// satu-satunya tempat pemilik diberi tahu itu sebelum keadaannya menjadi
// permanen.
function buildConfirmMessage({
  count,
  plantedAt,
  variety,
}: {
  count: number;
  plantedAt: string;
  variety: string;
}): string {
  const varietyPart = variety ? ` Varietas ${variety}.` : ' Varietas dikosongkan.';

  return (
    `${count} pohon akan dibuat dengan tanggal tanam ${formatFullDate(plantedAt)}.${varietyPart}` +
    ' Pohon yang sudah dibuat TIDAK BISA DIHAPUS, dan posisinya tidak bisa dipakai ulang.' +
    ' Periksa daftar posisinya sekali lagi sebelum melanjutkan.'
  );
}

// Sama persis dengan formatDateInput di farm-care-record-screen: tanggal hari
// ini dalam waktu perangkat, bentuk YYYY-MM-DD yang diterima DateField.
function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
