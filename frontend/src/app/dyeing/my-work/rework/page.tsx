import { ReworkTasks } from '@/components/rework/ReworkTasks';

// Dyeing QC REWORK routed here without a challan; re-dyed and sent back to Dyeing QC on Issue Challan.
export default function Page() {
  return <ReworkTasks department="DYEING" title="Rework from Dyeing QC" workPath="/dyeing/my-work/process" forwardPath="/dyeing/my-work/issue-challan" />;
}
