import { WorkProcess } from '@/components/workflow/WorkProcess';
import { EMBROIDERY_FLOW } from '@/lib/workflow-views';

export default function Page() {
  return <WorkProcess flow={EMBROIDERY_FLOW} />;
}
