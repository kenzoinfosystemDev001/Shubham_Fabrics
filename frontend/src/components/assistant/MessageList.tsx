'use client';

import { useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import type { ChatMessage } from '@/lib/assistant/transport';

interface MessageListProps {
  messages: ChatMessage[];
  pending: boolean;
}

/**
 * Conversation history. User messages align right in brand blue; assistant replies align left on
 * white with a border; notices and errors are set apart so they are never mistaken for answers.
 */
export function MessageList({ messages, pending }: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length, pending]);

  return (
    <div className="flex flex-col gap-3" role="log" aria-live="polite" aria-relevant="additions">
      {messages.map((message) => (
        <Message key={message.id} message={message} />
      ))}
      {pending && (
        <div className="flex justify-start">
          <div className="flex items-center gap-2 rounded-md border border-line bg-white px-3 py-2 text-xs text-muted">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            Working on your question
          </div>
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
}

function Message({ message }: { message: ChatMessage }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-md bg-brand-600 px-3 py-2 text-sm text-white">
          {message.text}
        </div>
      </div>
    );
  }

  if (message.role === 'error') {
    return (
      <div className="flex justify-start">
        <div
          role="alert"
          className="max-w-[90%] whitespace-pre-wrap break-words rounded-md border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger-600"
        >
          {message.text}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-md border border-line bg-white px-3 py-2 text-sm text-ink shadow-2xs">
        {message.text}
      </div>
    </div>
  );
}
