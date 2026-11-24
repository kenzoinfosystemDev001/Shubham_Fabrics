import { NextRequest, NextResponse } from 'next/server';
import {
  AuthConfigError,
  SESSION_COOKIE,
  TRUSTED_HEADERS,
  isAdminClaims,
  readSessionToken,
  verifySessionToken,
  type SessionClaims,
} from '@/lib/auth/session-token';

// The cron route authenticates itself (CRON_SECRET bearer or an administrator session).
// The login background is read-only and shown before sign-in.
const PUBLIC_API_PATHS = new Set([
  '/api/auth/login',
  '/api/auth/logout',
  '/api/health',
  '/api/cron/deadline-alerts',
  '/api/branding/login-background',
]);
const PUBLIC_PAGE_PATHS = new Set(['/login']);

function forwardWithIdentity(request: NextRequest, claims: SessionClaims | null) {
  const headers = new Headers(request.headers);
  // Never let the client assert its own identity.
  for (const name of Object.values(TRUSTED_HEADERS)) headers.delete(name);
  if (claims) {
    headers.set(TRUSTED_HEADERS.userId, claims.sub);
    headers.set(TRUSTED_HEADERS.username, claims.username);
    headers.set(TRUSTED_HEADERS.roles, claims.roles.join(','));
    headers.set(TRUSTED_HEADERS.role, claims.role);
    headers.set(TRUSTED_HEADERS.department, claims.dept);
  }
  return NextResponse.next({ request: { headers } });
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isApi = pathname === '/api' || pathname.startsWith('/api/');

  if (isApi ? PUBLIC_API_PATHS.has(pathname) : PUBLIC_PAGE_PATHS.has(pathname)) {
    return forwardWithIdentity(request, null);
  }

  let claims: SessionClaims | null;
  try {
    claims = await verifySessionToken(
      readSessionToken(request.cookies.get(SESSION_COOKIE)?.value, request.headers.get('authorization')),
    );
  } catch (error) {
    if (error instanceof AuthConfigError) {
      console.error(error.message);
      return isApi
        ? NextResponse.json({ error: 'Server authentication is not configured.' }, { status: 500 })
        : new NextResponse('Server authentication is not configured.', { status: 500 });
    }
    throw error;
  }

  if (!claims) {
    if (isApi) {
      return NextResponse.json({ error: 'Authentication required. Please sign in.' }, { status: 401 });
    }
    const loginUrl = new URL('/login', request.url);
    if (pathname !== '/') loginUrl.searchParams.set('next', `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  const needsAdmin = pathname.startsWith('/api/admin/') || pathname === '/admin' || pathname.startsWith('/admin/');
  if (needsAdmin && !isAdminClaims(claims)) {
    return isApi
      ? NextResponse.json({ error: 'Administrator access is required.' }, { status: 403 })
      : NextResponse.redirect(new URL('/', request.url));
  }

  return forwardWithIdentity(request, claims);
}

export const config = {
  // Everything except Next.js internals and static files served from /public.
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|icon\\.svg|manifest\\.json|sw\\.js|.*\\.(?:png|jpe?g|gif|svg|ico|webp|apk|js|css|map|txt|woff2?)$).*)',
  ],
};
