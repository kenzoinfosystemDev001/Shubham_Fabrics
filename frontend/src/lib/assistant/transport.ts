/**
 * Client-side contract for the assistant interface. Browser code only: it calls same-origin API
 * routes and never the AI provider. The panel depends on AssistantTransport, so the transport can be
 * replaced without changing the UI.
 */

export type ChatRole = 'user' | 'assistant' | 'error';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
}

export interface HistoryTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface AssistantTransport {
  send(input: { history: HistoryTurn[]; text: string; signal: AbortSignal }): Promise<string>;
}

/** Error whose message is always a fixed, user-safe string sent by the server. */
export class AssistantRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AssistantRequestError';
    this.status = status;
  }
}

const GENERIC_FAILURE = 'The assistant could not respond. Please try again.';

export interface AssistantStatus {
  enabled: boolean;
  department: { code: string; name: string } | null;
}

/**
 * Sends the conversation to the server. `history` holds the previous user and assistant turns only;
 * the server adds its own system instruction and validates everything.
 */
export const chatTransport: AssistantTransport = {
  async send({ history, text, signal }) {
    const res = await fetch('/api/assistant/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [...history, { role: 'user', content: text }] }),
      credentials: 'same-origin',
      cache: 'no-store',
      signal,
    });

    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }

    if (!res.ok) {
      const message = (body as { error?: unknown } | null)?.error;
      throw new AssistantRequestError(typeof message === 'string' ? message : GENERIC_FAILURE, res.status);
    }

    const content = (body as { reply?: { content?: unknown } } | null)?.reply?.content;
    if (typeof content !== 'string' || !content.trim()) {
      throw new AssistantRequestError(GENERIC_FAILURE, res.status);
    }
    return content;
  },
};

/**
 * Reads the assistant status from the same-origin API. Resolves to null when the user is not
 * signed in (the launcher then stays hidden). Throws on other failures.
 */
export async function fetchAssistantStatus(signal: AbortSignal): Promise<AssistantStatus | null> {
  const res = await fetch('/api/assistant/status', {
    method: 'GET',
    cache: 'no-store',
    credentials: 'same-origin',
    signal,
  });
  if (res.status === 401 || res.status === 403) return null;
  if (!res.ok) throw new Error(`Assistant status request failed (${res.status}).`);
  return (await res.json()) as AssistantStatus;
}

let messageCounter = 0;
/** Local message ids only; not stored anywhere. */
export function nextMessageId(): string {
  messageCounter += 1;
  return `m${Date.now().toString(36)}-${messageCounter}`;
}

export const SUGGESTED_QUESTIONS = [
  'Show my pending work',
  'Find a challan',
  'Show production status',
  'Show overdue work',
  'Show QC rejection history',
  'Show inventory packing status',
] as const;
