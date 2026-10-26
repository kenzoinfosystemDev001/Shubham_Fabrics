import { WorkFloorBoard } from '@/components/workflow/WorkFloorBoard';
import { STITCHING_FLOW } from '@/lib/workflow-views';

export default function Page() {
  return <WorkFloorBoard flow={STITCHING_FLOW} />;
}
