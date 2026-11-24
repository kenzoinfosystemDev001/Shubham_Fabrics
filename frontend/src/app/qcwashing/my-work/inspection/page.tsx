import { WorkInspection } from '@/components/workflow/WorkInspection';
import { WASHING_QC_FLOW } from '@/lib/workflow-views';

export default function Page() {
  return <WorkInspection flow={WASHING_QC_FLOW} />;
}
