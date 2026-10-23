import { NextResponse } from 'next/server';
import { clearSessionCookies } from '@/lib/auth/require-user';

export const dynamic = 'force-dynamic';

export async function POST() {
  const response = NextResponse.json({ success: true });
  clearSessionCookies(response);
  return response;
}
