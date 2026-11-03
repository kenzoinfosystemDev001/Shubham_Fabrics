import { ReworkTasks } from '@/components/rework/ReworkTasks';

// QC REWORK routed here without a challan; forwarded on this department's Issue Challan once done.
export default function Page() {
  return <ReworkTasks department="WASHING" workPath="/washing/my-work/process" forwardPath="/washing/my-work/issue-challan" />;
}
