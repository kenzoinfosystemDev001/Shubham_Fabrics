import { redirect } from 'next/navigation';

/** /washing/my-work now has one page per task. */
export default function WashingMyWorkPage() {
  redirect('/washing/my-work/incoming');
}
