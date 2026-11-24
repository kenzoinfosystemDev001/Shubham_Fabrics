import { WorkProcess } from '@/components/workflow/WorkProcess';
import { WASHING_FLOW } from '@/lib/workflow-views';

export default function Page() {
  return <WorkProcess flow={WASHING_FLOW} />;
}
