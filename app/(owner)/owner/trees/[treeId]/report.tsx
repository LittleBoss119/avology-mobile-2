import { useLocalSearchParams } from 'expo-router';

import { TreeConditionReportScreen } from '../../../../../src/components/tree-condition-report-screen';

export default function OwnerCreateConditionReportScreen() {
  const { treeId } = useLocalSearchParams<{ treeId: string }>();

  return <TreeConditionReportScreen basePath="/owner/trees" treeId={treeId} />;
}
