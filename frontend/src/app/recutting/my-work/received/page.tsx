import { WorkReceived } from '@/components/workflow/WorkReceived';
import { RECUTTING_FLOW } from '@/lib/workflow-views';

export default function Page() {
  return <WorkReceived flow={RECUTTING_FLOW} />;
}
