import { ComponentProps, ReactNode, useMemo, useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { Bike, ClipboardList, TrainFront, Wrench, ChartNoAxesColumn, Eye, EyeOff, X } from 'lucide-react';
import { SubmissionPanels } from '../SubmissionPanels';
import { savedModuleEntries, completedWeekMetrics, AnalyticsPolicy, DateRange, PeriodPreset, resolveEntryDateRange, WorkloadEntry, WorkloadGrouping } from '../../analytics/workload';
import { CourseManagement, Subject } from '../CourseManagement';
import { WorkloadChartPanel } from './WorkloadChartPanel';
import { ChartTimeFilter } from './ChartDisplayControls';

import { SubjectStatistics } from './SubjectStatistics';
import { StatisticsOptions } from './StatisticsOptions';
import { useStatisticsUrl } from '../../analytics/statisticsUrl';
import { useI18n } from '../../i18n/i18n';
import { STUDENT_WORKLOAD, withStudentWorkload } from '../../analytics/studentWorkload';
import { StatisticsCard } from './StatisticsCard';
import { getSubjectDisplayName } from '../CourseManagement';
import { FACULTY_MARKERS, completedFacultyWorkloadMetrics } from '../../analytics/facultyWorkload';

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
  const [showDataRating, setShowDataRating] = setting('rating');
  const [showEnergyLevel, setShowEnergyLevel] = setting('energy');
  const [showCommute, setShowCommute] = setting('commute');
  const [showAdmin, setShowAdmin] = setting('admin');
  const [showStructural, setShowStructural] = setting('structural');
  const [adminHidden, setAdminHidden] = setting('adminHidden');
  const [structuralHidden, setStructuralHidden] = setting('structuralHidden');
  const facultyTopics = participantRole === 'faculty' ? FACULTY_MARKERS.filter(item => item.key === 'adminEffort' ? showAdmin : showStructural) : [];
  const extras = participantRole === 'student' ? STUDENT_WORKLOAD.filter(item => item.field === 'commuteTime' ? showCommute : showAdmin) : [];
  const extraSubjects: Subject[] = extras.map(item => ({ id: item.id, key: item.id, labelDe: t(item.label), labelEn: t(item.label), color: item.color, credits: 0, supplemental: true }));
  const chartSubjects = [...courseProps.subjects, ...extraSubjects];
  const changeExtra = (id: string, enabled: boolean, setter: typeof setShowCommute) => {
    setter(!enabled);
    if (!enabled) setVisible(current => new Set([...current, id]));
    if (!enabled && participantRole === 'faculty' && id === 'extra:admin') setAdminHidden(false);
  };
  const changeGrouping = (next: WorkloadGrouping) => {
    setGrouping(next);
    if ((next === 'daily' && valueMode !== 'total') || (next === 'weekly' && valueMode === 'weeklyAverage')) setValueMode('total');
  };
  const [chartSubject, setChartSubject] = useState<Subject>();
  const [chartVisible, setChartVisible] = setting('open');
  const [expandRequest, setExpandRequest] = useState(0);

  const [visible, setVisible] = setting('modules');
  const [hiddenCategories, setHiddenCategories] = setting('hidden');
  const moduleCategories = singleTime ? ['classTime'] : ['classTime', 'selfStudyTime'];
  const allModulesVisible = courseProps.subjects.length > 0 && courseProps.subjects.every(subject => visible.has(subject.id) && moduleCategories.every(category => !hiddenCategories.has(subject.id + ':' + category)));
  const toggleAllModules = () => {
    const ids = new Set(courseProps.subjects.map(subject => subject.id));
    setVisible(current => {
      const next = new Set(current);
      for (const id of ids) { if (allModulesVisible) next.delete(id); else next.add(id); }
      return next;
    });
    if (!allModulesVisible) setHiddenCategories(current => {
      const next = new Set(current);
      for (const id of ids) for (const category of moduleCategories) next.delete(id + ':' + category);
      return next;
    });
  };
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
  const chartEntries = useMemo(() => participantRole === 'student' ? withStudentWorkload(entries.values(), moduleEntries, new Set([...(showCommute ? ['extra:commute'] : []), ...(showAdmin ? ['extra:admin'] : [])])) : moduleEntries, [entries, moduleEntries, participantRole, showCommute, showAdmin]);
  const selectedPreset = policy.restricted && preset !== 'custom' ? 'last2Weeks' : preset;
  const entryMode = daily ? 'day' : 'week';
  // Supplemental hours never extend the history defined by the saved modules.
  const rangeBounds = resolveEntryDateRange(policy.restricted ? 'last2Weeks' : 'all', policy, moduleEntries.values(), today, undefined, entryMode);
  const range = resolveEntryDateRange(selectedPreset, policy, moduleEntries.values(), today, custom, entryMode, grouping);
  const metrics = completedWeekMetrics(chartEntries.values(), range, today, entryMode);
  const facultyMetrics = useMemo(() => participantRole === 'faculty' ? completedFacultyWorkloadMetrics(entries.values(), range, today, entryMode) : new Map(), [participantRole, entries, range.start, range.end, today, entryMode]);
  const changeRange = (next: PeriodPreset, dates?: DateRange) => { setPreset(next); setCustom(dates); };
  const openChart = (subject: Subject) => { setExpandRequest(value => value + 1); triggerRef.current = document.activeElement as HTMLElement; setChartSubject(subject); setChartInitialized(true); setChartVisible(true); setVisible(new Set([subject.id])); setHiddenCategories(new Set()); };
  const openOverview = () => {
    setExpandRequest(value => value + 1);
    triggerRef.current = document.activeElement as HTMLElement;
    if (!chartInitialized) {
      setVisible(new Set(chartSubjects.map(subject => subject.id)));
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
        {chartInitialized && status === 'ready' && <WorkloadChartPanel showFacultyAdmin={showAdmin && !adminHidden} showFacultyStructural={showStructural && !structuralHidden} zoom={zoom} onZoomChange={setZoom} ratingEntries={entries} participantRole={participantRole} showDataRating={showDataRating} showEnergyLevel={showEnergyLevel} showBarTotals={showBarTotals} collapsed={collapsed} selected={chartSubject} subjects={chartSubjects}
          today={today} entries={chartEntries} policy={policy} preset={selectedPreset} range={range} rangeBounds={rangeBounds} singleTime={singleTime} daily={daily}
          visible={visible} hiddenCategories={hiddenCategories} grouping={grouping} onGroupingChange={changeGrouping} valueMode={valueMode} onValueModeChange={setValueMode}
          timeFilter={timeFilter} onTimeFilterChange={changeTimeFilter} onRangeChange={changeRange} onClose={closeChart} />}
      </div>
    </div>
  </div>}>{modulesCollapsed => <CourseManagement {...courseProps} collapsed={modulesCollapsed}
    beforeSubjects={<>
      {chartOpen && <StatisticsOptions showStructural={showStructural} onToggleStructural={() => { if (!showStructural) setStructuralHidden(false); setShowStructural(value => !value); }} showCommute={showCommute} onToggleCommute={() => changeExtra("extra:commute", showCommute, setShowCommute)} showAdmin={showAdmin} onToggleAdmin={() => changeExtra("extra:admin", showAdmin, setShowAdmin)} showDataRating={showDataRating} onToggleDataRating={() => setShowDataRating(value => !value)} showEnergyLevel={showEnergyLevel} onToggleEnergyLevel={() => setShowEnergyLevel(value => !value)} showBarTotals={showBarTotals} onToggleBarTotals={() => setShowBarTotals(value => !value)} participantRole={participantRole} showModuleStatistics={showModuleStatistics} onToggleModuleStatistics={() => setShowModuleStatistics(value => !value)} allModulesVisible={allModulesVisible} onToggleAllModules={toggleAllModules} />}
      {chartOpen && extraSubjects.length > 0 && <div className="mb-3 space-y-2 border-l border-gray-200 pl-3">
        {extraSubjects.map(subject => <StatisticsCard key={subject.id}
          actions={eye(visible.has(subject.id), getSubjectDisplayName(subject, language), () => toggle(setVisible, subject.id))}
          statistics={showModuleStatistics ? <SubjectStatistics metrics={metrics.get(subject.id)} color={subject.color} singleTime valueMode={valueMode} categoryHidden={() => !visible.has(subject.id)} /> : undefined}>
          <div className={`flex min-w-0 items-center gap-3 ${visible.has(subject.id) ? '' : 'opacity-40 grayscale'}`}><span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: subject.color }} /><span className="break-words text-sm font-medium text-gray-700">{getSubjectDisplayName(subject, language)}<span aria-hidden="true" className="ml-2 inline-flex items-center gap-1 align-middle">{subject.id === 'extra:commute' ? <><Bike className="h-4 w-4" /><TrainFront className="h-4 w-4" /></> : <ClipboardList className="h-4 w-4" />}</span></span></div>
        </StatisticsCard>)}
      </div>}
      {chartOpen && facultyTopics.length > 0 && <div className="mb-3 space-y-2 border-l border-gray-200 pl-3">
        {facultyTopics.map(topic => {
          const hidden = topic.key === 'adminEffort' ? adminHidden : structuralHidden;
          const setHidden = topic.key === 'adminEffort' ? setAdminHidden : setStructuralHidden;
          const setEnabled = topic.key === 'adminEffort' ? setShowAdmin : setShowStructural;
          return <StatisticsCard key={topic.key} actions={<>
            {eye(!hidden, t(topic.label), () => setHidden(value => !value))}
            <button type="button" aria-label={`${t('common.remove')}: ${t(topic.label)}`} onClick={() => setEnabled(false)} className="rounded p-1 text-gray-500 hover:bg-gray-200 focus-visible:outline-2 focus-visible:outline-indigo-500"><X className="h-4 w-4" /></button>
          </>} statistics={showModuleStatistics ? <SubjectStatistics metrics={facultyMetrics.get(topic.key)} color={topic.color} singleTime valueMode={valueMode} categoryHidden={() => hidden} /> : undefined}>
            <div className={`flex min-w-0 items-center gap-3 ${hidden ? 'opacity-40 grayscale' : ''}`}><span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-full ring-2 ring-white" style={{ backgroundColor: topic.color }} /><span className="break-words text-sm font-medium text-gray-700">{t(topic.label)}<span aria-hidden="true" className="ml-2 inline-flex align-middle">{topic.key === 'adminEffort' ? <ClipboardList className="h-4 w-4" /> : <Wrench className="h-4 w-4" />}</span></span></div>
          </StatisticsCard>;
        })}
      </div>}
      {courseProps.beforeSubjects}
    </>}
    title={chartOpen ? t('analytics.legend') : courseProps.title}
    subjectListClassName={chartOpen ? 'border-l border-gray-200 pl-3' : courseProps.subjectListClassName}
    onOpenStatistics={!chartOpen && status === 'ready' ? openChart : undefined}
    onRemoveSubject={chartOpen ? undefined : courseProps.onRemoveSubject}
    isSubjectHidden={chartOpen ? subject => !visible.has(subject.id) : undefined}
    renderSubjectActions={chartOpen ? subject => eye(visible.has(subject.id), subject[language === 'de' ? 'labelDe' : 'labelEn'], () => toggle(setVisible, subject.id)) : undefined}
    renderSubjectDetails={chartOpen && status === 'ready' && showModuleStatistics ? subject => <SubjectStatistics metrics={metrics.get(subject.id)} color={subject.color} singleTime={singleTime} valueMode={valueMode}
      categoryHidden={chartOpen ? category => !visible.has(subject.id) || hiddenCategories.has(`${subject.id}:${category}`) : undefined}
      categoryAction={chartOpen && !singleTime ? category => eye(visible.has(subject.id) && !hiddenCategories.has(`${subject.id}:${category}`), `${subject[language === 'de' ? 'labelDe' : 'labelEn']} · ${t(`analytics.${category}`)}`, () => {
        if (!visible.has(subject.id)) { setVisible(current => new Set([...current, subject.id])); setHiddenCategories(current => { const next = new Set(current); next.delete(`${subject.id}:${category}`); return next; }); }
        else toggle(setHiddenCategories, `${subject.id}:${category}`);
      }, true) : undefined} /> : undefined}
  />}
  </SubmissionPanels>;
}
