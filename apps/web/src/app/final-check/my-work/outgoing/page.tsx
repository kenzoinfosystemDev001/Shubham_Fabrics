import { WorkOutgoing } from '@/components/workflow/WorkOutgoing';
import { FINAL_QC_FLOW } from '@/lib/workflow-views';

export default function Page() {
  return <WorkOutgoing flow={FINAL_QC_FLOW} />;
}
