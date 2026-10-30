import { ComponentProps, ReactNode, useMemo, useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { ChartNoAxesColumn, Eye, EyeOff } from 'lucide-react';
import { SubmissionPanels } from '../SubmissionPanels';
import { savedModuleEntries, completedWeekMetrics, AnalyticsPolicy, DateRange, PeriodPreset, resolveEntryDateRange, WorkloadEntry, WorkloadGrouping } from '../../analytics/workload';
import { CourseManagement, Subject } from '../CourseManagement';
import { WorkloadChartPanel } from './WorkloadChartPanel';
import { ChartTimeFilter } from './ChartDisplayControls';

import { SubjectStatistics } from './SubjectStatistics';
import { StatisticsOptions } from './StatisticsOptions';
import { useStatisticsUrl } from '../../analytics/statisticsUrl';
import { useI18n } from '../../i18n/i18n';

type Props = ComponentProps<typeof CourseManagement> & {
  entries: Map<string, WorkloadEntry>;
  policy: AnalyticsPolicy;
  status: 'loading' | 'ready' | 'error';
  singleTime?: boolean;
  daily?: boolean;
  participantRole?: 'student' | 'faculty';
  calendar: (collapsed: boolean, headerAction: ReactNode) => ReactNode;
};

export function SubjectAnalyticsPanel({ entries, policy, status, singleTime = false, daily = true, participantRole = 'student', calendar, ...courseProps }: Props) {
  const { t, language } = useI18n();
  const setting = useStatisticsUrl(daily);
  const [chartInitialized, setChartInitialized] = setting('initialized');
  const [zoom, setZoom] = setting('zoom');
  const [preset, setPreset] = setting('period');
  const [custom, setCustom] = setting('dates');
  const [grouping, setGrouping] = setting('group');
  const [valueMode, setValueMode] = setting('value');
  const [showModuleStatistics, setShowModuleStatistics] = setting('summaries');
  const [showBarTotals, setShowBarTotals] = setting('totals');
  const [workloadVisible, setWorkloadVisible] = setting('workload');
  const [showDataRating, setShowDataRating] = setting('rating');
  const [showEnergyLevel, setShowEnergyLevel] = setting('energy');
  const noVisibleModules = useMemo(() => new Set<string>(), []);
  const changeGrouping = (next: WorkloadGrouping) => {
    setGrouping(next);
    if ((next === 'daily' && valueMode !== 'total') || (next === 'weekly' && valueMode === 'weeklyAverage')) setValueMode('total');
  };
  const [chartSubject, setChartSubject] = useState<Subject>();
  const [chartVisible, setChartVisible] = setting('open');
  const [expandRequest, setExpandRequest] = useState(0);

  const [visible, setVisible] = setting('modules');
  const [hiddenCategories, setHiddenCategories] = setting('hidden');
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
  const moduleEntries = useMemo(() => savedModuleEntries(entries.values(), new Set(courseProps.subjects.map(subject => subject.id))), [entries, courseProps.subjects]);
  const selectedPreset = policy.restricted && preset !== 'custom' ? 'last2Weeks' : preset;
  const entryMode = daily ? 'day' : 'week';
  const rangeBounds = resolveEntryDateRange(policy.restricted ? 'last2Weeks' : 'all', policy, moduleEntries.values(), today, undefined, entryMode);
  const range = resolveEntryDateRange(selectedPreset, policy, moduleEntries.values(), today, custom, entryMode, grouping);
  const metrics = completedWeekMetrics(moduleEntries.values(), range, today, entryMode);
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
        {chartInitialized && status === 'ready' && <WorkloadChartPanel zoom={zoom} onZoomChange={setZoom} ratingEntries={entries} participantRole={participantRole} showDataRating={showDataRating} showEnergyLevel={showEnergyLevel} showBarTotals={showBarTotals} collapsed={collapsed} selected={chartSubject} subjects={courseProps.subjects}
          today={today} entries={moduleEntries} policy={policy} preset={selectedPreset} range={range} rangeBounds={rangeBounds} singleTime={singleTime} daily={daily}
          workloadVisible={workloadVisible} visible={workloadVisible ? visible : noVisibleModules} hiddenCategories={hiddenCategories} grouping={grouping} onGroupingChange={changeGrouping} valueMode={valueMode} onValueModeChange={setValueMode}
          timeFilter={timeFilter} onTimeFilterChange={changeTimeFilter} onRangeChange={changeRange} onClose={closeChart} />}
      </div>
    </div>
  </div>}><CourseManagement {...courseProps}
    beforeSubjects={<>
      {chartOpen && <StatisticsOptions showDataRating={showDataRating} onToggleDataRating={() => setShowDataRating(value => !value)} showEnergyLevel={showEnergyLevel} onToggleEnergyLevel={() => setShowEnergyLevel(value => !value)} showBarTotals={showBarTotals} onToggleBarTotals={() => setShowBarTotals(value => !value)} participantRole={participantRole} workloadVisible={workloadVisible} onWorkloadVisibleChange={setWorkloadVisible} showModuleStatistics={showModuleStatistics} onToggleModuleStatistics={() => setShowModuleStatistics(value => !value)} onShowAll={() => {
      setWorkloadVisible(true);
      setVisible(new Set(courseProps.subjects.map(subject => subject.id)));
      setHiddenCategories(new Set());
      }} />}
      {courseProps.beforeSubjects}
    </>}
    title={chartOpen ? t('analytics.legend') : courseProps.title}
    subjectListClassName={chartOpen ? 'border-l border-gray-200 pl-3' : courseProps.subjectListClassName}
    onOpenStatistics={!chartOpen && status === 'ready' ? openChart : undefined}
    onRemoveSubject={chartOpen ? undefined : courseProps.onRemoveSubject}
    isSubjectHidden={chartOpen ? subject => !workloadVisible || !visible.has(subject.id) : undefined}
    renderSubjectActions={chartOpen ? subject => eye(workloadVisible && visible.has(subject.id), subject[language === 'de' ? 'labelDe' : 'labelEn'], () => { if (!workloadVisible) { setWorkloadVisible(true); setVisible(current => new Set([...current, subject.id])); } else toggle(setVisible, subject.id); }) : undefined}
    renderSubjectDetails={chartOpen && status === 'ready' && showModuleStatistics ? subject => <SubjectStatistics metrics={metrics.get(subject.id)} color={subject.color} singleTime={singleTime} valueMode={valueMode}
      categoryHidden={chartOpen ? category => !workloadVisible || !visible.has(subject.id) || hiddenCategories.has(`${subject.id}:${category}`) : undefined}
      categoryAction={chartOpen && !singleTime ? category => eye(workloadVisible && visible.has(subject.id) && !hiddenCategories.has(`${subject.id}:${category}`), `${subject[language === 'de' ? 'labelDe' : 'labelEn']} · ${t(`analytics.${category}`)}`, () => {
        if (!workloadVisible || !visible.has(subject.id)) { setWorkloadVisible(true); setVisible(current => new Set([...current, subject.id])); setHiddenCategories(current => { const next = new Set(current); next.delete(`${subject.id}:${category}`); return next; }); }
        else toggle(setHiddenCategories, `${subject.id}:${category}`);
      }, true) : undefined} /> : undefined}
  />
  </SubmissionPanels>;
}
