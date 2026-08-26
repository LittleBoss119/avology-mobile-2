import { ImageManipulator, SaveFormat, type ImageRef } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { MAX_PHOTO_SIZE_BYTES } from '../services/photoAttachmentService';
import type { ServiceResult } from '../types/domain';
import type { MediaPermissionResult, PickedPhotoAsset } from '../types/media';
import { base64ByteLength } from '../utils/base64Size';
import { fail, ok } from '../utils/serviceResult';

// ---------------------------------------------------------------------------
// Sisi terpanjang hasil perkecilan, dalam piksel.
//
// JANGAN DITURUNKAN DEMI KECEPATAN.
//
// Angka ini bukan kompromi ukuran berkas, melainkan batas KEGUNAAN. Foto kondisi
// dipakai membaca bercak pada daun untuk mengenali hama dan gejala penyakit.
// Layar HP sasaran lebarnya sekitar 1080 px, jadi 1600 px menyisakan kira-kira
// 1,5x resolusi layar -- cukup untuk dicubit-zoom dan bercak kecil masih
// terbaca. Pada 1280 px bercak itu mulai lembek begitu di-zoom, dan foto yang
// tidak bisa dibaca tidak ada gunanya sekecil apa pun berkasnya.
// ---------------------------------------------------------------------------
const MAX_PHOTO_DIMENSION_PX = 1600;

// Jenjang kualitas JPEG, dicoba berurutan sampai hasilnya muat.
//
// Pada 1600 px langkah pertama hampir selalu menang; dua langkah sisanya adalah
// jaring pengaman untuk gambar ekstrem (panorama, gambar sangat berderau),
// bukan jalur normal. Tiga langkah cukup: kalau 0,45 pada 1600 px masih belum
// muat, masalahnya bukan kompresi.
const PHOTO_QUALITY_STEPS = [0.8, 0.6, 0.45] as const;

// Sasaran ukuran akhir: 80% dari batas Storage, yaitu 4 MiB.
//
// Batas 5 MiB ditegakkan di dua tempat sekaligus -- CHECK photo_attachments dan
// file_size_limit bucket -- dan penolakannya jatuh di UJUNG, setelah pengguna
// menunggu unggahan selesai. Satu putaran kompresi tambahan jauh lebih murah
// daripada satu unggahan yang ditolak server.
//
// Diturunkan dari MAX_PHOTO_SIZE_BYTES, bukan ditulis sebagai angka lepas,
// supaya marginnya tetap 20% kalau batas itu suatu saat bergeser.
const PHOTO_SIZE_TARGET_BYTES = Math.floor(MAX_PHOTO_SIZE_BYTES * 0.8);

// Ditampilkan seluruh layar selama gambar diperkecil. Satu sumber supaya kelima
// layar tidak lambat laun mengucapkan hal yang berbeda.
export const PHOTO_PROCESSING_MESSAGE = 'Foto sedang diperkecil, mohon tunggu.';

const imagePickerOptions: ImagePicker.ImagePickerOptions = {
  allowsEditing: false,
  // base64 SENGAJA TIDAK diminta dari picker.
  //
  // Dulu `base64: true` membuat picker membaca berkas ASLI (kerap 8-12 MB)
  // menjadi string base64 di memori JS sebelum satu baris kode kita jalan.
  // Sekarang base64 diambil dari hasil perkecilan lewat saveAsync(), yaitu dari
  // gambar yang sudah kecil -- lihat compressToUploadableJpeg() di bawah.
  mediaTypes: ['images'],
  quality: 0.9,
  shouldDownloadFromNetwork: true,
};

type CompressedImage = {
  base64: string;
  fileSize: number;
  height: number;
  uri: string;
  width: number;
};

export async function requestCameraPermission(): Promise<
  ServiceResult<MediaPermissionResult>
> {
  const result = await ImagePicker.requestCameraPermissionsAsync();

  if (!result.granted) {
    return ok({
      granted: false,
      message: 'Izin kamera belum diberikan.',
    });
  }

  return ok({
    granted: true,
    message: null,
  });
}

export async function requestMediaLibraryPermission(): Promise<
  ServiceResult<MediaPermissionResult>
> {
  const result = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!result.granted) {
    return ok({
      granted: false,
      message: 'Izin galeri belum diberikan.',
    });
  }

  return ok({
    granted: true,
    message: null,
  });
}

export async function pickImageFromGallery(): Promise<
  ServiceResult<PickedPhotoAsset | null>
> {
  const permissionResult = await requestMediaLibraryPermission();

  if (permissionResult.error) {
    return fail(permissionResult.error);
  }

  if (!permissionResult.data.granted) {
    return fail(new Error(permissionResult.data.message ?? 'Izin galeri belum diberikan.'));
  }

  const result = await ImagePicker.launchImageLibraryAsync(imagePickerOptions);

  if (result.canceled) {
    return ok(null);
  }

  return prepareUploadPhoto(result.assets[0], 'gallery');
}

export async function takePhotoFromCamera(): Promise<
  ServiceResult<PickedPhotoAsset | null>
