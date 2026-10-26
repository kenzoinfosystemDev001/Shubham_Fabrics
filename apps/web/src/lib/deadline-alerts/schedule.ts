/**
 * Pure deadline arithmetic for the Smart Deadline Alerts engine (no database access).
 *
 * A delivery date is a calendar day. "Days remaining" is the number of calendar days
 * between today and the delivery day, both taken in the factory timezone. Work is due
 * until the end of the delivery day in that timezone and overdue after it.
 */

/** `D<n>` = n days or fewer remain (e.g. D7, D3, D1), then due today, then overdue. */
export type DeadlineStage = `D${number}` | 'DUE_TODAY' | 'OVERDUE';
export type DeadlineSeverity = 'UPCOMING' | 'HIGH' | 'CRITICAL';

export const DEFAULT_FACTORY_TIMEZONE = 'Asia/Kolkata';
export const DEFAULT_THRESHOLD_DAYS = [7, 3, 1];

/** Calendar date (YYYY-MM-DD) of an instant in the given IANA timezone. */
export function calendarDateInZone(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || '00';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function dayNumber(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

/** Offset of the timezone from UTC at the given instant, in minutes (e.g. +330 for IST). */
function zoneOffsetMinutes(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value || 0);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return Math.round((asUtc - instant.getTime()) / 60_000);
}

/** The last instant (23:59:59.999) of a calendar day in the timezone. */
export function endOfDayInZone(isoDate: string, timeZone: string): Date {
  const [y, m, d] = isoDate.split('-').map(Number);
  const naive = Date.UTC(y, m - 1, d, 23, 59, 59, 999);
  // Two passes handle a DST transition on that day.
  let instant = naive - zoneOffsetMinutes(new Date(naive), timeZone) * 60_000;
  instant = naive - zoneOffsetMinutes(new Date(instant), timeZone) * 60_000;
  return new Date(instant);
}

export interface DeadlineEvaluation {
  /** The most urgent threshold reached, or null when the deadline is further away than every threshold. */
  stage: DeadlineStage | null;
  severity: DeadlineSeverity | null;
  /** Calendar days from today to the delivery day (negative when overdue). */
  daysRemaining: number;
  /** Milliseconds until the end of the delivery day (negative when overdue). */
  msRemaining: number;
  deadlineDate: string;
}

export function normalizeThresholds(thresholds: number[]): number[] {
  return Array.from(new Set(thresholds.filter((d) => Number.isInteger(d) && d >= 1))).sort((a, b) => b - a);
}

export function stageForThreshold(days: number): DeadlineStage {
  return `D${days}`;
}

export function severityForStage(stage: DeadlineStage, thresholds: number[]): DeadlineSeverity {
  if (stage === 'OVERDUE' || stage === 'DUE_TODAY') return 'CRITICAL';
  const smallest = Math.min(...normalizeThresholds(thresholds));
  return stage === stageForThreshold(smallest) ? 'HIGH' : 'UPCOMING';
}

export function evaluateDeadline(
  deadline: Date,
  now: Date,
  thresholds: number[] = DEFAULT_THRESHOLD_DAYS,
  timeZone: string = DEFAULT_FACTORY_TIMEZONE
): DeadlineEvaluation {
  const deadlineDate = calendarDateInZone(deadline, timeZone);
  const today = calendarDateInZone(now, timeZone);
  const daysRemaining = dayNumber(deadlineDate) - dayNumber(today);
  const msRemaining = endOfDayInZone(deadlineDate, timeZone).getTime() - now.getTime();

  let stage: DeadlineStage | null = null;
  if (daysRemaining < 0) stage = 'OVERDUE';
  else if (daysRemaining === 0) stage = 'DUE_TODAY';
  else {
    // Smallest threshold that has been reached, e.g. 2 days left with [7, 3, 1] -> D3.
    const reached = normalizeThresholds(thresholds).filter((d) => daysRemaining <= d);
    if (reached.length > 0) stage = stageForThreshold(Math.min(...reached));
  }

  return {
    stage,
    severity: stage ? severityForStage(stage, thresholds) : null,
    daysRemaining,
    msRemaining,
    deadlineDate,
  };
}

/** One alert per task, deadline day and stage: the same condition can never be raised twice. */
export function deadlineAlertKey(department: string, taskType: string, taskId: string, deadlineDate: string, stage: DeadlineStage): string {
  return `${department}:${taskType}:${taskId}:${deadlineDate}:${stage}`;
}

/** "2d 5h left", "6h left", "Overdue by 1d 3h". */
export function formatRemaining(msRemaining: number): string {
  const abs = Math.abs(msRemaining);
  const days = Math.floor(abs / 86_400_000);
  const hours = Math.floor((abs % 86_400_000) / 3_600_000);
  const minutes = Math.floor((abs % 3_600_000) / 60_000);
  const span = days > 0 ? `${days}d ${hours}h` : hours > 0 ? `${hours}h` : `${Math.max(minutes, 1)}m`;
  return msRemaining < 0 ? `Overdue by ${span}` : `${span} left`;
}
