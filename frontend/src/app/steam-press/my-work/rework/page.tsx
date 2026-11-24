import { ReworkTasks } from '@/components/rework/ReworkTasks';

// QC REWORK routed here without a challan; forwarded on this department's Issue Challan once done.
export default function Page() {
  return <ReworkTasks department="STEAM_PRESS" workPath="/steam-press/my-work/process" forwardPath="/steam-press/my-work/issue-challan" />;
}
