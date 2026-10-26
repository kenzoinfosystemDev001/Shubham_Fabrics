import { WorkIssueChallan } from '@/components/workflow/WorkIssueChallan';
import { FINAL_QC_FLOW } from '@/lib/workflow-views';

export default function Page() {
  return <WorkIssueChallan flow={FINAL_QC_FLOW} kind="REWORK" />;
}
