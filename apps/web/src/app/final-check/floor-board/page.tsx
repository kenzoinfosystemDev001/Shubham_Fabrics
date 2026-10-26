import { WorkFloorBoard } from '@/components/workflow/WorkFloorBoard';
import { FINAL_QC_FLOW } from '@/lib/workflow-views';

export default function Page() {
  return <WorkFloorBoard flow={FINAL_QC_FLOW} />;
}