> {
  const permissionResult = await requestCameraPermission();

  if (permissionResult.error) {
    return fail(permissionResult.error);
  }

  if (!permissionResult.data.granted) {
    return fail(new Error(permissionResult.data.message ?? 'Izin kamera belum diberikan.'));
  }

  const result = await ImagePicker.launchCameraAsync(imagePickerOptions);

  if (result.canceled) {
    return ok(null);
  }

  return prepareUploadPhoto(result.assets[0], 'camera');
}

// ---------------------------------------------------------------------------
// BAHAYA YANG WAJIB DIJAGA DI SINI
//
// `PickedPhotoAsset.uri` dan `PickedPhotoAsset.base64` HARUS selalu menunjuk
// bita yang SAMA.
//
// Jalur unggah (loadLocalImageFile di photoAttachmentService) mencoba base64
// LEBIH DULU dan hanya jatuh ke `uri` kalau base64 tidak ada. Jadi kalau `uri`
// diisi hasil perkecilan sementara `base64` masih memuat bita foto asli, yang
// terunggah adalah FOTO ASLI yang belum diperkecil -- tanpa galat, tanpa
// peringatan, tanpa gejala apa pun selain ukuran berkas di Storage.
//
// Karena itu kedua field di bawah diisi dari SATU pemanggilan saveAsync() yang
// sama. Jangan pernah menyalin `asset.base64` dari picker ke sini: nilai itu
// milik berkas asli, bukan berkas yang ditunjuk `uri`.
//
// Jalur unggah juga memasang pemeriksaan silang atas keduanya; lihat
// assertBase64MatchesLocalFile() di photoAttachmentService.
// ---------------------------------------------------------------------------
async function prepareUploadPhoto(
  asset: ImagePicker.ImagePickerAsset | undefined,
  source: 'camera' | 'gallery'
): Promise<ServiceResult<PickedPhotoAsset>> {
  if (!asset?.uri) {
    return fail(new Error('Foto tidak ditemukan.'));
  }

  // Penjagaan ini tetap di depan: kalau yang dipilih ternyata bukan gambar,
  // lebih baik ditolak sekarang daripada setelah manipulator gagal membacanya.
  if (!normalizePickedMimeType(asset).startsWith('image/')) {
    return fail(new Error('File yang dipilih harus berupa gambar.'));
  }

  // Lama perkecilan diukur di sini dan ikut tercatat di log pengembangan.
  // Angkanya yang menentukan apakah indikator saja cukup: kalau di HP paling
  // lambat ia tembus beberapa detik, indikator statis tidak lagi memadai.
  const startedAt = Date.now();
  const compressed = await compressToUploadableJpeg(asset.uri);
  const compressMs = Date.now() - startedAt;

  if (compressed instanceof Error) {
    return fail(compressed);
  }

  const pickedPhoto: PickedPhotoAsset = {
    assetId: asset.assetId ?? null,
    base64: compressed.base64,
    fileName: buildJpegFileName(asset.fileName),
    fileSize: compressed.fileSize,
    height: compressed.height,
    mimeType: 'image/jpeg',
    uri: compressed.uri,
    width: compressed.width,
  };

  logPickedPhotoDebug(source, pickedPhoto, compressMs);

  return ok(pickedPhoto);
}

