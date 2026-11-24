import { WorkIncoming } from '@/components/workflow/WorkIncoming';
import { FINAL_QC_FLOW } from '@/lib/workflow-views';

export default function Page() {
  return <WorkIncoming flow={FINAL_QC_FLOW} />;
}
