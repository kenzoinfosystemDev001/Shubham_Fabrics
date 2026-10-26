import { WorkProcess } from '@/components/workflow/WorkProcess';
import { STEAM_PRESS_FLOW } from '@/lib/workflow-views';

export default function Page() {
  return <WorkProcess flow={STEAM_PRESS_FLOW} />;
}
