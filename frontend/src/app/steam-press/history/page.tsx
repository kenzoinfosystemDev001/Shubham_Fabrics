import { WorkHistory } from '@/components/workflow/WorkHistory';
import { STEAM_PRESS_FLOW } from '@/lib/workflow-views';

export default function Page() {
  return <WorkHistory flow={STEAM_PRESS_FLOW} />;
}
