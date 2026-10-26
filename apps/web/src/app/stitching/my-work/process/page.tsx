import { WorkProcess } from '@/components/workflow/WorkProcess';
import { STITCHING_FLOW } from '@/lib/workflow-views';

export default function Page() {
  return <WorkProcess flow={STITCHING_FLOW} />;
}
