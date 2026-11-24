import { WorkProcess } from '@/components/workflow/WorkProcess';
import { THREAD_CUTTING_FLOW } from '@/lib/workflow-views';

export default function Page() {
  return <WorkProcess flow={THREAD_CUTTING_FLOW} />;
}
