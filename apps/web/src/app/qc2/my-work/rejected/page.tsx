import { WorkIssueChallan } from '@/components/workflow/WorkIssueChallan';
import { THREADCUT_QC_FLOW } from '@/lib/workflow-views';

export default function Page() {
  return <WorkIssueChallan flow={THREADCUT_QC_FLOW} kind="REJECT" />;
}
