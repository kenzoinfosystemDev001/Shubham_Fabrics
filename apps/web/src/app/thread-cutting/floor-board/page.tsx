import { WorkFloorBoard } from '@/components/workflow/WorkFloorBoard';
import { THREAD_CUTTING_FLOW } from '@/lib/workflow-views';

export default function Page() {
  return <WorkFloorBoard flow={THREAD_CUTTING_FLOW} />;
}
