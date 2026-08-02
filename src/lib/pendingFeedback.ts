// Feedback antar-layar sekali-pakai (mis. konfirmasi simpan). Disimpan di
// modul-level, dibaca-sekaligus-dihapus supaya banner hanya muncul sekali dan
// back-stack tetap bersih — tanpa query param yang menumpuk instance rute.
let pending: string | null = null;

export function setPendingFeedback(key: string): void {
  pending = key;
}

export function consumePendingFeedback(): string | null {
  const value = pending;
  pending = null;
  return value;
}
