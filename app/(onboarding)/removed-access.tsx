import { AccessStatusScreen } from '../../src/components/access-status-screen';

export default function RemovedAccessScreen() {
  return (
    <AccessStatusScreen
      title="Akses Dinonaktifkan"
      subtitle="Membership worker sudah dinonaktifkan. Data operasional kebun tetap tidak dapat diakses."
    />
  );
}
