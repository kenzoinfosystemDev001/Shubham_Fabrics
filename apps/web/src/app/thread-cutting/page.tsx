import { WorkDashboard } from '@/components/workflow/WorkDashboard';
import { THREAD_CUTTING_FLOW } from '@/lib/workflow-views';

export default function Page() {
  return <WorkDashboard flow={THREAD_CUTTING_FLOW} />;
}
