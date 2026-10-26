import { redirect } from 'next/navigation';

/** /thread-cutting/my-work now has one page per task. */
export default function ThreadCuttingMyWorkPage() {
  redirect('/thread-cutting/my-work/incoming');
}