// Perkecil, keluarkan sebagai JPEG, dan turunkan kualitas bertahap sampai muat.
//
// Keluaran JPEG sekaligus menormalkan HEIC dari kamera ke format yang pasti
// diterima bucket, jadi tahap ini dijalankan untuk SETIAP gambar -- termasuk
// gambar yang dimensinya sudah di bawah batas.
//
// Tidak ada pemotongan, pemutaran, atau penyuntingan apa pun di sini. Yang
// berubah hanya ukuran, kualitas, dan format.
async function compressToUploadableJpeg(localUri: string): Promise<CompressedImage | Error> {
  let sourceRef: ImageRef | null = null;
  let scaledRef: ImageRef | null = null;

  try {
    // Dimensi diambil dari gambar yang sudah didekode, BUKAN dari laporan
    // picker: `asset.width`/`asset.height` boleh null, dan tanpa keduanya tidak
    // ada cara tahu sisi mana yang terpanjang -- memperkecil sisi yang salah
    // menghasilkan gambar yang justru lebih besar dari yang diminta.
    //
    // `manipulate()` menerima ImageRef, jadi tahap perkecilan di bawah memakai
    // ulang gambar yang sudah didekode alih-alih membaca berkasnya sekali lagi.
    sourceRef = await ImageManipulator.manipulate(localUri).renderAsync();

    if (Math.max(sourceRef.width, sourceRef.height) > MAX_PHOTO_DIMENSION_PX) {
      // Satu sisi saja yang diberi nilai; sisi lainnya dihitung manipulator
      // dengan rasio asli dipertahankan.
      const targetSize = sourceRef.width >= sourceRef.height
        ? { width: MAX_PHOTO_DIMENSION_PX }
        : { height: MAX_PHOTO_DIMENSION_PX };

      scaledRef = await ImageManipulator.manipulate(sourceRef).resize(targetSize).renderAsync();
    }

    const renderedRef = scaledRef ?? sourceRef;

    // Perkecilan dilakukan SEKALI di atas. Jenjang di bawah hanya menyimpan
    // ulang gambar yang sama dengan kualitas berbeda, jadi percobaan kedua dan
    // ketiga tidak mendekode maupun menskala ulang apa pun.
    for (const quality of PHOTO_QUALITY_STEPS) {
      const saved = await renderedRef.saveAsync({
        base64: true,
        compress: quality,
        format: SaveFormat.JPEG,
      });

      if (!saved.base64) {
        return new Error('Foto gagal diproses. Coba ambil atau pilih foto lagi.');
      }

      const fileSize = base64ByteLength(saved.base64);

      if (fileSize <= PHOTO_SIZE_TARGET_BYTES) {
        return {
          base64: saved.base64,
          fileSize,
          height: saved.height,
          uri: saved.uri,
          width: saved.width,
        };
      }
    }

    // Seluruh jenjang habis. Sampai di sini artinya gambarnya benar-benar luar
    // biasa, jadi pesannya menyebut yang bisa dilakukan pengguna: foto dari
    // kamera aplikasi ini melewati jalur perkecilan yang sama tetapi berangkat
    // dari gambar yang jauh lebih jinak daripada berkas galeri sembarangan.
    return new Error(
      'Foto ini terlalu besar untuk diunggah. Coba ambil ulang lewat tombol kamera di aplikasi ini, atau pilih foto lain.'
    );
  } catch (error) {
    logPhotoCompressDebug(localUri, error);
    return new Error('Foto gagal diproses. Coba ambil atau pilih foto lagi.');
  } finally {
    // ImageRef memegang bitmap yang sudah didekode -- untuk foto 12 MP itu
    // puluhan MB memori native, dan HP sasaran tidak punya banyak. Nilai
    // kembaliannya sudah dihitung sebelum blok ini jalan, dan tidak ada yang
    // memakai kedua ref ini setelahnya (hasilnya cuma string dan angka biasa),
    // jadi melepaskannya di sini aman.
    releaseImageRef(scaledRef);
    releaseImageRef(sourceRef);
  }
}

// Pelepasan manual sifatnya optimasi memori. Kalau ia gagal, hasil yang sudah
// benar tidak boleh ikut gagal -- galat yang dilempar di dalam `finally` akan
// menimpa nilai kembalian fungsi pemanggilnya.
function releaseImageRef(ref: ImageRef | null): void {
  if (!ref) {
    return;
  }

  try {
    ref.release();
  } catch {
    // sengaja dibiarkan
  }
}

// Berkasnya sekarang selalu JPEG, jadi namanya harus ikut. Bukan kosmetik:
// resolveFileExtension() dan resolveLocalImageMimeType() di
// photoAttachmentService membaca ekstensi dari nama berkas LEBIH DULU sebelum
// melihat mime-nya, sehingga nama '.heic' yang tertinggal akan menamai objek
// Storage dengan ekstensi yang membantah isinya.
function buildJpegFileName(pickedFileName: string | null | undefined): string {
  const base = pickedFileName?.trim().replace(/\.[^.]+$/, '').trim();

  return base ? `${base}.jpg` : `foto-${Date.now()}.jpg`;
}

function logPickedPhotoDebug(
  source: 'camera' | 'gallery',
  photo: PickedPhotoAsset,
  compressMs: number
): void {
  if (typeof __DEV__ === 'undefined' || !__DEV__) {
    return;
  }

  const payload = {
    assetId: photo.assetId,
    base64Length: photo.base64?.length ?? null,
    compressMs,
    fileName: photo.fileName,
    fileSize: photo.fileSize,
    hasBase64: Boolean(photo.base64),
    height: photo.height,
    mimeType: photo.mimeType,
    source,
    uriPrefix: photo.uri.slice(0, 32),
    width: photo.width,
  };

  if (!photo.base64) {
    console.warn('[picked-photo-missing-base64]', payload);
    return;
  }

  console.debug('[picked-photo]', payload);
}

function logPhotoCompressDebug(localUri: string, error: unknown): void {
  if (typeof __DEV__ === 'undefined' || !__DEV__) {
    return;
  }

  console.warn('[photo-compress-failed]', {
    message: error instanceof Error ? error.message : String(error),
    uriPrefix: localUri.slice(0, 32),
  });
}

function normalizePickedMimeType(asset: ImagePicker.ImagePickerAsset): string {
  const normalizedMimeType = asset.mimeType?.trim().toLowerCase();

  if (normalizedMimeType) {
    return normalizedMimeType;
  }

  const extension = asset.fileName?.split('.').pop()?.toLowerCase()
    ?? asset.uri.split('?')[0]?.split('.').pop()?.toLowerCase();

  if (extension === 'png') {
    return 'image/png';
  }

  if (extension === 'webp') {
    return 'image/webp';
  }

  if (extension === 'heic') {
    return 'image/heic';
  }

  if (extension === 'heif') {
    return 'image/heif';
  }

  return 'image/jpeg';
}
