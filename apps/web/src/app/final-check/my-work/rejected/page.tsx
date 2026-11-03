import { QcDecisionRecords } from '@/components/rework/QcDecisionRecords';
import { FINAL_QC_FLOW } from '@/lib/workflow-views';

// REJECT is routed when it is decided (no challan); this page shows where each decision is now.
export default function Page() {
  return <QcDecisionRecords flow={FINAL_QC_FLOW} kind="REJECT" />;
}
