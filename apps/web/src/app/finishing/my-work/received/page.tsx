import { WorkReceived } from '@/components/workflow/WorkReceived';
import { FINISHING_FLOW } from '@/lib/workflow-views';

export default function Page() {
  return <WorkReceived flow={FINISHING_FLOW} />;
}
