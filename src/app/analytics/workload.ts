import { startOfWeek, endOfWeek, addDays, addMonths, addYears, startOfMonth, startOfYear, differenceInCalendarDays, format, parseISO, isValid } from 'date-fns';
import { roundQuarterHour } from '../time';
export { roundQuarterHour } from '../time';

export interface DateRange { start: string; end: string }
export type PeriodPreset = 'last2Weeks' | 'last4Weeks' | 'all' | 'custom';
export interface AnalyticsPolicy { restricted: boolean; reviewTimeWeeks?: number; referenceDate?: string }
export interface WorkloadEntry {
  date: string;
  reliability?: number;
  socialBattery?: number;
  comment?: string;
  comments?: string[];
  commuteTime?: number;
  adminEffort?: number;
  structuralChanges?: number;
  skipped?: boolean;
  subjectTimes: { subjectId: string; classTime: number; selfStudyTime: number }[];
}
export interface WorkloadMetrics {
  total: { classTime: number; selfStudyTime: number };
  weeklyAverage: { classTime: number; selfStudyTime: number };
}

export type WorkloadGrouping = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type ChartValueMode = 'total' | 'weeklyAverage' | 'dailyAverage';
export type AnalyticsEntryMode = 'day' | 'week';
export const formatStatisticsHours = (hours: number, language: string, mode: ChartValueMode = 'total') => new Intl.NumberFormat(language === 'de' ? 'de-CH' : 'en', { maximumFractionDigits: 2 }).format(mode === 'total' ? roundQuarterHour(hours) : hours);
export function workloadBarValue(total: number, range: DateRange, mode: ChartValueMode): number {
  const days = differenceInCalendarDays(parseISO(range.end), parseISO(range.start)) + 1;
  if (!Number.isFinite(days) || days <= 0) throw new Error('Invalid analytics range');
  return mode === 'total' ? roundQuarterHour(total) : total / days * (mode === 'weeklyAverage' ? 7 : 1);
}
export interface WorkloadBucket extends DateRange { metrics: Map<string, WorkloadMetrics> }

export function collectPeriodComments(entries: Iterable<WorkloadEntry>, range: DateRange, entryMode: AnalyticsEntryMode = 'day') {
  return Array.from(entries).filter(entry => {
    const end = entryMode === 'week' ? dateKey(addDays(parseISO(entry.date), 6)) : entry.date;
    return !entry.skipped && entry.date <= range.end && end >= range.start;
  }).sort((a, b) => a.date.localeCompare(b.date)).flatMap(entry => {
    const comments = entry.comments?.length ? entry.comments : [entry.comment ?? ''];
    return comments.map(comment => comment.trim()).filter(Boolean).map(comment => ({ date: entry.date, comment }));
  });
}

/** Ratings are submission averages, weighted by overlapping days for weekly entries. */
export function averageRatings(entries: Iterable<WorkloadEntry>, range: DateRange, entryMode: AnalyticsEntryMode = 'day') {
  const sums = { reliability: 0, socialBattery: 0 };
  const counts = { reliability: 0, socialBattery: 0 };
  for (const entry of entries) {
    const end = entryMode === 'week' ? dateKey(addDays(parseISO(entry.date), 6)) : entry.date;
    if (entry.skipped || end < range.start || entry.date > range.end) continue;
    const weight = differenceInCalendarDays(parseISO(end < range.end ? end : range.end), parseISO(entry.date > range.start ? entry.date : range.start)) + 1;
    for (const key of ['reliability', 'socialBattery'] as const) {
      const value = entry[key];
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 1 || value > 5) continue;
      sums[key] += value * weight;
      counts[key] += weight;
    }
  }
  return {
    reliability: counts.reliability ? sums.reliability / counts.reliability : null,
    socialBattery: counts.socialBattery ? sums.socialBattery / counts.socialBattery : null,
  };
}

/** Weeks follow Monday–Sunday calendar boundaries.
 * Months and years follow calendar boundaries. Weekly totals are allocated by overlapping days. */
