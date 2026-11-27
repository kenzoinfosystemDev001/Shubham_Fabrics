'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Minus, Plus, X } from 'lucide-react';
import { Composer } from './Composer';
import { MessageList } from './MessageList';
import {
  AssistantRequestError,
  SUGGESTED_QUESTIONS,
  chatTransport,
  nextMessageId,
  type AssistantTransport,
  type ChatMessage,
  type HistoryTurn,
} from '@/lib/assistant/transport';

/** Earlier turns sent with each request (the server enforces its own limit as well). */
const MAX_HISTORY_TURNS = 10;

interface AssistantPanelProps {
  enabled: boolean;
  departmentName: string | null;
  /** Hidden but mounted: keeps the conversation when minimized. */
  visible: boolean;
  onMinimize: () => void;
  /** Closing discards the conversation (nothing is stored anywhere). */
  onClose: () => void;
  transport?: AssistantTransport;
}

const GENERIC_ERROR = 'The assistant could not respond. Please try again.';

export function AssistantPanel({
  enabled,
  departmentName,
  visible,
  onMinimize,
  onClose,
  transport = chatTransport,
}: AssistantPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);

  // Refs hold the single-flight guard and the in-flight request, so repeated submits are refused
  // even before React re-renders.
  const pendingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  // Cancel any in-flight request when the panel unmounts.
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  function startNewConversation() {
    abortRef.current?.abort();
    abortRef.current = null;
    pendingRef.current = false;
    setPending(false);
    setMessages([]);
    setDraft('');
  }

  async function handleSend(text: string) {
    if (!enabled || pendingRef.current) return;

    // Only real user and assistant turns are sent as history; errors are never replayed to the model.
    const history: HistoryTurn[] = messages
      .filter((message): message is ChatMessage & { role: 'user' | 'assistant' } => message.role !== 'error')
      .slice(-MAX_HISTORY_TURNS)
      .map((message) => ({ role: message.role, content: message.text }));

    pendingRef.current = true;
    setPending(true);
    setDraft('');
    setMessages((current) => [...current, { id: nextMessageId(), role: 'user', text }]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const content = await transport.send({ history, text, signal: controller.signal });
      if (controller.signal.aborted) return;
      setMessages((current) => [...current, { id: nextMessageId(), role: 'assistant', text: content }]);
    } catch (err) {
      if (controller.signal.aborted) return;
      const message = err instanceof AssistantRequestError ? err.message : GENERIC_ERROR;
      setMessages((current) => [...current, { id: nextMessageId(), role: 'error', text: message }]);
    } finally {
      // A new conversation resets the guard itself; only clear it for this request.
      if (abortRef.current === controller) {
        abortRef.current = null;
        pendingRef.current = false;
        setPending(false);
      }
    }
  }

  const showWelcome = messages.length === 0;

  return (
    <section
      aria-label="Shubham Fabrics AI Assistant"
      className={`fixed inset-0 z-40 flex-col bg-white sm:inset-auto sm:bottom-20 sm:right-4 sm:h-[min(580px,calc(100vh-6rem))] sm:w-[380px] sm:rounded-lg sm:border sm:border-line sm:shadow-md ${
        visible ? 'flex' : 'hidden'
      }`}
    >
      <header className="flex items-start justify-between gap-2 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-ink">Shubham Fabrics AI Assistant</h2>
          <p className="truncate text-xs text-muted">
            {departmentName ? `Department: ${departmentName}` : 'Signed-in MES user'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <IconButton label="New conversation" onClick={startNewConversation}>
            <Plus className="h-4 w-4" aria-hidden="true" />
          </IconButton>
          <IconButton label="Minimize assistant" onClick={onMinimize}>
            <Minus className="h-4 w-4" aria-hidden="true" />
          </IconButton>
          <IconButton label="Close assistant" onClick={onClose}>
            <X className="h-4 w-4" aria-hidden="true" />
          </IconButton>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto bg-canvas px-4 py-3">
        {!enabled && (
          <div className="mb-3 rounded-md border border-line bg-white px-3 py-2 text-sm text-ink">
            <p className="font-medium">The AI assistant is not currently enabled.</p>
            <p className="mt-0.5 text-xs text-muted">Ask your MES administrator to turn it on.</p>
          </div>
        )}

        {showWelcome ? (
          <div className="flex flex-col gap-4">
            <div className="text-sm text-ink">
              <p className="font-medium">Welcome to the Shubham Fabrics AI Assistant.</p>
              <p className="mt-1 text-xs text-muted">
                Answers will be based on MES records you are authorized to see.
                {enabled && ' Answers come from the AI model only; MES records are not connected.'}
              </p>
            </div>
            {enabled && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Suggested questions</p>
                <ul className="flex flex-col gap-1.5">
                  {SUGGESTED_QUESTIONS.map((question) => (
                    <li key={question}>
                      <button
                        type="button"
                        onClick={() => setDraft(question)}
                        className="w-full rounded-md border border-line bg-white px-3 py-2 text-left text-sm text-ink transition-colors hover:border-brand-600 hover:text-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30"
                      >
                        {question}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <MessageList messages={messages} pending={pending} />
        )}
      </div>

      <Composer
        disabled={!enabled}
        busy={pending}
        draft={draft}
        onDraftChange={setDraft}
        onSubmit={handleSend}
      />
    </section>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30"
    >
      {children}
    </button>
  );
}
