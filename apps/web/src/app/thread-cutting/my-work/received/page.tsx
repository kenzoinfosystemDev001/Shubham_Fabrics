import { WorkReceived } from '@/components/workflow/WorkReceived';
import { THREAD_CUTTING_FLOW } from '@/lib/workflow-views';

export default function Page() {
  return <WorkReceived flow={THREAD_CUTTING_FLOW} />;
}
