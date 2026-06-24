import { useLocalSearchParams } from 'expo-router';

import { WorkerOperationalReportDetailScreen } from '../../../../src/components/operational-report-screen';

export default function WorkerOperationalReportDetailRoute() {
  const { reportId } = useLocalSearchParams<{ reportId: string }>();

  return <WorkerOperationalReportDetailScreen reportId={reportId} />;
}
