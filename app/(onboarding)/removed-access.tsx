import { AccessStatusScreen } from '../../src/components/access-status-screen';

export default function RemovedAccessScreen() {
  return (
    <AccessStatusScreen
      title="Akses Dinonaktifkan"
      subtitle="Akses pekerja sudah dinonaktifkan. Data operasional kebun tetap tidak dapat diakses."
    />
  );
}
