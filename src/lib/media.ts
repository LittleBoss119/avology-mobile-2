import * as ImagePicker from 'expo-image-picker';

import { MAX_PHOTO_SIZE_BYTES } from '../services/photoAttachmentService';
import type { ServiceResult } from '../types/domain';
import type { MediaPermissionResult, PickedPhotoAsset } from '../types/media';
import { fail, ok } from '../utils/serviceResult';

const imagePickerOptions: ImagePicker.ImagePickerOptions = {
  allowsEditing: false,
  base64: true,
  mediaTypes: ['images'],
  quality: 0.9,
  shouldDownloadFromNetwork: true,
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

  return validatePickedAsset(result.assets[0], 'gallery');
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

  return validatePickedAsset(result.assets[0], 'camera');
}

function validatePickedAsset(
  asset: ImagePicker.ImagePickerAsset | undefined,
  source: 'camera' | 'gallery'
): ServiceResult<PickedPhotoAsset> {
  if (!asset?.uri) {
    return fail(new Error('Foto tidak ditemukan.'));
  }

  const mimeType = normalizePickedMimeType(asset);

  if (!mimeType.startsWith('image/')) {
    return fail(new Error('File yang dipilih harus berupa gambar.'));
  }

  if (asset.fileSize && asset.fileSize > MAX_PHOTO_SIZE_BYTES) {
    return fail(new Error('Ukuran foto terlalu besar.'));
  }

  const pickedPhoto: PickedPhotoAsset = {
    assetId: asset.assetId ?? null,
    base64: asset.base64 ?? null,
    fileName: asset.fileName ?? null,
    fileSize: asset.fileSize ?? null,
    height: asset.height ?? null,
    mimeType,
    uri: asset.uri,
    width: asset.width ?? null,
  };

  logPickedPhotoDebug(source, pickedPhoto);

  return ok(pickedPhoto);
}

function logPickedPhotoDebug(source: 'camera' | 'gallery', photo: PickedPhotoAsset): void {
  if (typeof __DEV__ === 'undefined' || !__DEV__) {
    return;
  }

  const payload = {
    assetId: photo.assetId,
    base64Length: photo.base64?.length ?? null,
    fileName: photo.fileName,
    fileSize: photo.fileSize,
    hasBase64: Boolean(photo.base64),
    mimeType: photo.mimeType,
    source,
    uriPrefix: photo.uri.slice(0, 32),
  };

  if (!photo.base64) {
    console.warn('[picked-photo-missing-base64]', payload);
    return;
  }

  console.debug('[picked-photo]', payload);
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
