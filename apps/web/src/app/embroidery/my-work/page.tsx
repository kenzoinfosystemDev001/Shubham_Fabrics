import { redirect } from 'next/navigation';

/** /embroidery/my-work now has one page per task. */
export default function EmbroideryMyWorkPage() {
  redirect('/embroidery/my-work/incoming');
}
