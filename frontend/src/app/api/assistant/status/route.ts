import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import { loadAssistantConfig } from '@/lib/assistant/config';
import { MES_DEPARTMENTS } from '@/lib/departments';

export const dynamic = 'force-dynamic';

/**
 * Status for the assistant launcher: whether the feature is enabled, and the signed-in user's
 * department for display. Makes no AI-provider call and reads nothing beyond the user record.
 *
 * The department comes from the user's stored department code, not from the request. Access to
 * the assistant itself is not granted here: this route only reports status.
 */
export async function GET(request: Request) {
  const { user, response } = await requireUser(request);
  if (!user) return response;

  const department = MES_DEPARTMENTS.find((d) => d.code === user.departmentCode) ?? null;

  return NextResponse.json(
    {
      // Enabled only when the flag is on AND the provider configuration is valid (fail closed).
      enabled: loadAssistantConfig().ok,
      department: user.departmentCode
        ? { code: user.departmentCode, name: department?.name ?? user.departmentCode }
        : null,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
