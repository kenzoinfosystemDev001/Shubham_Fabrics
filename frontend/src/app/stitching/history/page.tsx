import { WorkHistory } from '@/components/workflow/WorkHistory';
import { STITCHING_FLOW } from '@/lib/workflow-views';

export default function Page() {
  return <WorkHistory flow={STITCHING_FLOW} />;
}
