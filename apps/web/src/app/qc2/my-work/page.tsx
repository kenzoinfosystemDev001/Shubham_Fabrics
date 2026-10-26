import { redirect } from 'next/navigation';

/** /qc2/my-work now has one page per task. */
export default function ThreadcutQcMyWorkPage() {
  redirect('/qc2/my-work/incoming');
}
