import { WorkIssueChallan } from '@/components/workflow/WorkIssueChallan';
import { EMBROIDERY_FLOW } from '@/lib/workflow-views';

export default function Page() {
  return <WorkIssueChallan flow={EMBROIDERY_FLOW} />;
}
