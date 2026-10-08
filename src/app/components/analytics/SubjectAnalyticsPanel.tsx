import { ComponentProps, ReactNode, useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { ChartNoAxesColumn, Eye, EyeOff } from 'lucide-react';
import { SubmissionPanels } from '../SubmissionPanels';
import { aggregateWorkload, bucketWorkload, AnalyticsPolicy, DateRange, PeriodPreset, resolveEntryDateRange, WorkloadEntry, WorkloadGrouping } from '../../analytics/workload';
import { CourseManagement, Subject } from '../CourseManagement';
import { WorkloadChartPanel } from './WorkloadChartPanel';
import { ChartTimeFilter, ChartValueMode } from './ChartDisplayControls';

import { SubjectStatistics } from './SubjectStatistics';
import { useI18n } from '../../i18n/i18n';

type Props = ComponentProps<typeof CourseManagement> & {
  entries: Map<string, WorkloadEntry>;
  policy: AnalyticsPolicy;
  status: 'loading' | 'ready' | 'error';
  singleTime?: boolean;
  daily?: boolean;
  calendar: (collapsed: boolean, headerAction: ReactNode) => ReactNode;
};

export function SubjectAnalyticsPanel({ entries, policy, status, singleTime = false, daily = true, calendar, ...courseProps }: Props) {
  const { t, language } = useI18n();
  const [chartInitialized, setChartInitialized] = useState(false);
  const [preset, setPreset] = useState<PeriodPreset>('last14');
  const [custom, setCustom] = useState<DateRange>();
  const [grouping, setGrouping] = useState<WorkloadGrouping>('weekly');
  const [valueMode, setValueMode] = useState<ChartValueMode>('total');
  const [chartSubject, setChartSubject] = useState<Subject>();
  const [chartVisible, setChartVisible] = useState(false);
  const [expandRequest, setExpandRequest] = useState(0);

  const [visible, setVisible] = useState<Set<string>>(new Set());
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set());
  const timeFilter: ChartTimeFilter | undefined = hiddenCategories.size === 0 ? 'all'
    : courseProps.subjects.every(subject => hiddenCategories.has(`${subject.id}:classTime`) && !hiddenCategories.has(`${subject.id}:selfStudyTime`)) ? 'study'
    : courseProps.subjects.every(subject => hiddenCategories.has(`${subject.id}:selfStudyTime`) && !hiddenCategories.has(`${subject.id}:classTime`)) ? 'class' : undefined;
  const changeTimeFilter = (filter: ChartTimeFilter) => {
    setHiddenCategories(new Set(filter === 'all' ? [] : courseProps.subjects.map(subject => `${subject.id}:${filter === 'study' ? 'classTime' : 'selfStudyTime'}`)));
  };
  const frontRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const chartOpen = chartVisible && status === 'ready';
  useEffect(() => {
    if (frontRef.current) frontRef.current.inert = chartOpen;
    if (backRef.current) backRef.current.inert = !chartOpen;
    if (chartOpen) backRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
  }, [chartOpen]);
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
  const periodCount = bucketWorkload([], range, grouping).length;
  const changeRange = (next: PeriodPreset, dates?: DateRange) => { setPreset(next); setCustom(dates); };
  const openChart = (subject: Subject) => { setExpandRequest(value => value + 1); triggerRef.current = document.activeElement as HTMLElement; setChartSubject(subject); setChartInitialized(true); setChartVisible(true); setVisible(new Set([subject.id])); setHiddenCategories(new Set()); };
  const openOverview = () => {
    setExpandRequest(value => value + 1);
    triggerRef.current = document.activeElement as HTMLElement;
    if (!chartInitialized) {
      setVisible(new Set(courseProps.subjects.map(subject => subject.id)));
      setChartInitialized(true);
    }
    setChartSubject(undefined);
    setChartVisible(true);
  };
  const statisticsButton = <button type="button" onClick={openOverview} disabled={status !== 'ready'} aria-expanded={chartOpen}
    className="flex shrink-0 items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-indigo-500 disabled:opacity-40">
    <ChartNoAxesColumn className="h-4 w-4" />{t('analytics.statistics')}
  </button>;
  const closeChart = () => {
    setExpandRequest(value => value + 1);
    setChartVisible(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };
  const toggle = (setter: typeof setVisible, key: string) => setter(current => { const next = new Set(current); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  const eye = (shown: boolean, label: string, action: () => void, small = false) => <button type="button" aria-pressed={shown} aria-label={`${t(shown ? 'analytics.hideSeries' : 'analytics.showSeries')}: ${label}`} onClick={action}
    className={`flex shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-indigo-500 ${small ? 'h-6 w-6' : 'h-8 w-8'} ${shown ? 'text-gray-700' : 'text-gray-400'}`}>
    {shown ? <Eye className={small ? 'h-3 w-3' : 'h-4 w-4'} /> : <EyeOff className={small ? 'h-3 w-3' : 'h-4 w-4'} />}
  </button>;
  return <SubmissionPanels chartActive={chartOpen} expandRequest={expandRequest} calendar={collapsed => <div className="calendar-flip">
    <div className={`calendar-flip-inner ${chartOpen ? 'calendar-flip-open' : ''}`}>
      <div ref={frontRef} aria-hidden={chartOpen} className="calendar-flip-face">{calendar(collapsed, statisticsButton)}</div>
      <div ref={backRef} aria-hidden={!chartOpen} className="calendar-flip-face calendar-flip-back">
        {chartInitialized && status === 'ready' && <WorkloadChartPanel collapsed={collapsed} selected={chartSubject} subjects={courseProps.subjects}
          entries={entries} policy={policy} preset={selectedPreset} range={range} singleTime={singleTime} daily={daily}
          visible={visible} hiddenCategories={hiddenCategories} grouping={grouping} onGroupingChange={setGrouping} valueMode={valueMode} onValueModeChange={setValueMode}
          timeFilter={timeFilter} onTimeFilterChange={changeTimeFilter} onRangeChange={changeRange} onClose={closeChart} />}
      </div>
    </div>
  </div>}><CourseManagement {...courseProps}
    title={chartOpen ? t('analytics.legend') : courseProps.title}
    onOpenStatistics={!chartOpen && status === 'ready' ? openChart : undefined}
    onRemoveSubject={chartOpen ? undefined : courseProps.onRemoveSubject}
    isSubjectHidden={chartOpen ? subject => !visible.has(subject.id) : undefined}
    renderSubjectActions={chartOpen ? subject => eye(visible.has(subject.id), subject[language === 'de' ? 'labelDe' : 'labelEn'], () => toggle(setVisible, subject.id)) : undefined}
    renderSubjectDetails={chartOpen && status === 'ready' ? subject => <SubjectStatistics metrics={metrics.get(subject.id)} color={subject.color} singleTime={singleTime} grouping={grouping} periodCount={periodCount}
      categoryHidden={chartOpen ? category => !visible.has(subject.id) || hiddenCategories.has(`${subject.id}:${category}`) : undefined}
      categoryAction={chartOpen && !singleTime ? category => eye(visible.has(subject.id) && !hiddenCategories.has(`${subject.id}:${category}`), `${subject[language === 'de' ? 'labelDe' : 'labelEn']} · ${t(`analytics.${category}`)}`, () => {
        if (!visible.has(subject.id)) { setVisible(current => new Set([...current, subject.id])); setHiddenCategories(current => { const next = new Set(current); next.delete(`${subject.id}:${category}`); return next; }); }
        else toggle(setHiddenCategories, `${subject.id}:${category}`);
      }, true) : undefined} /> : undefined}
  />
  </SubmissionPanels>;
}
