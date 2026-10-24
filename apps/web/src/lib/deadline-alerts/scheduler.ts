import { syncAllDeadlineAlerts } from './engine';

/**
 * In-process scheduler for deadline alerts, started once per server process from
 * src/instrumentation.ts. Runs independently of anyone having a dashboard open.
 *
 *   DEADLINE_ALERTS_SCHEDULER=off            disable (e.g. when an external cron calls /api/alerts/run)
 *   DEADLINE_ALERTS_INTERVAL_MINUTES=15      run interval (1–720)
 *
 * Each run is idempotent, so overlapping servers or a retry cannot create duplicates.
 * A failed run is retried once after two minutes, and again on the next interval.
 */
const RETRY_DELAY_MS = 2 * 60_000;
const FIRST_RUN_DELAY_MS = 30_000;

type SchedulerState = { timer?: ReturnType<typeof setInterval>; running: boolean };
const globalState = globalThis as typeof globalThis & { __mesDeadlineAlertScheduler?: SchedulerState };

export function startDeadlineAlertScheduler(): void {
  if (process.env.DEADLINE_ALERTS_SCHEDULER === 'off') return;
  if (globalState.__mesDeadlineAlertScheduler) return;

  const minutes = Math.min(720, Math.max(1, Number(process.env.DEADLINE_ALERTS_INTERVAL_MINUTES) || 15));
  const state: SchedulerState = { running: false };
  globalState.__mesDeadlineAlertScheduler = state;

  const run = async (isRetry = false) => {
    if (state.running) return;
    state.running = true;
    try {
      const results = await syncAllDeadlineAlerts();
      const failed = results.filter((r) => 'error' in r);
      if (failed.length > 0 && !isRetry) setTimeout(() => void run(true), RETRY_DELAY_MS).unref?.();
    } catch (error) {
      console.error('[deadline-alerts] Scheduled run failed:', error);
      if (!isRetry) setTimeout(() => void run(true), RETRY_DELAY_MS).unref?.();
    } finally {
      state.running = false;
    }
  };

  setTimeout(() => void run(), FIRST_RUN_DELAY_MS).unref?.();
  state.timer = setInterval(() => void run(), minutes * 60_000);
  state.timer.unref?.();
  console.log(`[deadline-alerts] Scheduler started (every ${minutes} min).`);
}
