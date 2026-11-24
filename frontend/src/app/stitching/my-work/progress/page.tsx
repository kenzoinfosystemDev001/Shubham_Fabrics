import { WorkProgress } from '@/components/workflow/WorkProgress';
import { STITCHING_FLOW } from '@/lib/workflow-views';

export default function Page() {
  return <WorkProgress flow={STITCHING_FLOW} />;
}
