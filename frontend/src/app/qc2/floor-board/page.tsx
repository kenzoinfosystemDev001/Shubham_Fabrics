import { WorkFloorBoard } from '@/components/workflow/WorkFloorBoard';
import { THREADCUT_QC_FLOW } from '@/lib/workflow-views';

export default function Page() {
  return <WorkFloorBoard flow={THREADCUT_QC_FLOW} />;
}
