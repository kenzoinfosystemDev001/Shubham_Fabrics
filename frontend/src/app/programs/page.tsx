'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ProgramsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/production-history');
  }, [router]);
  return null;
}