export function bucketWorkload(entries: Iterable<WorkloadEntry>, range: DateRange, grouping: WorkloadGrouping, entryMode: AnalyticsEntryMode = 'day'): WorkloadBucket[] {
  const days = differenceInCalendarDays(parseISO(range.end), parseISO(range.start)) + 1;
  if (!Number.isFinite(days) || days <= 0) throw new Error('Invalid analytics range');
  const ranges: DateRange[] = [];
  if (grouping === 'weekly') {
    let cursor = startOfWeek(parseISO(range.start), { weekStartsOn: 1 });
    while (dateKey(cursor) <= range.end) {
      const start = dateKey(cursor);
      const end = dateKey(addDays(cursor, 6));
      ranges.push({ start: start < range.start ? range.start : start, end: end > range.end ? range.end : end });
      cursor = addDays(cursor, 7);
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
  return ranges.map(bucket => ({ ...bucket, metrics: aggregateWorkload(records, bucket, entryMode) }));
}

const dateKey = (date: Date) => format(date, 'yyyy-MM-dd');

export const calendarWeekStart = (date: string) => dateKey(startOfWeek(parseISO(date), { weekStartsOn: 1 }));
export const calendarWeekEnd = (date: string) => dateKey(endOfWeek(parseISO(date), { weekStartsOn: 1 }));

/** Presets include completed calendar weeks plus the entire current week. */
export function resolveDateRange(preset: PeriodPreset, policy: AnalyticsPolicy, today: string, earliest: string, custom?: DateRange, grouping: WorkloadGrouping = 'weekly'): DateRange {
  const selected = policy.restricted && preset !== 'custom' ? 'last2Weeks' : preset;
  const weeks = policy.reviewTimeWeeks ?? 2;
  const monday = calendarWeekStart(today);
  const end = calendarWeekEnd(today);
  const alignStart = (date: string) => grouping === 'daily' ? date : calendarWeekStart(date);
  if (selected === 'all') return { start: alignStart(earliest < today ? earliest : today), end };
  if (selected === 'custom' && custom && custom.start <= custom.end && [custom.start, custom.end].every(value => /^\d{4}-\d{2}-\d{2}$/.test(value) && isValid(parseISO(value)))) {
    const minimum = dateKey(addDays(parseISO(monday), -weeks * 7));
    const clamp = (date: string) => date < minimum ? minimum : date > end ? end : date;
    return {
      start: policy.restricted ? clamp(custom.start) : custom.start,
      end: policy.restricted ? clamp(custom.end) : custom.end,
    };
  }
  return { start: dateKey(addDays(parseISO(monday), policy.restricted ? -weeks * 7 : selected === 'last4Weeks' ? -28 : -14)), end };
}

/** Keep history for saved modules, including explicit zero-hour submissions. */
export function savedModuleEntries(entries: Iterable<WorkloadEntry>, subjectIds: ReadonlySet<string>): Map<string, WorkloadEntry> {
  return new Map(Array.from(entries).flatMap(entry => {
    const subjectTimes = entry.subjectTimes.filter(subject => subjectIds.has(subject.subjectId));
    return !entry.skipped && subjectTimes.length ? [[entry.date, { ...entry, subjectTimes }] as const] : [];
  }));
}

export function resolveEntryDateRange(preset: PeriodPreset, policy: AnalyticsPolicy, entries: Iterable<WorkloadEntry>, today: string, custom?: DateRange, entryMode: AnalyticsEntryMode = 'day', grouping: WorkloadGrouping = 'weekly'): DateRange {
  const dates = Array.from(entries, entry => entry.date).sort();
  return resolveDateRange(preset, policy, today, dates[0] ?? today, custom, grouping);
}

/** Only complete Mo–Su weeks wholly inside the selection and before the current week. */
export function completedWeeksRange(range: DateRange, today: string): DateRange | undefined {
  const firstMonday = calendarWeekStart(range.start);
  const start = firstMonday === range.start ? firstMonday : dateKey(addDays(parseISO(firstMonday), 7));
  const lastSunday = calendarWeekEnd(range.end);
  const selectedEnd = lastSunday === range.end ? lastSunday : dateKey(addDays(parseISO(lastSunday), -7));
  const completedEnd = dateKey(addDays(parseISO(calendarWeekStart(today)), -1));
  const end = selectedEnd < completedEnd ? selectedEnd : completedEnd;
  return start <= end ? { start, end } : undefined;
}

export function completedWeekMetrics(entries: Iterable<WorkloadEntry>, range: DateRange, today: string, entryMode: AnalyticsEntryMode = 'day') {
  const completeRange = completedWeeksRange(range, today);
  return completeRange ? aggregateWorkload(entries, completeRange, entryMode) : new Map<string, WorkloadMetrics>();
}

/** Each input is rounded before summation. Weekly totals use their seven-day overlap,
 * without rounding intermediate allocations or averages. Stored entries stay unchanged. */
export function aggregateWorkload(entries: Iterable<WorkloadEntry>, range: DateRange, entryMode: AnalyticsEntryMode = 'day'): Map<string, WorkloadMetrics> {
  const days = differenceInCalendarDays(parseISO(range.end), parseISO(range.start)) + 1;
  if (!Number.isFinite(days) || days <= 0) throw new Error('Invalid analytics range');
  const result = new Map<string, WorkloadMetrics>();
  for (const entry of entries) {
    const entryEnd = entryMode === 'week' ? dateKey(addDays(parseISO(entry.date), 6)) : entry.date;
    if (entry.skipped || entryEnd < range.start || entry.date > range.end) continue;
    const overlapStart = entry.date < range.start ? range.start : entry.date;
    const overlapEnd = entryEnd > range.end ? range.end : entryEnd;
    const weight = entryMode === 'week' ? (differenceInCalendarDays(parseISO(overlapEnd), parseISO(overlapStart)) + 1) / 7 : 1;
    for (const subject of entry.subjectTimes) {
      const metrics = result.get(subject.subjectId) ?? { total: { classTime: 0, selfStudyTime: 0 }, weeklyAverage: { classTime: 0, selfStudyTime: 0 } };
      metrics.total.classTime += roundQuarterHour(subject.classTime) * weight;
      metrics.total.selfStudyTime += roundQuarterHour(subject.selfStudyTime) * weight;
      result.set(subject.subjectId, metrics);
    }
  }
  for (const metrics of result.values()) {
    metrics.weeklyAverage.classTime = metrics.total.classTime * 7 / days;
    metrics.weeklyAverage.selfStudyTime = metrics.total.selfStudyTime * 7 / days;
  }
  return result;
}
