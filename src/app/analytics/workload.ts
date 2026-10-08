import { addDays, addMonths, addYears, startOfMonth, startOfYear, differenceInCalendarDays, format, parseISO, isValid } from 'date-fns';

export interface DateRange { start: string; end: string }
export type PeriodPreset = 'last7' | 'last14' | 'last30' | 'all' | 'custom';
export interface AnalyticsPolicy { restricted: boolean; referenceDate?: string }
export interface WorkloadEntry {
  date: string;
  skipped?: boolean;
  subjectTimes: { subjectId: string; classTime: number; selfStudyTime: number }[];
}
export interface WorkloadMetrics {
  total: { classTime: number; selfStudyTime: number };
  weeklyAverage: { classTime: number; selfStudyTime: number };
}

export type WorkloadGrouping = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type ChartValueMode = 'total' | 'weeklyAverage' | 'dailyAverage';
export function workloadBarValue(total: number, range: DateRange, mode: ChartValueMode): number {
  const days = differenceInCalendarDays(parseISO(range.end), parseISO(range.start)) + 1;
  if (!Number.isFinite(days) || days <= 0) throw new Error('Invalid analytics range');
  return mode === 'total' ? total : total / days * (mode === 'weeklyAverage' ? 7 : 1);
}
export interface WorkloadBucket extends DateRange { metrics: Map<string, WorkloadMetrics> }

/** Weeks are consecutive seven-day intervals anchored to the range end.
 * Months and years follow calendar boundaries. Weekly submissions stay on their recorded date. */
export function bucketWorkload(entries: Iterable<WorkloadEntry>, range: DateRange, grouping: WorkloadGrouping): WorkloadBucket[] {
  const days = differenceInCalendarDays(parseISO(range.end), parseISO(range.start)) + 1;
  if (!Number.isFinite(days) || days <= 0) throw new Error('Invalid analytics range');
  const ranges: DateRange[] = [];
  if (grouping === 'weekly') {
    let end = parseISO(range.end);
    while (dateKey(end) >= range.start) {
      const start = dateKey(addDays(end, -6));
      ranges.unshift({ start: start < range.start ? range.start : start, end: dateKey(end) });
      end = addDays(end, -7);
    }
  } else {
    let cursor = parseISO(range.start);
    while (dateKey(cursor) <= range.end) {
      const next = grouping === 'monthly' ? addMonths(startOfMonth(cursor), 1)
        : grouping === 'yearly' ? addYears(startOfYear(cursor), 1) : addDays(cursor, 1);
      const end = dateKey(addDays(next, -1));
      ranges.push({ start: dateKey(cursor), end: end > range.end ? range.end : end });
      cursor = next;
    }
  }
  const records = Array.from(entries);
  return ranges.map(bucket => ({ ...bucket, metrics: aggregateWorkload(records, bucket) }));
}

const dateKey = (date: Date) => format(date, 'yyyy-MM-dd');

export const ROLLING_PERIOD_DAYS = { last7: 7, last14: 14, last30: 30 } as const;

/** Rolling calendar days inclusive of the latest recorded entry date. */
export function resolveDateRange(preset: PeriodPreset, policy: AnalyticsPolicy, latest: string, earliest: string, custom?: DateRange): DateRange {
  const selected = policy.restricted ? 'last14' : preset;
  if (selected === 'all') return { start: earliest < latest ? earliest : latest, end: latest };
  if (selected === 'custom') return custom && custom.start <= custom.end ? custom : { start: latest, end: latest };
  return { start: dateKey(addDays(parseISO(latest), 1 - ROLLING_PERIOD_DAYS[selected])), end: latest };
}

/** Corrections to older entries must not move the window back. Skipped entries
 * still count as submitted dates; only an empty history uses the fallback date. */
export function resolveEntryDateRange(preset: PeriodPreset, policy: AnalyticsPolicy, entries: Iterable<WorkloadEntry>, fallbackDate: string, custom?: DateRange): DateRange {
  const reference = policy.referenceDate && /^\d{4}-\d{2}-\d{2}$/.test(policy.referenceDate) && isValid(parseISO(policy.referenceDate)) ? policy.referenceDate : undefined;
  const dates = Array.from(entries, entry => entry.date).filter(date => !reference || date >= reference).sort();
  const range = resolveDateRange(preset, policy, dates[dates.length - 1] ?? fallbackDate, reference ?? dates[0] ?? fallbackDate, custom);
  if (!reference) return range;
  return { start: range.start < reference ? reference : range.start, end: range.end < reference ? reference : range.end };
}

/** Input contains effective totals, never raw correction records. Weekly entries
 * belong to their recorded week-start date; we do not invent daily allocations. */
export function aggregateWorkload(entries: Iterable<WorkloadEntry>, range: DateRange): Map<string, WorkloadMetrics> {
  const days = differenceInCalendarDays(parseISO(range.end), parseISO(range.start)) + 1;
  if (!Number.isFinite(days) || days <= 0) throw new Error('Invalid analytics range');
  const result = new Map<string, WorkloadMetrics>();
  for (const entry of entries) {
    if (entry.skipped || entry.date < range.start || entry.date > range.end) continue;
    for (const subject of entry.subjectTimes) {
      const metrics = result.get(subject.subjectId) ?? { total: { classTime: 0, selfStudyTime: 0 }, weeklyAverage: { classTime: 0, selfStudyTime: 0 } };
      metrics.total.classTime += subject.classTime;
      metrics.total.selfStudyTime += subject.selfStudyTime;
      result.set(subject.subjectId, metrics);
    }
  }
  for (const metrics of result.values()) {
    metrics.weeklyAverage.classTime = metrics.total.classTime * 7 / days;
    metrics.weeklyAverage.selfStudyTime = metrics.total.selfStudyTime * 7 / days;
  }
  return result;
}
