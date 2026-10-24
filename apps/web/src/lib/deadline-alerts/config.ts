import { DEFAULT_FACTORY_TIMEZONE, DEFAULT_THRESHOLD_DAYS, normalizeThresholds } from './schedule';

/**
 * Departments the deadline alert engine knows about. A department raises alerts only
 * when it is enabled here (or through DEADLINE_ALERTS_DEPARTMENTS) AND a task provider
 * exists for it. Only Dyeing has a provider today; the others are placeholders so they
 * can be switched on once their deadline source is implemented.
 */
export interface DepartmentAlertConfig {
  department: string;
  label: string;
  enabled: boolean;
  thresholdsDays: number[];
}

const BASE_CONFIG: Record<string, Omit<DepartmentAlertConfig, 'department'>> = {
  DYEING: { label: 'Dyeing', enabled: true, thresholdsDays: DEFAULT_THRESHOLD_DAYS },
  DYEING_QC: { label: 'Dyeing QC', enabled: false, thresholdsDays: DEFAULT_THRESHOLD_DAYS },
  EMBROIDERY: { label: 'Embroidery', enabled: false, thresholdsDays: DEFAULT_THRESHOLD_DAYS },
  THREAD_CUTTING: { label: 'Thread Cutting', enabled: false, thresholdsDays: DEFAULT_THRESHOLD_DAYS },
};

function parseList(value: string | undefined): string[] | null {
  if (!value || !value.trim()) return null;
  return value.split(',').map((v) => v.trim().toUpperCase()).filter(Boolean);
}

function parseDays(value: string | undefined): number[] | null {
  if (!value || !value.trim()) return null;
  const days = normalizeThresholds(value.split(',').map((v) => Number(v.trim())));
  return days.length > 0 ? days : null;
}

export function getFactoryTimezone(env: Record<string, string | undefined> = process.env): string {
  const tz = env.FACTORY_TIMEZONE?.trim();
  if (!tz) return DEFAULT_FACTORY_TIMEZONE;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return tz;
  } catch {
    console.warn(`[deadline-alerts] Invalid FACTORY_TIMEZONE "${tz}", using ${DEFAULT_FACTORY_TIMEZONE}.`);
    return DEFAULT_FACTORY_TIMEZONE;
  }
}

/**
 * DEADLINE_ALERTS_DEPARTMENTS=DYEING,EMBROIDERY overrides which departments are enabled.
 * DEADLINE_ALERT_THRESHOLD_DAYS=7,3,1 overrides the reminder thresholds for all departments;
 * DEADLINE_ALERT_THRESHOLD_DAYS_<DEPT>=5,2 overrides them for one department.
 */
export function getDepartmentAlertConfigs(env: Record<string, string | undefined> = process.env): DepartmentAlertConfig[] {
  const enabledOverride = parseList(env.DEADLINE_ALERTS_DEPARTMENTS);
  const globalDays = parseDays(env.DEADLINE_ALERT_THRESHOLD_DAYS);
  return Object.entries(BASE_CONFIG).map(([department, cfg]) => ({
    department,
    label: cfg.label,
    enabled: enabledOverride ? enabledOverride.includes(department) : cfg.enabled,
    thresholdsDays: parseDays(env[`DEADLINE_ALERT_THRESHOLD_DAYS_${department}`]) || globalDays || cfg.thresholdsDays,
  }));
}

export function getDepartmentAlertConfig(department: string, env: Record<string, string | undefined> = process.env) {
  return getDepartmentAlertConfigs(env).find((c) => c.department === department) || null;
}
