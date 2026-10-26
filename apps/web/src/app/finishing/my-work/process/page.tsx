import { WorkProcess } from '@/components/workflow/WorkProcess';
import { FINISHING_FLOW } from '@/lib/workflow-views';

export default function Page() {
  return <WorkProcess flow={FINISHING_FLOW} />;
}
