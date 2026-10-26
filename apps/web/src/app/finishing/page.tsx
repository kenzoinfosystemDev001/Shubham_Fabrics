import { WorkDashboard } from '@/components/workflow/WorkDashboard';
import { FINISHING_FLOW } from '@/lib/workflow-views';

export default function Page() {
  return <WorkDashboard flow={FINISHING_FLOW} />;
}
