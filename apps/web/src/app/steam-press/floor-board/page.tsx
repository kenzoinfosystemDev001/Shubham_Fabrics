import { WorkFloorBoard } from '@/components/workflow/WorkFloorBoard';
import { STEAM_PRESS_FLOW } from '@/lib/workflow-views';

export default function Page() {
  return <WorkFloorBoard flow={STEAM_PRESS_FLOW} />;
}
