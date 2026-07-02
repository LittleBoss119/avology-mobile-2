import { router } from 'expo-router';

import { OwnerOperationalReportListScreen } from '../../../../src/components/operational-report-screen';
import { MainTabHeader } from '../../../../src/components/ui';

export default function OwnerReportsTabScreen() {
  return (
    <OwnerOperationalReportListScreen
      showHeader={false}
      header={
        <MainTabHeader
          title="Laporan"
          onProfilePress={() => router.push('/owner/profile')}
        />
      }
    />
  );
}
