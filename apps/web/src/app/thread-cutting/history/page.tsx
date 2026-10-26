import { WorkHistory } from '@/components/workflow/WorkHistory';
import { THREAD_CUTTING_FLOW } from '@/lib/workflow-views';

export default function Page() {
  return <WorkHistory flow={THREAD_CUTTING_FLOW} />;
}
