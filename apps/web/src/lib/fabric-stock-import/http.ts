import { NextResponse } from 'next/server';
import { requireDepartment } from '@/lib/auth/department-access';
import type { AuthenticatedUser } from '@/lib/auth/require-user';
import { StockImportError } from './service';

/**
 * Runs a stock-import route for a signed-in Fabric Store user (administrators always pass) and
 * turns StockImportError into a JSON error with its status.
 */
export async function withStoreUser(
  request: Request,
  handler: (user: AuthenticatedUser) => Promise<Response>,
): Promise<Response> {
  const { user, response } = await requireDepartment(request, 'STORE');
  if (!user) return response;
  try {
    return await handler(user);
  } catch (error: any) {
    if (error instanceof StockImportError) {
      return NextResponse.json({ error: error.message, code: error.code, details: error.details ?? null }, { status: error.status });
    }
    if (error?.code === 'INVALID_TRANSITION') {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 409 });
    }
    console.error('Fabric stock import error:', error);
    return NextResponse.json({ error: 'The import could not be processed. Nothing was posted to stock.', code: 'SERVER_ERROR' }, { status: 500 });
  }
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  } catch {
    throw new StockImportError('The request body must be JSON.', 400, 'BAD_JSON');
  }
}

/** Attachment response; the name is ASCII-only so it cannot break the header. */
export function fileResponse(data: Buffer | Uint8Array, contentType: string, fileName: string) {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return new Response(new Uint8Array(data), {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
