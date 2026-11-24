import { WorkHistory } from '@/components/workflow/WorkHistory';
import { FINISHING_FLOW } from '@/lib/workflow-views';

export default function Page() {
  return <WorkHistory flow={FINISHING_FLOW} />;
}
