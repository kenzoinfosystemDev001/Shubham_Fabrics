import { WorkIncoming } from '@/components/workflow/WorkIncoming';
import { EMBROIDERY_FLOW } from '@/lib/workflow-views';

export default function Page() {
  return <WorkIncoming flow={EMBROIDERY_FLOW} />;
}
