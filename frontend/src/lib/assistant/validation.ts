import { z } from 'zod';

/** Limits for the chat request. The browser cannot change any of them. */
export const CHAT_LIMITS = {
  MAX_BODY_BYTES: 32_768,
  MAX_MESSAGES: 12,
  MAX_MESSAGE_CHARS: 2_000,
  MAX_TOTAL_CHARS: 12_000,
} as const;

export type ClientChatRole = 'user' | 'assistant';

export interface ClientChatMessage {
  role: ClientChatRole;
  content: string;
}

// Control characters other than tab and newline are removed before length checks.
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

const messageSchema = z
  .object({
    // "system" is not an allowed role: the server supplies its own system instruction.
    role: z.enum(['user', 'assistant']),
    content: z
      .string()
      .transform((value) => value.replace(CONTROL_CHARS, '').trim())
      .pipe(z.string().min(1, 'Messages cannot be empty.').max(CHAT_LIMITS.MAX_MESSAGE_CHARS, 'A message is too long.')),
  })
  .strict();

const bodySchema = z
  .object({
    messages: z
      .array(messageSchema)
      .min(1, 'Send at least one message.')
      .max(CHAT_LIMITS.MAX_MESSAGES, 'The conversation is too long. Start a new conversation.'),
  })
  .strict()
  .superRefine((body, ctx) => {
    const total = body.messages.reduce((sum, message) => sum + message.content.length, 0);
    if (total > CHAT_LIMITS.MAX_TOTAL_CHARS) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'The conversation is too long. Start a new conversation.' });
    }
    if (body.messages[body.messages.length - 1].role !== 'user') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'The last message must be from you.' });
    }
  });

export type ParsedChatBody =
  | { ok: true; messages: ClientChatMessage[] }
  | { ok: false; error: string };

/** Validates an already-parsed JSON body. Returns a fixed, user-safe message on failure. */
export function parseChatBody(raw: unknown): ParsedChatBody {
  const result = bodySchema.safeParse(raw);
  if (!result.success) {
    const issue = result.error.issues[0];
    return { ok: false, error: issue?.message ?? 'Invalid request.' };
  }
  return {
    ok: true,
    messages: result.data.messages.map((message) => ({ role: message.role, content: message.content })),
  };
}

/**
 * Reads the request body with a hard byte limit, without buffering more than the limit.
 * Returns null when the body is larger than the limit.
 */
export async function readBodyWithLimit(request: Request, limit: number): Promise<string | null> {
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}
