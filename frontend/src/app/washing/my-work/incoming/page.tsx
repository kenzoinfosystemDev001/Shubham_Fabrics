import { WorkIncoming } from '@/components/workflow/WorkIncoming';
import { WASHING_FLOW } from '@/lib/workflow-views';

export default function Page() {
  return <WorkIncoming flow={WASHING_FLOW} />;
}
