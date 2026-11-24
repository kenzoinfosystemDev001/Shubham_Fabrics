import { WorkFloorBoard } from '@/components/workflow/WorkFloorBoard';
import { EMBROIDERY_FLOW } from '@/lib/workflow-views';

export default function Page() {
  return <WorkFloorBoard flow={EMBROIDERY_FLOW} />;
}
