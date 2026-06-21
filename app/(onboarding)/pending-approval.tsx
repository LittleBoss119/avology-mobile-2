import { AccessStatusScreen } from '../../src/components/access-status-screen';

export default function PendingApprovalScreen() {
  return (
    <AccessStatusScreen
      title="Menunggu Persetujuan"
      subtitle="Pengajuan pekerja sudah terkirim. Pemilik perlu menyetujui sebelum akses operasional dibuka."
    />
  );
}
