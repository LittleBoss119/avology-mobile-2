import { AccessStatusScreen } from '../../src/components/access-status-screen';

export default function PendingApprovalScreen() {
  return (
    <AccessStatusScreen
      title="Menunggu Approval"
      subtitle="Pengajuan worker sudah terkirim. Owner perlu menyetujui sebelum akses operasional dibuka."
    />
  );
}
