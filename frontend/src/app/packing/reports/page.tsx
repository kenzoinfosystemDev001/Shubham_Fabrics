import { redirect } from 'next/navigation';

/** Packing reports are Inventory > Transaction History. */
export default function Page() {
  redirect('/inventory/transactions');
}
