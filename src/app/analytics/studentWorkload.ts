import { WorkloadEntry } from './workload';

export const STUDENT_WORKLOAD = [
  { id: 'extra:commute', field: 'commuteTime', label: 'dailyEntry.commute', color: '#64748b' },
  { id: 'extra:admin', field: 'adminEffort', label: 'dailyEntry.adminEffort', color: '#a88168' },
] as const;

/** Stored supplemental times are already hours; keep them separate from module time. */
export function withStudentWorkload(entries: Iterable<WorkloadEntry>, modules: Map<string, WorkloadEntry>, enabled: ReadonlySet<string>) {
  return new Map(Array.from(entries).flatMap(entry => {
    if (entry.skipped) return [];
    const extras = STUDENT_WORKLOAD.filter(item => enabled.has(item.id)).map(item => {
      const value = entry[item.field];
      return { subjectId: item.id, classTime: typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0, selfStudyTime: 0 };
    }).filter(item => item.classTime > 0);
    const subjectTimes = [...(modules.get(entry.date)?.subjectTimes ?? []), ...extras];
    return subjectTimes.length ? [[entry.date, { ...entry, subjectTimes }] as const] : [];
  }));
}
