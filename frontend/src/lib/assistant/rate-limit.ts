/**
 * Server-side limits for assistant requests, keyed by the authenticated user's id.
 *
 * In-memory: suitable for a single local server process (development). Each serverless instance
 * keeps its own counts, so production needs a shared store before the assistant is enabled there.
 */

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 12;
const MAX_CONCURRENT_TOTAL = 2;
const MAX_TRACKED_USERS = 5_000;

const recent = new Map<string, number[]>();
const inFlight = new Set<string>();

export type Admission =
  | { ok: true; release: () => void }
  | { ok: false; reason: 'rate_limited' | 'busy' };

export function admit(userId: string, now: number = Date.now()): Admission {
  pruneIfLarge(now);

  const stamps = (recent.get(userId) ?? []).filter((t) => now - t < WINDOW_MS);
  if (stamps.length >= MAX_REQUESTS_PER_WINDOW) {
    recent.set(userId, stamps);
    return { ok: false, reason: 'rate_limited' };
  }
  if (inFlight.has(userId) || inFlight.size >= MAX_CONCURRENT_TOTAL) {
    recent.set(userId, stamps);
    return { ok: false, reason: 'busy' };
  }

  stamps.push(now);
  recent.set(userId, stamps);
  inFlight.add(userId);

  let released = false;
  return {
    ok: true,
    release: () => {
      if (released) return;
      released = true;
      inFlight.delete(userId);
    },
  };
}

function pruneIfLarge(now: number) {
  if (recent.size < MAX_TRACKED_USERS) return;
  for (const [userId, stamps] of recent) {
    const fresh = stamps.filter((t) => now - t < WINDOW_MS);
    if (fresh.length === 0) recent.delete(userId);
    else recent.set(userId, fresh);
  }
}
