import { WorkDashboard } from '@/components/workflow/WorkDashboard';
import { FINAL_QC_FLOW } from '@/lib/workflow-views';

export default function Page() {
  return <WorkDashboard flow={FINAL_QC_FLOW} />;
}
