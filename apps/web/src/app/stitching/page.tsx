import { WorkDashboard } from '@/components/workflow/WorkDashboard';
import { STITCHING_FLOW } from '@/lib/workflow-views';

export default function Page() {
  return <WorkDashboard flow={STITCHING_FLOW} />;
}
