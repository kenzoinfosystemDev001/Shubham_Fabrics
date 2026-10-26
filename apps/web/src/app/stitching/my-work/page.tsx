import { redirect } from 'next/navigation';

/** /stitching/my-work now has one page per task. */
export default function StitchingMyWorkPage() {
  redirect('/stitching/my-work/incoming');
}
