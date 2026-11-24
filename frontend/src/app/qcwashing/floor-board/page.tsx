import { WorkFloorBoard } from '@/components/workflow/WorkFloorBoard';
import { WASHING_QC_FLOW } from '@/lib/workflow-views';

export default function Page() {
  return <WorkFloorBoard flow={WASHING_QC_FLOW} />;
}
