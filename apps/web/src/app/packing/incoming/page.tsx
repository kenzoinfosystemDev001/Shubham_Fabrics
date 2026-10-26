import { redirect } from 'next/navigation';

/** Incoming finished garments are received in Inventory. */
export default function Page() {
  redirect('/inventory/received');
}
