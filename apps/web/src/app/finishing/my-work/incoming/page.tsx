import { WorkIncoming } from '@/components/workflow/WorkIncoming';
import { FINISHING_FLOW } from '@/lib/workflow-views';

export default function Page() {
  return <WorkIncoming flow={FINISHING_FLOW} />;
}
