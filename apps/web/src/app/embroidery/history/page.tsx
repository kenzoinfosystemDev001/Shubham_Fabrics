import { WorkHistory } from '@/components/workflow/WorkHistory';
import { EMBROIDERY_FLOW } from '@/lib/workflow-views';

export default function Page() {
  return <WorkHistory flow={EMBROIDERY_FLOW} />;
}
