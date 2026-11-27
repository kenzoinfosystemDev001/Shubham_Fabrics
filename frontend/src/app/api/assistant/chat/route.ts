import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import { loadAssistantConfig } from '@/lib/assistant/config';
import { admit } from '@/lib/assistant/rate-limit';
import { AiProviderError } from '@/lib/assistant/provider';
import { createProvider, generateAssistantReply } from '@/lib/assistant/assistant-service';
import { CHAT_LIMITS, parseChatBody, readBodyWithLimit } from '@/lib/assistant/validation';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

function error(message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status, headers: NO_STORE });
}

/**
 * POST /api/assistant/chat
 *
 * Request:  { "messages": [{ "role": "user" | "assistant", "content": string }, ...] }
 *           The last message must be from the user. No other fields are accepted.
 * Response: 200 { "reply": { "role": "assistant", "content": string, "truncated": boolean } }
 *           4xx/5xx { "error": string } with a fixed, user-safe message.
 *
 * The user is taken from the server session only. The browser cannot choose the provider, the
 * endpoint, the model, the system instruction or any generation setting. This route reads no MES
 * tables; requireUser reads the user record for authentication only.
 */
export async function POST(request: Request) {
  // 1. Authentication (401 for signed-out requests; also rejects inactive users).
  const { user, response } = await requireUser(request);
  if (!user) return response;

  // 2. Feature flag and provider configuration (fail closed).
  const config = loadAssistantConfig();
  if (!config.ok) {
    if (config.reason === 'disabled') return error('The AI assistant is not currently enabled.', 503);
    return error('The AI assistant is not available on this server.', 503);
  }

  // 3. Request shape: JSON only, bounded size.
  if (!(request.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) {
    return error('Send the request as JSON.', 415);
  }
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (declared > CHAT_LIMITS.MAX_BODY_BYTES) return error('The message is too large.', 413);

  const text = await readBodyWithLimit(request, CHAT_LIMITS.MAX_BODY_BYTES);
  if (text === null) return error('The message is too large.', 413);

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return error('Invalid request.', 400);
  }

  // 4. Validation (system roles, empty messages, limits, last message from the user).
  const parsed = parseChatBody(raw);
  if (!parsed.ok) return error(parsed.error, 400);

  // 5. Rate limit and single-flight per user; global concurrency cap.
  const admission = admit(user.id);
  if (!admission.ok) {
    return admission.reason === 'rate_limited'
      ? error('Too many requests. Please wait a minute and try again.', 429)
      : error('The assistant is busy with another request. Please try again shortly.', 429);
  }

  // 6. Provider call with timeout (inside the provider).
  try {
    const provider = createProvider(config.config);
    const reply = await generateAssistantReply(provider, parsed.messages);
    return NextResponse.json(
      { reply: { role: 'assistant', content: reply.content, truncated: reply.truncated } },
      { headers: NO_STORE },
    );
  } catch (err) {
    const code = err instanceof AiProviderError ? err.code : 'INTERNAL';
    // Log the code only: no prompt, reply, user id, endpoint or secret.
    console.warn(`[assistant] chat request failed: ${code}`);
    if (!(err instanceof AiProviderError)) return error('The assistant could not respond. Please try again.', 500);
    switch (err.code) {
      case 'NOT_CONFIGURED':
        return error(err.message, 503);
      case 'UNAVAILABLE':
        return error(err.message, 503);
      case 'MODEL_NOT_FOUND':
        return error(err.message, 503);
      case 'TIMEOUT':
        return error(err.message, 504);
      default:
        return error(err.message, 502);
    }
  } finally {
    admission.release();
  }
}
