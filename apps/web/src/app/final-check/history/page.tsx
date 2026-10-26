import { WorkHistory } from '@/components/workflow/WorkHistory';
import { FINAL_QC_FLOW } from '@/lib/workflow-views';

export default function Page() {
  return <WorkHistory flow={FINAL_QC_FLOW} />;
}
