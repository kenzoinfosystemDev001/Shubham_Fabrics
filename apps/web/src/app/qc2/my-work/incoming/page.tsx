import { WorkIncoming } from '@/components/workflow/WorkIncoming';
import { THREADCUT_QC_FLOW } from '@/lib/workflow-views';

export default function Page() {
  return <WorkIncoming flow={THREADCUT_QC_FLOW} />;
}
