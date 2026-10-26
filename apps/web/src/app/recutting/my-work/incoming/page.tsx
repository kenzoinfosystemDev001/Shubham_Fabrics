import { WorkIncoming } from '@/components/workflow/WorkIncoming';
import { RECUTTING_FLOW } from '@/lib/workflow-views';

export default function Page() {
  return <WorkIncoming flow={RECUTTING_FLOW} />;
}
