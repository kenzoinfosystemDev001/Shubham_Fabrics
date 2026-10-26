import { WorkHistory } from '@/components/workflow/WorkHistory';
import { THREADCUT_QC_FLOW } from '@/lib/workflow-views';

export default function Page() {
  return <WorkHistory flow={THREADCUT_QC_FLOW} />;
}
