import { WorkIssueChallan } from '@/components/workflow/WorkIssueChallan';
import { WASHING_FLOW } from '@/lib/workflow-views';

export default function Page() {
  return <WorkIssueChallan flow={WASHING_FLOW} />;
}
