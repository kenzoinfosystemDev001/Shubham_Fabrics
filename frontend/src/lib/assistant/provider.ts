/**
 * Provider-independent interface for the server-side assistant. The chat route and the assistant
 * service depend only on this file; a provider is an implementation of AiProvider selected by
 * configuration (see createProvider in assistant-service.ts). Stage 2 implements "ollama" only.
 */

export type ProviderRole = 'system' | 'user' | 'assistant';

export interface ProviderMessage {
  role: ProviderRole;
  content: string;
}

export interface ProviderChatRequest {
  messages: ProviderMessage[];
  maxOutputTokens: number;
}

export interface ProviderChatResult {
  content: string;
  /** True when the reply was cut to the configured length limit. */
  truncated: boolean;
}

export interface AiProvider {
  readonly name: string;
  chat(request: ProviderChatRequest): Promise<ProviderChatResult>;
}

/** Stable error codes. The message for each code is fixed; provider details never reach the user. */
export type AiErrorCode =
  | 'NOT_CONFIGURED'
  | 'UNAVAILABLE'
  | 'TIMEOUT'
  | 'MODEL_NOT_FOUND'
  | 'MALFORMED_RESPONSE'
  | 'UPSTREAM_ERROR';

const SAFE_MESSAGES: Record<AiErrorCode, string> = {
  NOT_CONFIGURED: 'The AI assistant is not available on this server.',
  UNAVAILABLE: 'The AI assistant is currently unavailable. Please try again later.',
  TIMEOUT: 'The assistant took too long to respond. Please try again.',
  MODEL_NOT_FOUND: 'The assistant is not available right now. Please contact your administrator.',
  MALFORMED_RESPONSE: 'The assistant returned an unexpected response. Please try again.',
  UPSTREAM_ERROR: 'The assistant returned an unexpected response. Please try again.',
};

export class AiProviderError extends Error {
  readonly code: AiErrorCode;

  constructor(code: AiErrorCode) {
    super(SAFE_MESSAGES[code]);
    this.name = 'AiProviderError';
    this.code = code;
  }
}
