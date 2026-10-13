import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Shubham Fabrics India Pvt. Ltd. | MES Enterprise',
  description: 'Enterprise Manufacturing Execution System - Portal Login',
};

export default function RootHomePage() {
  redirect('/login');
}