import { QcDecisionRecords } from '@/components/rework/QcDecisionRecords';
import { WASHING_QC_FLOW } from '@/lib/workflow-views';

// REJECT is routed when it is decided (no challan); this page shows where each decision is now.
export default function Page() {
  return <QcDecisionRecords flow={WASHING_QC_FLOW} kind="REJECT" />;
}
