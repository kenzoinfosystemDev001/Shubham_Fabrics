import { WorkReceived } from '@/components/workflow/WorkReceived';
import { STEAM_PRESS_FLOW } from '@/lib/workflow-views';

export default function Page() {
  return <WorkReceived flow={STEAM_PRESS_FLOW} />;
}
