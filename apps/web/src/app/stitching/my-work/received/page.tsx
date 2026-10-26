import { WorkReceived } from '@/components/workflow/WorkReceived';
import { STITCHING_FLOW } from '@/lib/workflow-views';

export default function Page() {
  return <WorkReceived flow={STITCHING_FLOW} />;
}
