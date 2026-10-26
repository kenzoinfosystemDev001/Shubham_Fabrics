import { WorkFloorBoard } from '@/components/workflow/WorkFloorBoard';
import { RECUTTING_FLOW } from '@/lib/workflow-views';

export default function Page() {
  return <WorkFloorBoard flow={RECUTTING_FLOW} />;
}
