import { ReworkTasks } from '@/components/rework/ReworkTasks';

// QC REWORK routed here without a challan; forwarded on this department's Issue Challan once done.
export default function Page() {
  return <ReworkTasks department="THREAD_CUTTING" workPath="/thread-cutting/my-work/process" forwardPath="/thread-cutting/my-work/issue-challan" />;
}
