/**
 * Signed session tokens (HS256 JWT) built on Web Crypto so the same code runs in
 * the Edge middleware and in Node route handlers.
 *
 * The signing key comes from AUTH_SECRET (or JWT_SECRET) and must be at least
 * 32 characters. There is no default: a missing secret is a configuration error.
 */

export const SESSION_COOKIE = 'subham_mes_token';
export const ROLE_COOKIE = 'subham_mes_role';
export const DEPT_COOKIE = 'subham_mes_dept';

const DEFAULT_SESSION_HOURS = 12;

export interface SessionClaims {
  sub: string;
  username: string;
  fullName: string;
  role: string;
  roles: string[];
  dept: string;
  iat: number;
  exp: number;
}

export class AuthConfigError extends Error {}

export function getSessionTtlSeconds(): number {
  const hours = Number(process.env.AUTH_SESSION_HOURS);
  return Math.round((Number.isFinite(hours) && hours > 0 ? hours : DEFAULT_SESSION_HOURS) * 3600);
}

const encoder = new TextEncoder();
let cachedKey: { secret: string; key: Promise<CryptoKey> } | null = null;

function getSigningKey(): Promise<CryptoKey> {
  const secret = process.env.AUTH_SECRET || process.env.JWT_SECRET || '';
  if (secret.length < 32) {
    throw new AuthConfigError('AUTH_SECRET must be set to a random string of at least 32 characters.');
  }
  if (!cachedKey || cachedKey.secret !== secret) {
    cachedKey = {
      secret,
      key: crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
        'sign',
        'verify',
      ]),
    };
  }
  return cachedKey.key;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(input: string): Uint8Array<ArrayBuffer> {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (input.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

const HEADER = base64UrlEncode(encoder.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));

export async function signSessionToken(claims: Omit<SessionClaims, 'iat' | 'exp'>): Promise<string> {
  const iat = Math.floor(Date.now() / 1000);
  const payload: SessionClaims = { ...claims, iat, exp: iat + getSessionTtlSeconds() };
  const body = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const signingInput = `${HEADER}.${body}`;
  const signature = await crypto.subtle.sign('HMAC', await getSigningKey(), encoder.encode(signingInput));
  return `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`;
}

/**
 * Returns the claims of a valid, unexpired token, or null for anything else.
 * Throws AuthConfigError only when the server itself is misconfigured.
 */
export async function verifySessionToken(token: string | null | undefined): Promise<SessionClaims | null> {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== HEADER) return null;

  const key = await getSigningKey();
  let valid = false;
  try {
    valid = await crypto.subtle.verify(
      'HMAC',
      key,
      base64UrlDecode(parts[2]),
      encoder.encode(`${parts[0]}.${parts[1]}`),
    );
  } catch {
    return null;
  }
  if (!valid) return null;

  let claims: SessionClaims;
  try {
    claims = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[1])));
  } catch {
    return null;
  }
  const now = Math.floor(Date.now() / 1000);
  if (typeof claims.sub !== 'string' || typeof claims.exp !== 'number' || claims.exp <= now) return null;
  return claims;
}

/** Reads the session token from the cookie, falling back to an `Authorization: Bearer` header. */
export function readSessionToken(cookieValue: string | undefined, authorizationHeader: string | null): string | null {
  if (cookieValue) return cookieValue;
  const bearer = (authorizationHeader || '').replace(/^Bearer\s+/i, '').trim();
  return bearer || null;
}

export function isAdminClaims(claims: Pick<SessionClaims, 'role' | 'roles' | 'dept'>): boolean {
  const roles = claims.roles.map((r) => r.toUpperCase());
  return (
    claims.role.toUpperCase() === 'ADMIN' ||
    claims.dept.toUpperCase() === 'ADMIN' ||
    roles.includes('ADMIN') ||
    roles.includes('SUPER_ADMIN')
  );
}

/** Headers the middleware sets from the verified session. Client-supplied values are always stripped. */
export const TRUSTED_HEADERS = {
  userId: 'x-mes-user-id',
  username: 'x-mes-username',
  roles: 'x-mes-roles',
  role: 'x-user-role',
  department: 'x-user-department',
} as const;
