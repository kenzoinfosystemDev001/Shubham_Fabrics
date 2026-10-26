import { redirect } from 'next/navigation';

/** Quality reporting is now Inspection History. */
export default function FinalQcReportsPage() {
  redirect('/final-check/history');
}
