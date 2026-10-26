import { WorkFloorBoard } from '@/components/workflow/WorkFloorBoard';
import { WASHING_FLOW } from '@/lib/workflow-views';

export default function Page() {
  return <WorkFloorBoard flow={WASHING_FLOW} />;
}
