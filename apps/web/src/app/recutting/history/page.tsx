import { WorkHistory } from '@/components/workflow/WorkHistory';
import { RECUTTING_FLOW } from '@/lib/workflow-views';

export default function Page() {
  return <WorkHistory flow={RECUTTING_FLOW} />;
}
