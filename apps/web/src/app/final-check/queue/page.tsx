import { redirect } from 'next/navigation';

/** The inspection queue is now My Work > Final Inspection. */
export default function FinalQcQueuePage() {
  redirect('/final-check/my-work/inspection');
}
