'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { MessageSquare } from 'lucide-react';
import { AssistantPanel } from './AssistantPanel';
import { fetchAssistantStatus, type AssistantStatus } from '@/lib/assistant/transport';

/**
 * Floating entry point for the AI Department Assistant. Mounted once in the root layout.
 *
 * - Hidden on /login. On other pages it asks the server (once per sign-in) whether a session exists
 *   and whether the feature is enabled. Without a session the launcher stays hidden.
 * - Makes no request to any AI service. Stage 1 has no provider behind the panel.
 */
export function AssistantLauncher() {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';

  const [status, setStatus] = useState<AssistantStatus | null>(null);
  // Panel is mounted once opened, and kept mounted while minimized so the conversation survives.
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isLoginPage) return;
    const controller = new AbortController();
    fetchAssistantStatus(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setStatus(result);
      })
      .catch(() => {
        // Network or server failure: keep the launcher hidden rather than showing a broken control.
        if (!controller.signal.aborted) setStatus(null);
      });
    return () => controller.abort();
  }, [isLoginPage]);

  // Sign-out lands on /login: drop the status and any open panel so nothing stays on screen.
  useEffect(() => {
    if (!isLoginPage) return;
    setStatus(null);
    setMounted(false);
    setVisible(false);
  }, [isLoginPage]);

  if (isLoginPage || !status) return null;

  return (
    <>
      {!visible && (
        <button
          type="button"
          onClick={() => {
            setMounted(true);
            setVisible(true);
          }}
          aria-label="Open AI assistant"
          title={status.enabled ? 'AI assistant' : 'AI assistant (not enabled)'}
          className="fixed bottom-4 right-4 z-40 inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand-600 text-white shadow-sm transition-colors hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-2"
        >
          <MessageSquare className="h-5 w-5" aria-hidden="true" />
        </button>
      )}

      {mounted && (
        <AssistantPanel
          enabled={status.enabled}
          departmentName={status.department?.name ?? null}
          visible={visible}
          onMinimize={() => setVisible(false)}
          onClose={() => {
            setVisible(false);
            setMounted(false);
          }}
        />
      )}
    </>
  );
}
