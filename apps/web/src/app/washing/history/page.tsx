import { WorkHistory } from '@/components/workflow/WorkHistory';
import { WASHING_FLOW } from '@/lib/workflow-views';

export default function Page() {
  return <WorkHistory flow={WASHING_FLOW} />;
}
