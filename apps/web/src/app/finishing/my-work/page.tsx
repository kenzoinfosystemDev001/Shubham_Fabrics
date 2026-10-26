import { redirect } from 'next/navigation';

/** /finishing/my-work now has one page per task. */
export default function FinishingMyWorkPage() {
  redirect('/finishing/my-work/incoming');
}
