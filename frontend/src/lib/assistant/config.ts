import { isAssistantEnabled } from './feature-flag';

/**
 * Server-only assistant configuration. Read from process.env on each call; no value is ever logged
 * or returned to the browser. Nothing here is NEXT_PUBLIC_, so it is not in client bundles.
 *
 * Fail-closed rules:
 * - AI_ASSISTANT_ENABLED must be exactly "true".
 * - AI_PROVIDER must be a known provider ("ollama" is the only one in this stage).
 * - Development: OLLAMA_BASE_URL must be an http(s) loopback origin (127.0.0.1, localhost or [::1]).
 * - Production (NODE_ENV=production): OLLAMA_BASE_URL must be https, must not be loopback, and
 *   OLLAMA_GATEWAY_TOKEN must be set. Anything else is "not configured" and the assistant stays off.
 */

export type AssistantConfig = {
  provider: 'ollama';
  baseUrl: string;
  model: string;
  timeoutMs: number;
  gatewayToken: string | null;
};

export type AssistantConfigResult =
  | { ok: true; config: AssistantConfig }
  | { ok: false; reason: 'disabled' | 'not_configured' };

const DEFAULT_TIMEOUT_MS = 60_000;
const MIN_TIMEOUT_MS = 1_000;
const MAX_TIMEOUT_MS = 300_000;
const MODEL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,99}$/;
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);
const MIN_TOKEN_LENGTH = 32;

export function loadAssistantConfig(env: NodeJS.ProcessEnv = process.env): AssistantConfigResult {
  if (!isAssistantEnabled(env)) return { ok: false, reason: 'disabled' };

  const provider = (env.AI_PROVIDER ?? '').trim();
  if (provider !== 'ollama') return { ok: false, reason: 'not_configured' };

  const production = env.NODE_ENV === 'production';
  const baseUrl = parseBaseUrl(env.OLLAMA_BASE_URL, production);
  if (!baseUrl) return { ok: false, reason: 'not_configured' };

  const model = (env.OLLAMA_MODEL ?? '').trim();
  if (!MODEL_PATTERN.test(model)) return { ok: false, reason: 'not_configured' };

  const timeoutMs = parseTimeout(env.OLLAMA_TIMEOUT_MS);
  if (timeoutMs === null) return { ok: false, reason: 'not_configured' };

  const token = (env.OLLAMA_GATEWAY_TOKEN ?? '').trim();
  if (production && token.length < MIN_TOKEN_LENGTH) return { ok: false, reason: 'not_configured' };

  return {
    ok: true,
    config: {
      provider: 'ollama',
      baseUrl,
      model,
      timeoutMs,
      gatewayToken: token.length >= MIN_TOKEN_LENGTH ? token : null,
    },
  };
}

/** Returns the normalised origin, or null if the value is not acceptable for this environment. */
function parseBaseUrl(raw: string | undefined, production: boolean): string | null {
  const value = (raw ?? '').trim();
  if (!value) return null;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  // Origin only: no credentials, path, query or fragment.
  if (url.username || url.password || url.search || url.hash) return null;
  if (url.pathname !== '/' && url.pathname !== '') return null;

  const loopback = LOOPBACK_HOSTS.has(url.hostname);
  if (production) {
    if (url.protocol !== 'https:' || loopback) return null;
  } else {
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (!loopback) return null;
  }

  return url.origin;
}

function parseTimeout(raw: string | undefined): number | null {
  if (raw === undefined || raw.trim() === '') return DEFAULT_TIMEOUT_MS;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < MIN_TIMEOUT_MS || value > MAX_TIMEOUT_MS) return null;
  return value;
}
