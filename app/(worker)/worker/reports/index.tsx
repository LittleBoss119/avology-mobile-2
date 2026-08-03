import { router } from 'expo-router';

import { OperationalReportListScreen } from '../../../../src/components/operational-report-list-screen';

export default function WorkerReportsTabScreen() {
  return (
    <OperationalReportListScreen role="worker" onProfilePress={() => router.push('/worker/profile')} />
  );
}
