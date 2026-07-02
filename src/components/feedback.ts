import { Alert } from 'react-native';

export type ConfirmDialogOptions = {
  cancelLabel?: string;
  confirmLabel?: string;
  danger?: boolean;
  message?: string;
  onConfirm: () => void;
  title: string;
};

export function showSuccessToast(message: string) {
  Alert.alert('Berhasil', message);
}

export function showErrorToast(message: string) {
  Alert.alert('Ups', message);
}

export function showInfoToast(message: string) {
  Alert.alert('Info', message);
}

export function showConfirmDialog({
  cancelLabel = 'Batal',
  confirmLabel = 'Ya',
  danger = false,
  message,
  onConfirm,
  title,
}: ConfirmDialogOptions) {
  Alert.alert(title, message, [
    { style: 'cancel', text: cancelLabel },
    {
      onPress: onConfirm,
      style: danger ? 'destructive' : 'default',
      text: confirmLabel,
    },
  ]);
}
