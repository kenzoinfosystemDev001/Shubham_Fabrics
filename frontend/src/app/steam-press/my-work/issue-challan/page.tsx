import { WorkIssueChallan } from '@/components/workflow/WorkIssueChallan';
import { STEAM_PRESS_FLOW } from '@/lib/workflow-views';

export default function Page() {
  return <WorkIssueChallan flow={STEAM_PRESS_FLOW} />;
}
