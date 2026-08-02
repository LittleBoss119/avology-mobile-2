import { router } from 'expo-router';

import { OperationalReportListScreen } from '../../../../src/components/operational-report-screen';

export default function OwnerReportsTabScreen() {
  return (
    <OperationalReportListScreen role="owner" onProfilePress={() => router.push('/owner/profile')} />
  );
}
