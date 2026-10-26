import { WorkReceived } from '@/components/workflow/WorkReceived';
import { THREADCUT_QC_FLOW } from '@/lib/workflow-views';

export default function Page() {
  return <WorkReceived flow={THREADCUT_QC_FLOW} />;
}
