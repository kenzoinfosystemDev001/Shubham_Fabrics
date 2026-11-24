import { WorkIncoming } from '@/components/workflow/WorkIncoming';
import { THREAD_CUTTING_FLOW } from '@/lib/workflow-views';

export default function Page() {
  return <WorkIncoming flow={THREAD_CUTTING_FLOW} />;
}
