/**
 * Server-side switch for the AI Department Assistant.
 *
 * Off unless AI_ASSISTANT_ENABLED is exactly "true". Read only on the server; the value is never
 * exposed to the browser bundle (no NEXT_PUBLIC_ prefix). Stage 1 has no AI provider behind it,
 * so enabling the flag only shows the interface; no assistant answers are produced.
 */
export function isAssistantEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.AI_ASSISTANT_ENABLED === 'true';
}
