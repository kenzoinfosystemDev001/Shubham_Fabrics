'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ChallansRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/my-work/issue-challan');
  }, [router]);
  return null;
}
