import { WorkIssueChallan } from '@/components/workflow/WorkIssueChallan';
import { WASHING_QC_FLOW } from '@/lib/workflow-views';

export default function Page() {
  return <WorkIssueChallan flow={WASHING_QC_FLOW} />;
}
