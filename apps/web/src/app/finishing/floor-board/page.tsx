import { WorkFloorBoard } from '@/components/workflow/WorkFloorBoard';
import { FINISHING_FLOW } from '@/lib/workflow-views';

export default function Page() {
  return <WorkFloorBoard flow={FINISHING_FLOW} />;
}
