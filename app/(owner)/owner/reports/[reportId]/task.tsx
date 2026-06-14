import { useLocalSearchParams } from 'expo-router';

import { OwnerCreateTaskFromOperationalReportScreen } from '../../../../../src/components/operational-report-screen';

export default function OwnerCreateTaskFromOperationalReportRoute() {
  const { reportId } = useLocalSearchParams<{ reportId: string }>();

  return <OwnerCreateTaskFromOperationalReportScreen reportId={reportId} />;
}
