import { redirect } from 'next/navigation';

/** /final-check/my-work now has one page per task. */
export default function FinalQcMyWorkPage() {
  redirect('/final-check/my-work/incoming');
}
