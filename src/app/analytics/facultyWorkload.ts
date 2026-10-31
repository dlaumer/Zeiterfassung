import { aggregateWorkload, completedWeekMetrics, AnalyticsEntryMode, DateRange, WorkloadEntry } from './workload';

export const FACULTY_MARKERS = [
  { key: 'adminEffort', label: 'dailyEntry.adminEffort', color: '#a88168', side: -1 },
  { key: 'structuralChanges', label: 'weeklyEntry.structuralChanges', color: '#64748b', side: 1 },
] as const;

export function completedFacultyWorkloadMetrics(entries: Iterable<WorkloadEntry>, range: DateRange, today: string, mode: AnalyticsEntryMode) {
  return completedWeekMetrics(Array.from(entries, entry => ({ ...entry, subjectTimes: FACULTY_MARKERS.map(item => ({
    subjectId: item.key, classTime: Math.max(0, Number(entry[item.key]) || 0), selfStudyTime: 0,
  })) })), range, today, mode);
}

/** Aggregate hours before dividing so weeks with different workloads are weighted correctly. */
export function facultyWorkloadShares(entries: Iterable<WorkloadEntry>, range: DateRange, mode: AnalyticsEntryMode) {
  const records = Array.from(entries, entry => ({ ...entry, subjectTimes: [
    { subjectId: 'total', classTime: entry.subjectTimes.reduce((sum, item) => sum + Math.max(0, item.classTime || 0), 0), selfStudyTime: 0 },
    ...FACULTY_MARKERS.map(item => ({ subjectId: item.key, classTime: Math.max(0, Number(entry[item.key]) || 0), selfStudyTime: 0 })),
  ] }));
  const metrics = aggregateWorkload(records, range, mode);
  const total = metrics.get('total')?.total.classTime ?? 0;
  return FACULTY_MARKERS.map(item => {
    const hours = metrics.get(item.key)?.total.classTime ?? 0;
    return { ...item, hours, totalWorkload: total, fraction: total > 0 ? Math.min(1, hours / total) : 0, hasData: metrics.has('total') };
  });
}
