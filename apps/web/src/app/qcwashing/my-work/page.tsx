import { redirect } from 'next/navigation';

/** /qcwashing/my-work now has one page per task. */
export default function WashingQcMyWorkPage() {
  redirect('/qcwashing/my-work/incoming');
}
