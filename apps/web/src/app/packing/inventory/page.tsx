import { redirect } from 'next/navigation';

/** Finished garment stock is in Inventory. */
export default function Page() {
  redirect('/inventory/stock');
}
