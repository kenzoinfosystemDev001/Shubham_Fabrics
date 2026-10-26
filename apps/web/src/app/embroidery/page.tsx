import { WorkDashboard } from '@/components/workflow/WorkDashboard';
import { EMBROIDERY_FLOW } from '@/lib/workflow-views';

export default function Page() {
  return <WorkDashboard flow={EMBROIDERY_FLOW} />;
}
