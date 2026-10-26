import { redirect } from 'next/navigation';

/** /recutting/my-work now has one page per task. */
export default function RecuttingMyWorkPage() {
  redirect('/recutting/my-work/incoming');
}
