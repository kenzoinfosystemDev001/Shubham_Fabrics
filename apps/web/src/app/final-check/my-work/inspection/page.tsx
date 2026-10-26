import { WorkInspection } from '@/components/workflow/WorkInspection';
import { FINAL_QC_FLOW } from '@/lib/workflow-views';

export default function Page() {
  return <WorkInspection flow={FINAL_QC_FLOW} />;
}
