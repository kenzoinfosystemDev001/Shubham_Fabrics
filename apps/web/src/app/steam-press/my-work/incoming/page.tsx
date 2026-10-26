import { WorkIncoming } from '@/components/workflow/WorkIncoming';
import { STEAM_PRESS_FLOW } from '@/lib/workflow-views';

export default function Page() {
  return <WorkIncoming flow={STEAM_PRESS_FLOW} />;
}
