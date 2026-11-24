import { WorkOutgoing } from '@/components/workflow/WorkOutgoing';
import { STEAM_PRESS_FLOW } from '@/lib/workflow-views';

export default function Page() {
  return <WorkOutgoing flow={STEAM_PRESS_FLOW} />;
}
