import * as ImagePicker from 'expo-image-picker';

import { MAX_PHOTO_SIZE_BYTES } from '../services/photoAttachmentService';
import type { ServiceResult } from '../types/domain';
import type { MediaPermissionResult, PickedPhotoAsset } from '../types/media';
import { fail, ok } from '../utils/serviceResult';

const imagePickerOptions: ImagePicker.ImagePickerOptions = {
  allowsEditing: false,
  mediaTypes: ['images'],
  quality: 0.9,
};

export async function requestCameraPermission(): Promise<
  ServiceResult<MediaPermissionResult>
> {
  const result = await ImagePicker.requestCameraPermissionsAsync();

  if (!result.granted) {
    return ok({
      granted: false,
      message: 'Izin kamera diperlukan untuk mengambil foto.',
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
      message: 'Izin galeri diperlukan untuk memilih foto.',
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
    return fail(new Error(permissionResult.data.message ?? 'Izin galeri ditolak.'));
  }

  const result = await ImagePicker.launchImageLibraryAsync(imagePickerOptions);

  if (result.canceled) {
    return ok(null);
  }

  return validatePickedAsset(result.assets[0]);
}

export async function takePhotoFromCamera(): Promise<
  ServiceResult<PickedPhotoAsset | null>
> {
  const permissionResult = await requestCameraPermission();

  if (permissionResult.error) {
    return fail(permissionResult.error);
  }

  if (!permissionResult.data.granted) {
    return fail(new Error(permissionResult.data.message ?? 'Izin kamera ditolak.'));
  }

  const result = await ImagePicker.launchCameraAsync(imagePickerOptions);

  if (result.canceled) {
    return ok(null);
  }

  return validatePickedAsset(result.assets[0]);
}

function validatePickedAsset(
  asset: ImagePicker.ImagePickerAsset | undefined
): ServiceResult<PickedPhotoAsset> {
  if (!asset?.uri) {
    return fail(new Error('Foto tidak ditemukan.'));
  }

  if (asset.mimeType && !asset.mimeType.startsWith('image/')) {
    return fail(new Error('File yang dipilih harus berupa gambar.'));
  }

  if (asset.fileSize && asset.fileSize > MAX_PHOTO_SIZE_BYTES) {
    return fail(new Error('Ukuran foto maksimal 5MB.'));
  }

  return ok({
    fileName: asset.fileName ?? null,
    fileSize: asset.fileSize ?? null,
    height: asset.height ?? null,
    mimeType: asset.mimeType ?? null,
    uri: asset.uri,
    width: asset.width ?? null,
  });
}
