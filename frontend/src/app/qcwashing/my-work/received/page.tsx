import { WorkReceived } from '@/components/workflow/WorkReceived';
import { WASHING_QC_FLOW } from '@/lib/workflow-views';

export default function Page() {
  return <WorkReceived flow={WASHING_QC_FLOW} />;
}
