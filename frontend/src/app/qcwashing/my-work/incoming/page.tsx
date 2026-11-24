import { WorkIncoming } from '@/components/workflow/WorkIncoming';
import { WASHING_QC_FLOW } from '@/lib/workflow-views';

export default function Page() {
  return <WorkIncoming flow={WASHING_QC_FLOW} />;
}
