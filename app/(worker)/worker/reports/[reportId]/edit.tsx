import { useLocalSearchParams } from 'expo-router';

import { WorkerEditOperationalReportScreen } from '../../../../../src/components/operational-report-worker-screen';

export default function WorkerEditOperationalReportRoute() {
  const { reportId } = useLocalSearchParams<{ reportId: string }>();

  return <WorkerEditOperationalReportScreen reportId={reportId} />;
}
