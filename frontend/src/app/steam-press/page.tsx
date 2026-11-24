import { WorkDashboard } from '@/components/workflow/WorkDashboard';
import { STEAM_PRESS_FLOW } from '@/lib/workflow-views';

export default function Page() {
  return <WorkDashboard flow={STEAM_PRESS_FLOW} />;
}
