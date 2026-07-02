import { AccessStatusScreen } from '../../src/components/access-status-screen';

export default function PendingApprovalScreen() {
  return (
    <AccessStatusScreen
      title="Menunggu Persetujuan"
      subtitle="Pengajuan sudah terkirim. Tunggu persetujuan pemilik kebun."
    />
  );
}
