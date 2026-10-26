import { WorkDashboard } from '@/components/workflow/WorkDashboard';
import { THREADCUT_QC_FLOW } from '@/lib/workflow-views';

export default function Page() {
  return <WorkDashboard flow={THREADCUT_QC_FLOW} />;
}
