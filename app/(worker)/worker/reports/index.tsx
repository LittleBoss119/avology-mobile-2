import { router } from 'expo-router';

import { WorkerOperationalReportListScreen } from '../../../../src/components/operational-report-screen';
import { MainTabHeader } from '../../../../src/components/ui';

export default function WorkerReportsTabScreen() {
  return (
    <WorkerOperationalReportListScreen
      showHeader={false}
      header={
        <MainTabHeader
          title="Laporan"
          onProfilePress={() => router.push('/worker/profile')}
        />
      }
    />
  );
}
