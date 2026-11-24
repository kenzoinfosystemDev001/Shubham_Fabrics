import { WorkInspection } from '@/components/workflow/WorkInspection';
import { THREADCUT_QC_FLOW } from '@/lib/workflow-views';

export default function Page() {
  return <WorkInspection flow={THREADCUT_QC_FLOW} />;
}
