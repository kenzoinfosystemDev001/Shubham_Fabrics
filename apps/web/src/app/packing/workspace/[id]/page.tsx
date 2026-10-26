import { redirect } from 'next/navigation';

/** Packing work is Inventory > Packing Management. */
export default function Page() {
  redirect('/inventory/packing');
}
