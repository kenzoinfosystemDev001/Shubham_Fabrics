import { WorkIncoming } from '@/components/workflow/WorkIncoming';
import { STITCHING_FLOW } from '@/lib/workflow-views';

export default function Page() {
  return <WorkIncoming flow={STITCHING_FLOW} />;
}
