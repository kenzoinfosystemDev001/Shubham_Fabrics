import { WorkPassed } from '@/components/workflow/WorkPassed';
import { FINAL_QC_FLOW } from '@/lib/workflow-views';

export default function Page() {
  return <WorkPassed flow={FINAL_QC_FLOW} />;
}
