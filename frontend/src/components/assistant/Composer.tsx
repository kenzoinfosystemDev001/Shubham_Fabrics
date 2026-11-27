'use client';

import { useState, type KeyboardEvent } from 'react';
import { Send } from 'lucide-react';

interface ComposerProps {
  disabled: boolean;
  busy: boolean;
  /** Fills the input from outside (suggested questions). Changing the value, not sending. */
  draft: string;
  onDraftChange: (value: string) => void;
  onSubmit: (text: string) => void;
}

/**
 * Multiline input. Enter sends; Shift+Enter inserts a line break. While `busy`, sending is blocked.
 * The panel also refuses a second submission while a reply is pending, so a double Enter or double
 * click cannot send twice.
 */
export function Composer({ disabled, busy, draft, onDraftChange, onSubmit }: ComposerProps) {
  const [composing, setComposing] = useState(false);

  const text = draft.trim();
  const canSend = !disabled && !busy && text.length > 0;

  function submit() {
    if (!canSend) return;
    onSubmit(text);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Ignore Enter while an IME composition is active (Indian-language keyboards).
    if (event.key === 'Enter' && !event.shiftKey && !composing && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <div className="flex items-end gap-2 border-t border-line bg-white p-3">
      <label htmlFor="assistant-input" className="sr-only">
        Message to the assistant
      </label>
      <textarea
        id="assistant-input"
        rows={2}
        value={draft}
        disabled={disabled}
        placeholder={disabled ? 'Assistant is not enabled' : 'Type a question. Enter sends, Shift+Enter adds a line.'}
        onChange={(e) => onDraftChange(e.target.value)}
        onKeyDown={onKeyDown}
        onCompositionStart={() => setComposing(true)}
        onCompositionEnd={() => setComposing(false)}
        className="max-h-32 min-h-[2.5rem] flex-1 resize-none rounded-md border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20 disabled:bg-neutral-50 disabled:text-muted"
      />
      <button
        type="button"
        onClick={submit}
        disabled={!canSend}
        aria-label="Send message"
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand-600 text-white transition-colors hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-500"
      >
        <Send className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
