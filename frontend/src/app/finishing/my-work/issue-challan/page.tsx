import { WorkIssueChallan } from '@/components/workflow/WorkIssueChallan';
import { FINISHING_FLOW } from '@/lib/workflow-views';

export default function Page() {
  return <WorkIssueChallan flow={FINISHING_FLOW} />;
}
