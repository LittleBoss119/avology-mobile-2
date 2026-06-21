import { AccessStatusScreen } from '../../src/components/access-status-screen';

export default function RejectedScreen() {
  return (
    <AccessStatusScreen
      title="Akses Ditolak"
      subtitle="Pengajuan pekerja ditolak oleh pemilik. Akun ini tidak dapat mengakses data kebun."
    />
  );
}
