import { WorkReceived } from '@/components/workflow/WorkReceived';
import { EMBROIDERY_FLOW } from '@/lib/workflow-views';

export default function Page() {
  return <WorkReceived flow={EMBROIDERY_FLOW} />;
}
