import { createOllamaProvider } from './ollama-provider';
import { AiProviderError, type AiProvider, type ProviderMessage } from './provider';
import type { AssistantConfig } from './config';
import type { ClientChatMessage } from './validation';

/**
 * Builds the provider-facing conversation and selects the provider from configuration.
 * The system instruction below is server-controlled; client messages can never carry a system role.
 */

export const SYSTEM_INSTRUCTION = [
  "You are the AI assistant embedded in Shubham Fabrics India Pvt. Ltd.'s Manufacturing Execution System.",
  '',
  'You are currently operating in AI-only mode.',
  '',
  'You do not have access to live MES records, the company database, challans, production sheets, inventory, employees or internal business transactions.',
  '',
  'Never claim that you have retrieved or verified company records.',
  '',
  'Never invent production quantities, challan numbers, design history, stock balances, employee details or business facts.',
  '',
  'If the user asks about actual company data, explain that MES data integration is not yet enabled.',
  '',
  'Answer general questions clearly and professionally.',
  '',
  'Do not claim to perform actions in the MES.',
  '',
  'You cannot create, edit, delete, issue, receive, approve or modify any company record.',
  '',
  'You are a read-only conversational assistant.',
].join('\n');

const MAX_OUTPUT_TOKENS = 512;

/** Maps configuration to a provider. Add a case here when another provider is introduced. */
export function createProvider(config: AssistantConfig): AiProvider {
  switch (config.provider) {
    case 'ollama':
      return createOllamaProvider({
        baseUrl: config.baseUrl,
        model: config.model,
        timeoutMs: config.timeoutMs,
        gatewayToken: config.gatewayToken,
      });
    default:
      // Fail closed: no fallback to another provider.
      throw new AiProviderError('NOT_CONFIGURED');
  }
}

export interface AssistantReply {
  content: string;
  truncated: boolean;
}

/**
 * Runs one chat turn. `history` has already been validated: it contains only user and assistant
 * messages, ends with the user's new message, and is bounded by CHAT_LIMITS.
 */
export async function generateAssistantReply(provider: AiProvider, history: ClientChatMessage[]): Promise<AssistantReply> {
  const messages: ProviderMessage[] = [
    { role: 'system', content: SYSTEM_INSTRUCTION },
    ...history.map((message) => ({ role: message.role, content: message.content })),
  ];

  const result = await provider.chat({ messages, maxOutputTokens: MAX_OUTPUT_TOKENS });
  return { content: result.content, truncated: result.truncated };
}
