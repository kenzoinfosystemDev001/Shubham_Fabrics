import { WorkIssueChallan } from '@/components/workflow/WorkIssueChallan';
import { STITCHING_FLOW } from '@/lib/workflow-views';

export default function Page() {
  return <WorkIssueChallan flow={STITCHING_FLOW} />;
}
