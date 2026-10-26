import { WorkIssueChallan } from '@/components/workflow/WorkIssueChallan';
import { THREAD_CUTTING_FLOW } from '@/lib/workflow-views';

export default function Page() {
  return <WorkIssueChallan flow={THREAD_CUTTING_FLOW} />;
}
