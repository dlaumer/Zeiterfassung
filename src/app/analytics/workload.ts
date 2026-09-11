import { addDays, differenceInCalendarDays, format, parseISO, startOfMonth, startOfWeek } from 'date-fns';

export interface DateRange { start: string; end: string }
export type PeriodPreset = 'review' | 'today' | 'week' | 'month' | 'all' | 'custom';
export interface AnalyticsPolicy { reviewDays: number; restricted: boolean }
export interface WorkloadEntry {
  date: string;
  skipped?: boolean;
  subjectTimes: { subjectId: string; classTime: number; selfStudyTime: number }[];
}
export interface WorkloadMetrics {
  total: { classTime: number; selfStudyTime: number };
  weeklyAverage: { classTime: number; selfStudyTime: number };
}

const dateKey = (date: Date) => format(date, 'yyyy-MM-dd');

/** Calendar days, inclusive of today. A zero-day review setting means today only. */
export function resolveDateRange(preset: PeriodPreset, policy: AnalyticsPolicy, today: string, earliest: string, custom?: DateRange): DateRange {
  const end = today;
  const anchor = parseISO(today);
  if (policy.restricted || preset === 'review') {
    if (!Number.isInteger(policy.reviewDays) || policy.reviewDays < 0) throw new Error('Invalid review period');
    return { start: dateKey(addDays(anchor, 1 - Math.max(1, policy.reviewDays))), end };
  }
  switch (preset) {
    case 'today': return { start: end, end };
    case 'week': return { start: dateKey(startOfWeek(anchor, { weekStartsOn: 1 })), end };
    case 'month': return { start: dateKey(startOfMonth(anchor)), end };
    case 'all': return { start: earliest < today ? earliest : today, end };
    case 'custom': return custom && custom.start <= custom.end ? custom : { start: end, end };
  }
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
