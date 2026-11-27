import { AiProviderError, type AiProvider, type ProviderChatRequest, type ProviderChatResult } from './provider';

/**
 * Ollama provider (native /api/chat, non-streaming). Server-side only.
 *
 * Errors are mapped to AiProviderError codes; response bodies and network error text are never
 * copied into errors, logs or responses.
 */

export interface OllamaProviderOptions {
  baseUrl: string;
  model: string;
  timeoutMs: number;
  gatewayToken: string | null;
}

const NUM_CTX = 4096;
const TEMPERATURE = 0.3;
const MAX_RESPONSE_CHARS = 4000;
const MAX_RAW_RESPONSE_CHARS = 256_000;

export function createOllamaProvider(options: OllamaProviderOptions): AiProvider {
  const endpoint = new URL('/api/chat', options.baseUrl).toString();

  return {
    name: 'ollama',
    async chat(request: ProviderChatRequest): Promise<ProviderChatResult> {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), options.timeoutMs);

      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (options.gatewayToken) headers.Authorization = `Bearer ${options.gatewayToken}`;

        let response: Response;
        try {
          response = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              model: options.model,
              messages: request.messages,
              stream: false,
              options: {
                num_predict: request.maxOutputTokens,
                num_ctx: NUM_CTX,
                temperature: TEMPERATURE,
              },
            }),
            signal: controller.signal,
            redirect: 'error',
            cache: 'no-store',
          });
        } catch {
          throw new AiProviderError(controller.signal.aborted ? 'TIMEOUT' : 'UNAVAILABLE');
        }

        if (response.status === 404) {
          // Ollama answers 404 when the model is not pulled. The body is only inspected, never kept.
          const text = await readCapped(response, controller.signal);
          throw new AiProviderError(/not found/i.test(text) ? 'MODEL_NOT_FOUND' : 'UPSTREAM_ERROR');
        }
        if (!response.ok) throw new AiProviderError('UPSTREAM_ERROR');

        const raw = await readCapped(response, controller.signal);
        return parseChatResponse(raw);
      } catch (error) {
        if (error instanceof AiProviderError) throw error;
        throw new AiProviderError(controller.signal.aborted ? 'TIMEOUT' : 'MALFORMED_RESPONSE');
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

async function readCapped(response: Response, signal: AbortSignal): Promise<string> {
  if (signal.aborted) throw new AiProviderError('TIMEOUT');
  const text = await response.text();
  if (text.length > MAX_RAW_RESPONSE_CHARS) throw new AiProviderError('MALFORMED_RESPONSE');
  return text;
}

function parseChatResponse(raw: string): ProviderChatResult {
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    throw new AiProviderError('MALFORMED_RESPONSE');
  }

  const content = (body as { message?: { content?: unknown } } | null)?.message?.content;
  if (typeof content !== 'string') throw new AiProviderError('MALFORMED_RESPONSE');

  const trimmed = content.trim();
  if (!trimmed) throw new AiProviderError('MALFORMED_RESPONSE');

  if (trimmed.length > MAX_RESPONSE_CHARS) {
    return { content: trimmed.slice(0, MAX_RESPONSE_CHARS).trimEnd(), truncated: true };
  }
  return { content: trimmed, truncated: false };
}
