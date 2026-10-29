// Pure date / threshold / dedup rules for Smart Deadline Alerts.
// No database or framework imports.

export const ALERT_TYPES = Object.freeze({
  OVERDUE: 'OVERDUE',
  DUE_TODAY: 'DUE_TODAY',
  DUE_SOON: 'DUE_SOON',
});

export const SEVERITY_RANK = Object.freeze({ CRITICAL: 3, WARNING: 2, INFO: 1 });

const DAY_MS = 86400000;

/**
 * Calendar day ("YYYY-MM-DD") of an instant in an IANA time zone. Delivery dates are stored as
 * instants (UTC midnight or noon of the chosen date), so the factory-local calendar day is the
 * deadline the user picked.
 */
export function factoryDay(instant, timeZone) {
  const date = instant instanceof Date ? instant : new Date(instant);
  if (Number.isNaN(date.getTime())) throw new RangeError('Invalid date');
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Whole calendar days from `fromDay` to `toDay` (both "YYYY-MM-DD"); negative when toDay is earlier. */
export function daysBetween(fromDay, toDay) {
  const toUtc = (day) => {
    const [y, m, d] = day.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(toDay) - toUtc(fromDay)) / DAY_MS);
}

/**
 * Normalizes a threshold list: unique positive whole days, ascending. Day 0 (due today) and
 * negative days (overdue) are built-in stages and never come from this list.
 */
export function normalizeThresholds(thresholds) {
  const days = [...new Set((thresholds || []).map(Number))].filter((d) => Number.isInteger(d) && d > 0);
  return days.sort((a, b) => a - b);
}

/**
 * Which alert stage a deadline is in today, or null when it is further away than the largest
 * threshold. `daysRemaining` is in factory calendar days (0 = due today, < 0 = overdue).
 */
export function classifyDeadline(daysRemaining, thresholds, warningWithinDays = 3) {
  if (!Number.isInteger(daysRemaining)) return null;
  if (daysRemaining < 0) return { alertType: ALERT_TYPES.OVERDUE, thresholdDays: null, severity: 'CRITICAL' };
  if (daysRemaining === 0) return { alertType: ALERT_TYPES.DUE_TODAY, thresholdDays: 0, severity: 'CRITICAL' };
  const threshold = normalizeThresholds(thresholds).find((d) => daysRemaining <= d);
  if (threshold === undefined) return null;
  const severity = threshold <= warningWithinDays ? 'WARNING' : 'INFO';
  return { alertType: ALERT_TYPES.DUE_SOON, thresholdDays: threshold, severity };
}

/** Evaluates a deadline instant against "now" in the factory time zone. */
export function evaluateDeadline(deadline, now, { timeZone, thresholds, warningWithinDays }) {
  if (!deadline) return { deadlineDay: null, daysRemaining: null, stage: null };
  const deadlineDay = factoryDay(deadline, timeZone);
  const today = factoryDay(now, timeZone);
  const daysRemaining = daysBetween(today, deadlineDay);
  return { deadlineDay, daysRemaining, stage: classifyDeadline(daysRemaining, thresholds, warningWithinDays) };
}

/**
 * Decides what the engine does for one open task, given the alert it wants (by dedup key) and
 * the task's currently active alerts. Pure, so the dedup behaviour is unit-tested.
 *   keep    - desired alert already active, nothing to write
 *   create  - no alert with this key yet
 *   reopen  - an alert with this key exists but was resolved (e.g. deadline moved back)
 *   resolve - active alerts that no longer match, with the reason
 */
export function planTaskAlerts({ desiredKey, existingByKey, activeAlerts, deadlineDay }) {
  const resolve = activeAlerts
    .filter((a) => a.dedupKey !== desiredKey)
    .map((a) => ({
      id: a.id,
      reason: (a.deadlineDay || null) !== (deadlineDay || null) ? 'DEADLINE_CHANGED' : 'SUPERSEDED',
    }));
  if (!desiredKey) return { action: 'none', resolve };
  const existing = existingByKey || null;
  if (!existing) return { action: 'create', resolve };
  if (existing.status === 'ACTIVE') return { action: 'keep', resolve };
  return { action: 'reopen', resolve };
}

/**
 * Dedup key: one alert per department + task + stage + deadline day. Refreshing or re-running
 * produces the same key; crossing into a new threshold or moving the deadline produces a new one.
 */
export function alertDedupKey({ departmentCode, entityType, entityId, alertType, thresholdDays, deadlineDay }) {
  const stage = alertType === ALERT_TYPES.DUE_SOON ? `${alertType}_${thresholdDays}` : alertType;
  return [departmentCode, entityType, entityId, stage, deadlineDay].join(':');
}

/** Short, factory-floor wording for the time left (or overdue) at read time. */
export function describeRemaining(daysRemaining) {
  if (daysRemaining === null || daysRemaining === undefined) return 'No delivery date';
  if (daysRemaining < 0) {
    const n = -daysRemaining;
    return `Overdue by ${n} day${n === 1 ? '' : 's'}`;
  }
  if (daysRemaining === 0) return 'Due today';
  if (daysRemaining === 1) return 'Due tomorrow';
  return `Due in ${daysRemaining} days`;
}

/** Severity at read time (an overdue alert is always critical even if it was created earlier). */
export function liveSeverity(daysRemaining, storedSeverity) {
  if (daysRemaining !== null && daysRemaining !== undefined && daysRemaining <= 0) return 'CRITICAL';
  return storedSeverity;
}
