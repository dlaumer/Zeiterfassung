import { ComponentProps, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ChartNoAxesColumn, ChevronDown, ChevronUp } from 'lucide-react';
import { aggregateWorkload, AnalyticsPolicy, DateRange, PeriodPreset, resolveEntryDateRange, WorkloadEntry } from '../../analytics/workload';
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
  const [showStatistics, setShowStatistics] = useState(false);
  const [preset, setPreset] = useState<PeriodPreset>('last14');
  const [custom, setCustom] = useState<DateRange>();
  const [today, setToday] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  useEffect(() => {
    const refresh = () => setToday(format(new Date(), 'yyyy-MM-dd'));
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener('focus', refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, []);
  const selectedPreset = policy.restricted ? 'last14' : preset;
  const range = resolveEntryDateRange(selectedPreset, policy, entries.values(), today, custom);
  const metrics = aggregateWorkload(entries.values(), range);
  return <CourseManagement {...courseProps}
    headerControls={
      <button type="button" aria-expanded={showStatistics}
        onClick={() => setShowStatistics(visible => !visible)}
        className={`mb-3 flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-indigo-500 ${showStatistics ? 'border-indigo-200 bg-indigo-100 text-indigo-800 hover:bg-indigo-200' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`}>
        <span className="flex items-center gap-2">
          <ChartNoAxesColumn className="h-4 w-4" aria-hidden="true" />
          {t(showStatistics ? 'analytics.hide' : 'analytics.show')}
        </span>
        {showStatistics ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
      </button>
    }
    beforeSubjects={<>
      {showStatistics && (status === 'ready' ?
      <TimeRangeFilter policy={policy} value={selectedPreset} range={range} onChange={(next, dates) => { setPreset(next); setCustom(dates); }} />
      : <p role="status" className="mb-4 text-sm text-gray-500">{t(`analytics.${status}`)}</p>)}
    </>}
    renderSubjectDetails={showStatistics && status === 'ready' ? subject => <SubjectStatistics metrics={metrics.get(subject.id)} color={subject.color} singleTime={singleTime} /> : undefined}
  />;
}
