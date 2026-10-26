import { WorkReceived } from '@/components/workflow/WorkReceived';
import { FINAL_QC_FLOW } from '@/lib/workflow-views';

export default function Page() {
  return <WorkReceived flow={FINAL_QC_FLOW} only="defective" />;
}
