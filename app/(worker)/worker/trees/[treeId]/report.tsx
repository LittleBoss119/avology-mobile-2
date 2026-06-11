import { useLocalSearchParams } from 'expo-router';

import { TreeConditionReportScreen } from '../../../../../src/components/tree-condition-report-screen';

export default function WorkerCreateConditionReportScreen() {
  const { treeId } = useLocalSearchParams<{ treeId: string }>();

  return <TreeConditionReportScreen basePath="/worker/trees" treeId={treeId} />;
}
