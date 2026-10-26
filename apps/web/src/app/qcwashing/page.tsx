import { WorkDashboard } from '@/components/workflow/WorkDashboard';
import { WASHING_QC_FLOW } from '@/lib/workflow-views';

export default function Page() {
  return <WorkDashboard flow={WASHING_QC_FLOW} />;
}
