import { useLocalSearchParams } from 'expo-router';

import { OwnerOperationalReportDetailScreen } from '../../../../src/components/operational-report-owner-screen';

export default function OwnerOperationalReportDetailRoute() {
  const { reportId } = useLocalSearchParams<{ reportId: string }>();

  return <OwnerOperationalReportDetailScreen reportId={reportId} />;
}
