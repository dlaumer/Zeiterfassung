import { ComponentProps, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { aggregateWorkload, AnalyticsPolicy, DateRange, PeriodPreset, resolveDateRange, WorkloadEntry } from '../../analytics/workload';
import { CourseManagement } from '../CourseManagement';
import { TimeRangeFilter } from './TimeRangeFilter';
import { SubjectStatistics } from './SubjectStatistics';
import { useI18n } from '../../i18n/i18n';

type Props = ComponentProps<typeof CourseManagement> & {
  entries: Map<string, WorkloadEntry>;
  policy: AnalyticsPolicy;
  status: 'loading' | 'ready' | 'error';
  singleTime?: boolean;
};

export function SubjectAnalyticsPanel({ entries, policy, status, singleTime = false, ...courseProps }: Props) {
  const { t } = useI18n();
  const [preset, setPreset] = useState<PeriodPreset>('review');
  const [custom, setCustom] = useState<DateRange>();
  const [today, setToday] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  useEffect(() => {
    const refresh = () => setToday(format(new Date(), 'yyyy-MM-dd'));
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener('focus', refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, []);
  const selectedPreset = policy.restricted ? 'review' : preset;
  const earliest = [...entries.keys()].sort()[0] ?? today;
  const range = resolveDateRange(selectedPreset, policy, today, earliest, custom);
  const metrics = aggregateWorkload(entries.values(), range);
  return <CourseManagement {...courseProps}
    beforeSubjects={status === 'ready' ? <>
      <TimeRangeFilter policy={policy} value={selectedPreset} range={range} onChange={(next, dates) => { setPreset(next); setCustom(dates); }} />
    </> : <p role="status" className="mb-4 text-sm text-gray-500">{t(`analytics.${status}`)}</p>}
    renderSubjectDetails={status === 'ready' ? subject => <SubjectStatistics metrics={metrics.get(subject.id)} color={subject.color} singleTime={singleTime} /> : undefined}
  />;
}
