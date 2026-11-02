import { facultyWorkloadShares } from '../../analytics/facultyWorkload';
import { useId, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { BatteryMedium, CalendarDays, MessageCircle, Star, ZoomIn, X } from 'lucide-react';
import { Bar, Customized, ComposedChart, Label, CartesianGrid, ReferenceArea, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { format, getISOWeek, getISOWeekYear, parseISO } from 'date-fns';
import { collectPeriodComments, averageRatings, completedWeeksRange, calendarWeekStart, calendarWeekEnd, workloadBarValue, formatStatisticsHours, AnalyticsPolicy, bucketWorkload, DateRange, PeriodPreset, WorkloadEntry, WorkloadGrouping } from '../../analytics/workload';
import { WORKLOAD_OPACITY } from '../../analytics/workloadColors';
import { useI18n } from '../../i18n/i18n';
import { getDateLocale } from '../../i18n/dateLocale';
import { compareSubjectsByDisplayName, getSubjectDisplayName, Subject } from '../CourseManagement';
import { TimeRangeFilter } from './TimeRangeFilter';
import { useAnimatedWorkload } from './useAnimatedWorkload';
import { ShareUrlButton } from '../ShareUrlButton';
import { CHART_TOGGLE_THUMB, CHART_TOGGLE_TRACK, ChartDisplayControls, ChartTimeFilter, ChartValueMode } from './ChartDisplayControls';

type Category = 'classTime' | 'selfStudyTime';
interface Props {
  showFacultyAdmin?: boolean;
  showFacultyStructural?: boolean;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  ratingEntries: Map<string, WorkloadEntry>;
  participantRole: 'student' | 'faculty';
  showDataRating: boolean;
  showEnergyLevel: boolean;
  showBarTotals?: boolean;
  today: string;
  collapsed?: boolean;
  selected?: Subject;
  subjects: Subject[];
  entries: Map<string, WorkloadEntry>;
  policy: AnalyticsPolicy;
  preset: PeriodPreset;
  range: DateRange;
  rangeBounds?: DateRange;
  singleTime: boolean;
  daily: boolean;
  visible: Set<string>;
  hiddenCategories: Set<string>;
  grouping: WorkloadGrouping;
  valueMode: ChartValueMode;
  onValueModeChange: (mode: ChartValueMode) => void;
  timeFilter?: ChartTimeFilter;
  onTimeFilterChange: (filter: ChartTimeFilter) => void;
  onGroupingChange: (grouping: WorkloadGrouping) => void;
  onRangeChange: (preset: PeriodPreset, range?: DateRange) => void;
  onClose: () => void;
}

export function WorkloadChartPanel({ showFacultyAdmin = false, showFacultyStructural = false, zoom, onZoomChange: setZoom, ratingEntries, participantRole, showDataRating, showEnergyLevel, showBarTotals = true, today, collapsed = false, selected, subjects, entries, policy, preset, range, rangeBounds, singleTime, daily, visible, hiddenCategories, grouping, onGroupingChange, valueMode, onValueModeChange, timeFilter, onTimeFilterChange, onRangeChange, onClose }: Props) {
  const { t, language } = useI18n();
  const [selectedPeriod, setSelectedPeriod] = useState<string>();
  const [showComments, setShowComments] = useState(false);
  useEffect(() => { setShowComments(false); }, [selectedPeriod]);
  const [chartWidth, setChartWidth] = useState(0);
  const [chartHeight, setChartHeight] = useState(0);
  const batteryGradient = useId().replace(/:/g, "");
  const chartRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (contentRef.current) contentRef.current.inert = collapsed; }, [collapsed]);
  const popupRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<SVGGraphicsElement | null>(null);
  const choosePeriod = (anchor: SVGGraphicsElement, period: string) => {
    anchorRef.current = anchor;
    setSelectedPeriod(current => current === period ? undefined : period);
  };
  const [popupPosition, setPopupPosition] = useState({ left: 12, top: 12 });
  useLayoutEffect(() => {
    const chart = chartRef.current;
    const popup = popupRef.current;
    if (!selectedPeriod || !chart || !popup) return;
    const position = () => {
      const candidates = Array.from(chart.querySelectorAll<SVGGraphicsElement>('[data-period][data-popup-visible="true"]'))
        .filter(element => element.dataset.period === selectedPeriod && element.getBBox().height > 0);
      const anchor = candidates.includes(anchorRef.current!) ? anchorRef.current : candidates[0];
      if (!anchor) { setSelectedPeriod(undefined); return; }
      anchorRef.current = anchor;
      const bar = anchor.getBoundingClientRect();
      const bounds = chart.getBoundingClientRect();
      const width = popup.offsetWidth;
      const height = popup.offsetHeight;
      const barLeft = bar.left - bounds.left - chart.clientLeft;
      const barRight = bar.right - bounds.left - chart.clientLeft;
      const beside = barRight + 10 + width <= chart.clientWidth - 12 ? barRight + 10 : barLeft - width - 10;
      const left = chart.scrollLeft + Math.max(12, Math.min(beside, chart.clientWidth - width - 12));
      const top = chart.scrollTop + Math.max(12, Math.min(bar.top - bounds.top + bar.height / 2 - height / 2, chart.clientHeight - height - 12));
      setPopupPosition(current => current.left === left && current.top === top ? current : { left, top });
    };
    position();
    const observer = new ResizeObserver(position);
    observer.observe(chart);
    observer.observe(popup);
    if (chart.firstElementChild) observer.observe(chart.firstElementChild);
    chart.addEventListener('scroll', position, { passive: true });
    return () => { observer.disconnect(); chart.removeEventListener('scroll', position); };
  }, [selectedPeriod, visible, hiddenCategories, showDataRating, showEnergyLevel, showFacultyAdmin, showFacultyStructural, language, zoom]);
  useEffect(() => { setSelectedPeriod(undefined); }, [grouping, valueMode, range.start, range.end]);
  useEffect(() => { if (zoom === 1 && chartRef.current) chartRef.current.scrollLeft = 0; }, [zoom]);
  const ordered = singleTime ? subjects : [...subjects].sort(compareSubjectsByDisplayName(language));
  const categories: Category[] = singleTime ? ['classTime'] : ['classTime', 'selfStudyTime'];
  const buckets = useMemo(() => bucketWorkload(Array.from(entries.values()).filter(entry => entry.date <= today), range, grouping, daily ? 'day' : 'week')
    .filter(bucket => grouping !== 'daily' || bucket.start <= today), [entries, range.start, range.end, grouping, daily, today]);

  const showRatings = showDataRating || showEnergyLevel;
  const workloadAxisWidth = 48;
  const ratingAxisWidth = showRatings ? 36 : 0;
  const chartRightMargin = 4;
  const ratings = useMemo(() => {
    const submitted = Array.from(ratingEntries.values()).filter(entry => entry.date <= today);
    return buckets.map(bucket => averageRatings(submitted, bucket, daily ? 'day' : 'week'));
  }, [ratingEntries, buckets, daily, today]);
  const ratingSeries = [
    { key: 'reliability' as const, shown: showDataRating, name: t('dailyEntry.reliability'), color: 'var(--color-amber-400)' },
    { key: 'socialBattery' as const, shown: showEnergyLevel && !showDataRating, name: t(`socialBattery.${participantRole}`), color: '#2ca468' },
  ];
  const number = new Intl.NumberFormat(language === 'de' ? 'de-CH' : 'en', { maximumFractionDigits: 2 });
  const date = (value: string) => format(parseISO(value), 'dd.MM.yyyy');
  const weekdays = language === 'de' ? ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'] : ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const allSeries = categories.flatMap(category => ordered.filter(subject => !subject.supplemental || category === 'classTime').map(subject => ({
    subject, category, key: `series:${subject.id}:${category}`, name: `${getSubjectDisplayName(subject, language)}${singleTime || subject.supplemental ? '' : ` · ${t(`analytics.${category}`)}`}`,
  })));
  const isSeriesVisible = ({ subject, category }: typeof allSeries[number]) => visible.has(subject.id) && (subject.supplemental || !hiddenCategories.has(`${subject.id}:${category}`));
  const series = allSeries.filter(isSeriesVisible);
  const bucketWidth = Math.max(0, chartWidth - workloadAxisWidth - ratingAxisWidth - chartRightMargin) / Math.max(1, buckets.length);
  const compactWeekLabels = grouping === 'weekly' && chartWidth > 0 && bucketWidth < 100;
  const crossesWeekYear = new Set(buckets.map(bucket => getISOWeekYear(parseISO(bucket.end)))).size > 1;
  const data = buckets.map(bucket => ({
    label: grouping === 'weekly' ? compactWeekLabels
      ? `${language === 'de' ? 'KW' : 'CW'}${getISOWeek(parseISO(bucket.end))}${crossesWeekYear ? `/${getISOWeekYear(parseISO(bucket.end))}` : ''}`
      : `${format(parseISO(bucket.start), 'dd.MM.')}–${format(parseISO(bucket.end), 'dd.MM.')}`
      : grouping === 'monthly' ? format(parseISO(bucket.start), 'MM.yyyy') : grouping === 'yearly' ? bucket.start.slice(0, 4) : `${weekdays[parseISO(bucket.start).getDay()]} ${format(parseISO(bucket.start), 'dd.MM.')}`,
    period: grouping === 'daily' ? format(parseISO(bucket.start), 'EEEE, dd.MM.yyyy', { locale: getDateLocale(language) }) : `${date(bucket.start)} – ${date(bucket.end)}`,
    ...Object.fromEntries(allSeries.map(item => [item.key, isSeriesVisible(item) ? workloadBarValue(bucket.start > today ? 0 : (bucket.metrics.get(item.subject.id)?.total[item.category] ?? 0), bucket, valueMode) : 0])),
  }));
  const summaryRange = completedWeeksRange(range, today);
  const facultyMarkers = useMemo(() => {
    if (participantRole !== 'faculty') return [];
    const submitted = Array.from(ratingEntries.values()).filter(entry => entry.date <= today);
    return buckets.map(bucket => facultyWorkloadShares(submitted, bucket, daily ? 'day' : 'week'));
  }, [participantRole, ratingEntries, buckets, daily, today]);
  const markerVisible = (key: string) => key === 'adminEffort' ? showFacultyAdmin : showFacultyStructural;
  const selectedRow = data.find(row => row.period === selectedPeriod);
  const selectedBucket = selectedRow ? buckets[data.indexOf(selectedRow)] : undefined;
  const periodComments = selectedBucket ? collectPeriodComments(
    Array.from(ratingEntries.values()).filter(entry => entry.date <= today), selectedBucket, daily ? 'day' : 'week',
  ) : [];
  const dayWidth = Math.max(0, chartWidth - workloadAxisWidth - ratingAxisWidth - chartRightMargin) / Math.max(1, data.length);
  const verticalDayLabels = grouping === 'daily' && dayWidth < 36;
  const dailyLabelInterval = chartWidth > 0 && verticalDayLabels
    ? Math.max(0, Math.ceil(18 / Math.max(1, dayWidth)) - 1) : 0;
  // Faculty markers and their scale always refer to the full submitted workload,
  // independently of which module segments are currently visible.
  const maximumHours = participantRole === 'faculty'
    ? Math.max(0, ...facultyMarkers.map((markers, index) => workloadBarValue(markers[0]?.totalWorkload ?? 0, buckets[index], valueMode)))
    : Math.max(0, ...data.map(row => series.reduce((sum, item) => sum + Number(row[item.key] || 0), 0)));
  // Leave 10% headroom, then round up to a readable quarter-hour-based scale.
  const paddedMaximum = maximumHours * 1.1;
  const tickStep = [0.25, 0.5, 1, 2, 4, 8, 12, 24, 48, 96].find(step => paddedMaximum / step <= 8)
    ?? Math.ceil(paddedMaximum / 8 / 24) * 24;
  const axisMaximum = Math.max(tickStep, Math.ceil(paddedMaximum / tickStep) * tickStep);
  const animated = useAnimatedWorkload(data, axisMaximum, grouping);
  const displayedTickStep = [0.25, 0.5, 1, 2, 4, 8, 12, 24, 48, 96].find(step => animated.tickMaximum / step <= 8)
    ?? Math.ceil(animated.tickMaximum / 8 / 24) * 24;
  const xAxisHeight = compactWeekLabels ? (crossesWeekYear ? 82 : 48) : grouping === 'daily' ? (verticalDayLabels ? 72 : 44) : 30;
  const chartTopMargin = 8;
  const chartBottomMargin = 4;
  const plotHeight = Math.max(0, chartHeight - chartTopMargin - chartBottomMargin - xAxisHeight);
  // Five rating ticks need at least 16px each, even on narrow phone screens.
  const ratingHeight = Math.min(plotHeight * 0.5, Math.max(80, plotHeight * 0.2));
  // Both scales share one plot and category axis, with a small breathing space between the bars.
  const workloadTopPadding = showRatings ? ratingHeight + 10 : 0;
  const workloadHeight = plotHeight - workloadTopPadding;
  const crowdedAxis = workloadHeight > 0 && workloadHeight / Math.max(1, animated.tickMaximum / displayedTickStep) < 28;
  // Increase the step rather than rounding fractional ticks into duplicate labels.
  const readableTickStep = crowdedAxis ? Math.max(1, Math.ceil(displayedTickStep)) : displayedTickStep;
  const hourTicks = Array.from({ length: Math.floor(animated.tickMaximum / readableTickStep) + 1 }, (_, index) => index * readableTickStep);
  const wholeNumber = new Intl.NumberFormat(language === 'de' ? 'de-CH' : 'en', { maximumFractionDigits: 0 });
  const groupings = (['daily', 'weekly', 'monthly'] as WorkloadGrouping[]).filter(value => daily || value !== 'daily');
  const zoomControl = (className: string) => (
              <div className={`flex shrink-0 items-center gap-2 text-xs text-gray-500 ${className}`}>
                <ZoomIn aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                <input type="range" min="1" max="8" step="0.1" value={zoom} aria-label={t('analytics.zoom')} title={t('analytics.zoomHelp')}
                  onChange={event => setZoom(Number(event.target.value))}
                  aria-valuetext={zoom === 1 ? t('analytics.fitChart') : `${number.format(zoom)}×`}
                  className="chart-zoom-slider h-5 min-w-0 flex-1 cursor-pointer focus-visible:outline-2 focus-visible:outline-indigo-500" />
                <span className="min-w-7 text-right tabular-nums">{zoom === 1 ? '1×' : `${number.format(zoom)}×`}</span>
              </div>
  );
  return <section aria-label={t('analytics.show')} className={`workload-chart-panel flex h-full min-h-0 flex-col rounded-2xl border border-gray-100 bg-white shadow-sm ${collapsed ? 'overflow-hidden p-3' : 'overflow-y-auto p-4 md:p-6'}`} onClick={() => setSelectedPeriod(undefined)} onKeyDown={event => { if (event.key === 'Escape') { if (selectedPeriod) setSelectedPeriod(undefined); else onClose(); } }}>
    <div className={`flex shrink-0 items-center justify-between gap-2 ${collapsed ? '' : 'mb-3 flex-wrap'}`}>
      <h2 className={`min-w-0 text-lg font-semibold text-gray-900 ${collapsed ? 'truncate' : ''}`}>{t('analytics.statistics')}</h2>
      <div className="flex shrink-0 items-center gap-1">
        <ShareUrlButton />
        <button type="button" autoFocus onClick={onClose} className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-indigo-500"><CalendarDays className="h-4 w-4" />{t('analytics.calendar')}</button>
      </div>
    </div>
    <div ref={contentRef} aria-hidden={collapsed} className={`flex min-w-0 flex-1 flex-col ${collapsed ? 'invisible' : ''}`}>
            <TimeRangeFilter policy={policy} value={preset} range={range} rangeBounds={rangeBounds} onChange={onRangeChange} trailingControl={
              zoomControl('workload-chart-zoom ml-auto w-36')
            } />
            <div className="chart-controls-scroll workload-chart-controls mb-2 flex shrink-0 flex-nowrap items-center gap-2 overflow-x-auto pt-1 lg:mb-4 lg:border-t lg:border-gray-100 lg:pt-4" tabIndex={0} role="group" aria-label={t('analytics.chartControls')}>
              <div role="group" aria-label={t('analytics.groupBy')} className={CHART_TOGGLE_TRACK} style={{ gridTemplateColumns: `repeat(${groupings.length}, minmax(0, 1fr))` }}>
                <span aria-hidden="true" className={CHART_TOGGLE_THUMB} style={{ width: `calc((100% - 0.5rem) / ${groupings.length})`, transform: `translateX(${groupings.indexOf(grouping) * 100}%)` }} />
                {groupings.map(value => <button key={value} type="button" title={t(`analytics.${value}GroupingHelp`)} aria-pressed={grouping === value} onClick={() => onGroupingChange(value)}
                  className={`whitespace-nowrap rounded-lg px-2 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-indigo-500 ${grouping === value ? 'text-indigo-800' : 'text-gray-500 hover:text-gray-900'}`}>{t(`analytics.${value}`)}</button>)}
              </div>
              <ChartDisplayControls mode={valueMode} onModeChange={onValueModeChange} weeklyAverageDisabled={grouping === 'daily' || grouping === 'weekly'} dailyAverageDisabled={grouping === 'daily'} timeFilter={timeFilter} onTimeFilterChange={onTimeFilterChange} singleTime={singleTime} />
            </div>
            <div ref={chartRef} title={t('analytics.completeWeeksHelp')} className={`workload-chart-scroll relative ${showRatings ? 'min-h-[300px]' : 'min-h-[180px]'} flex-1 overflow-x-auto rounded-xl border border-gray-100 bg-gray-50/50 px-2 py-1`}>
              <div className={`workload-chart-canvas h-full ${showRatings ? 'min-h-[290px]' : 'min-h-[180px]'}`} style={{ width: `${zoom * 100}%` }}>
                <ResponsiveContainer width="100%" height="100%" onResize={(width, height) => { setChartWidth(width); setChartHeight(height); }}>
                  <ComposedChart barSize={Math.min(30, bucketWidth * 0.8)} barGap={-Math.min(30, bucketWidth * 0.8)} data={animated.data.map((row, index) => ({ ...row, ...ratings[index] }))} accessibilityLayer margin={{ top: chartTopMargin, right: chartRightMargin, bottom: chartBottomMargin, left: 0 }}>
                    {data.map((row, index) => (grouping === 'daily'
                      ? !summaryRange || buckets[index].start < summaryRange.start || buckets[index].end > summaryRange.end
                      : buckets[index].end >= calendarWeekStart(today) && buckets[index].start <= calendarWeekEnd(today))
                      ? <ReferenceArea key={row.period} x1={row.label} x2={row.label} fill="#9ca3af" fillOpacity={0.22} ifOverflow="hidden" /> : null)}
                    <CartesianGrid horizontal strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="label" height={xAxisHeight}
                      tick={grouping === 'daily' ? ({ x, y, payload }: any) => {
                        const [weekday, day] = String(payload.value).split(' ');
                        if (verticalDayLabels) return <text x={x} y={y + 8} transform={`rotate(-90, ${x}, ${y + 8})`} textAnchor="end" dominantBaseline="central" fontSize={11} fill="#6b7280">{day} {weekday}</text>;
                        return <text x={x} y={y} textAnchor="middle" fontSize={11} fill="#6b7280">
                          <tspan x={x} dy={10}>{day}</tspan>
                          <tspan x={x} dy={14}>{weekday}</tspan>
                        </text>;
                      } : compactWeekLabels ? ({ x, y, payload }: any) => <text x={x} y={y + 8} transform={`rotate(-90, ${x}, ${y + 8})`} textAnchor="end" dominantBaseline="central" fontSize={11} fill="#6b7280">{payload.value}</text> : { fontSize: 11, fill: '#6b7280' }}
                      tickLine={false} axisLine={false} minTickGap={grouping === 'daily' ? 2 : 8} interval={grouping === 'daily' ? dailyLabelInterval : compactWeekLabels ? Math.max(0, Math.ceil(18 / Math.max(1, bucketWidth)) - 1) : 'equidistantPreserveStart'} />
                    <YAxis padding={{ top: workloadTopPadding }} tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} tickFormatter={value => crowdedAxis ? wholeNumber.format(value) : number.format(value)} width={workloadAxisWidth} ticks={hourTicks} domain={[0, animated.maximum]} interval={0} allowDataOverflow>
                      <Label content={({ viewBox }: any) => {
                        const y = viewBox.y + workloadTopPadding + (viewBox.height - workloadTopPadding) / 2;
                        return <text x={viewBox.x + 7} y={y} transform={`rotate(-90, ${viewBox.x + 7}, ${y})`} textAnchor="middle" fontSize={12} fill="#4b5563">{t('analytics.workload')} (h)</text>;
                      }} />
                    </YAxis>
                    {showRatings && <YAxis yAxisId="ratings" orientation="right" domain={[0, 5]} reversed ticks={[1, 2, 3, 4, 5]} padding={{ bottom: plotHeight - ratingHeight }} width={ratingAxisWidth} interval={0} allowDataOverflow tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false} axisLine={false}>
                      <Label content={({ viewBox }: any) => <g transform={`translate(${viewBox.x + 19}, ${viewBox.y + ratingHeight / 2 - 7})`} role="img" aria-label={showDataRating ? t('dailyEntry.reliability') : t(`socialBattery.${participantRole}`)}>
                        <title>{showDataRating ? t('dailyEntry.reliability') : t(`socialBattery.${participantRole}`)}</title>
                        {showDataRating ? <Star width={14} height={14} color="var(--color-amber-400)" fill="var(--color-amber-400)" aria-hidden="true" /> : <BatteryMedium width={14} height={14} color="#2ca468" aria-hidden="true" />}
                      </g>} />
                    </YAxis>}
                    <defs>
                      <linearGradient id={batteryGradient} gradientUnits="userSpaceOnUse" x1="0" x2="0" y1={chartTopMargin} y2={chartTopMargin + ratingHeight}>
                        <stop offset="0%" stopColor="#d94f5c" /><stop offset="25%" stopColor="#e78086" />
                        <stop offset="50%" stopColor="#b7a5a7" /><stop offset="65%" stopColor="#a1b7aa" />
                        <stop offset="80%" stopColor="#6abf8c" /><stop offset="100%" stopColor="#2ca468" />
                      </linearGradient>
                    </defs>
                    {allSeries.map(({ subject, category, key, name }) => <Bar key={key} dataKey={key} name={name} stackId="hours" fill={subject.color} fillOpacity={WORKLOAD_OPACITY[category]} maxBarSize={30}
                      isAnimationActive={false}
                      shape={(props: any) => {
                        const actualRow = data.find(row => row.period === props.payload?.period);
                        const title = `${name}: ${formatStatisticsHours(Number(actualRow?.[key]) || 0, language, valueMode)} h`;
                        const topSeries = [...allSeries].reverse().find(item => Number(props.payload?.[item.key]) > 0);
                        const radius = topSeries?.key === key ? Math.min(4, props.width / 2, Math.max(0, props.height)) : 0;
                        const clipId = `${batteryGradient}-column-${allSeries.findIndex(item => item.key === key)}-${props.index}`;
                        const stackTotal = allSeries.reduce((sum, item) => sum + (Number(props.payload?.[item.key]) || 0), 0);
                        const choose = (anchor: SVGRectElement) => choosePeriod(anchor, props.payload.period);
                        return <g><defs><clipPath id={clipId}><rect x={props.x} y={props.y} width={props.width} height={props.height + radius} rx={radius} /></clipPath></defs><rect clipPath={`url(#${clipId})`} x={props.x} y={props.y} width={props.width} height={props.height} fill={subject.color} fillOpacity={WORKLOAD_OPACITY[category]}
                          data-period={props.payload?.period} data-popup-visible={visible.has(subject.id) && !hiddenCategories.has(`${subject.id}:${category}`)} className="workload-bar-segment" role="button" tabIndex={props.height > 0 ? 0 : -1} aria-label={`${props.payload?.period} · ${title}`} aria-pressed={selectedPeriod === props.payload?.period}
                          onClick={event => { event.stopPropagation(); choose(event.currentTarget); }}
                          onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); choose(event.currentTarget); } }}>
                          <title>{title}</title>
                        </rect>
                          {showBarTotals && topSeries?.key === key && props.height > 0 && <text x={props.x + props.width / 2} y={props.y - 6} textAnchor="middle" fontSize={10} fontWeight={400} fill="#6b7280" pointerEvents="none" aria-hidden="true"
                            transform={bucketWidth < 38 ? `rotate(-90, ${props.x + props.width / 2}, ${props.y - 6})` : undefined}
                            style={bucketWidth < 38 ? { textAnchor: 'start' } : undefined}>
                            {bucketWidth < 38 ? wholeNumber.format(stackTotal) : formatStatisticsHours(stackTotal, language, valueMode)}
                          </text>}
                        </g>;
                      }} />)}
                    {ratingSeries.filter(item => item.shown).map(item => <Bar key={item.key} yAxisId="ratings" dataKey={item.key} name={item.name} fill={item.color} maxBarSize={30} isAnimationActive={false}
                      shape={(props: any) => {
                        const value = props.payload?.[item.key];
                        if (typeof value !== 'number' || !props.height) return <g />;
                        const radius = Math.min(4, props.width / 2, Math.abs(props.height));
                        const clipId = `${batteryGradient}-rating-${item.key}-${props.index}`;
                        return <g><defs><clipPath id={clipId}><rect x={props.x} y={Math.min(props.y, props.y + props.height)} width={props.width} height={Math.abs(props.height) + radius} rx={radius} /></clipPath></defs><rect clipPath={`url(#${clipId})`} x={props.x} y={Math.min(props.y, props.y + props.height)} width={props.width} height={Math.abs(props.height)}
                          fill={item.key === 'socialBattery' ? `url(#${batteryGradient})` : item.color}
                          data-period={props.payload.period} data-popup-visible="true" role="button" tabIndex={0} className="workload-bar-segment cursor-pointer"
                          aria-label={`${props.payload.period} · ${item.name}: ${number.format(value)}/5`} aria-pressed={selectedPeriod === props.payload.period}
                          onClick={event => { event.stopPropagation(); choosePeriod(event.currentTarget, props.payload.period); }}
                          onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); choosePeriod(event.currentTarget, props.payload.period); } }}>
                          <title>{`${item.name}: ${number.format(value)}/5`}</title>
                        </rect></g>;
                      }} />)}
                    {participantRole === 'faculty' && (showFacultyAdmin || showFacultyStructural) && <Customized component={({ xAxisMap, yAxisMap }: any) => {
                      const xAxis = xAxisMap?.[0];
                      const yAxis = yAxisMap?.[0];
                      if (!xAxis?.scale || !yAxis?.scale) return <g />;
                      return <g>{animated.data.flatMap((row, index) => {
                        const markers = facultyMarkers[index] ?? [];
                        const center = xAxis.scale(row.label) + (xAxis.scale.bandwidth?.() ?? 0) / 2;
                        const barWidth = Math.min(30, bucketWidth * 0.8);
                        const offset = Math.max(6, barWidth * 0.25);
                        return markers.filter(item => item.hasData && markerVisible(item.key)).map(item => <circle key={`${row.period}-${item.key}`}
                          cx={center + item.side * offset} cy={yAxis.scale(workloadBarValue(item.totalWorkload, buckets[index], valueMode) * item.fraction)} r={4.5} fill={item.color} stroke="white" strokeWidth={2}
                          data-period={row.period} data-popup-visible="true" role="button" tabIndex={0} className="cursor-pointer focus-visible:outline-2 focus-visible:outline-indigo-500"
                          aria-label={`${row.period} · ${t(item.label)}: ${number.format(item.fraction * 100)}%`} aria-pressed={selectedPeriod === row.period}
                          onClick={event => { event.stopPropagation(); choosePeriod(event.currentTarget, row.period); }}
                          onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); choosePeriod(event.currentTarget, row.period); } }}>
                          <title>{`${t(item.label)}: ${number.format(item.fraction * 100)}%`}</title>
                        </circle>);
                      })}</g>;
                    }} />}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              {selectedRow && <div ref={popupRef} style={popupPosition} role="region" aria-label={selectedRow.period} onClick={event => event.stopPropagation()}
                className="absolute z-10 max-h-[calc(100%-1.5rem)] w-80 max-w-[calc(100%-1.5rem)] overflow-y-auto rounded-xl border border-gray-200 bg-white p-3 text-xs shadow-lg">
                <div className="mb-2 flex items-start justify-between gap-2 font-medium text-gray-800">
                  <span>{selectedRow.period}</span>
                  <button type="button" aria-label={t('common.close')} onClick={() => setSelectedPeriod(undefined)} className="rounded p-1 hover:bg-gray-100"><X className="h-3.5 w-3.5" /></button>
                </div>
                {ratingSeries.filter(item => item.shown).map(item => <div key={item.key} className="mb-2 flex items-center gap-2"><span aria-hidden="true" className="h-0.5 w-3" style={{ backgroundColor: item.color }} /><span>{item.name}: <strong>{ratings[data.indexOf(selectedRow)]?.[item.key] == null ? '–' : `${number.format(ratings[data.indexOf(selectedRow)][item.key]!)}/5`}</strong></span></div>)}
                {ordered.filter(subject => series.some(item => item.subject.id === subject.id)).map(subject => <div key={subject.id} className="mb-3 text-black last:mb-0">
                  <div className="mb-1.5 flex items-center gap-2 font-medium">
                    <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: subject.color }} />
                    <span>{getSubjectDisplayName(subject, language)}</span>
                  </div>
                  <div className="flex items-center gap-4 pl-4 tabular-nums">
                    {series.filter(item => item.subject.id === subject.id).map(item => <span key={item.key} className="inline-flex items-center gap-1.5 whitespace-nowrap" title={singleTime || subject.supplemental ? t('weeklyEntry.hours') : t(`analytics.${item.category}`)}>
                      <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: subject.color, opacity: WORKLOAD_OPACITY[item.category] }} />
                      <span className="sr-only">{singleTime || subject.supplemental ? t('weeklyEntry.hours') : t(`analytics.${item.category}`)}: </span>
                      <span>{t(valueMode === 'total' ? 'analytics.totalCompact' : valueMode === 'weeklyAverage' ? 'analytics.weeklyCompact' : 'analytics.dailyCompact')}: <strong className="font-semibold">{formatStatisticsHours(Number(selectedRow[item.key]) || 0, language, valueMode)} h</strong></span>
                    </span>)}
                  </div>
                </div>)}
                {(facultyMarkers[data.indexOf(selectedRow)] ?? []).filter(item => markerVisible(item.key)).map(item => <div key={item.key} className="mb-2 flex items-center gap-2">
                  <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white" style={{ backgroundColor: item.color }} />
                  <span>{t(item.label)}: <strong>{number.format(item.fraction * 100)}% · {formatStatisticsHours(workloadBarValue(item.hours, selectedBucket!, valueMode), language, valueMode)} h</strong></span>
                </div>)}
                <div className="mt-3 border-t border-gray-100 pt-2">
                  <button type="button" aria-expanded={showComments} aria-controls="statistics-period-comments" onClick={() => setShowComments(value => !value)}
                    className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-gray-600 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-indigo-500">
                    <MessageCircle aria-hidden="true" className="h-4 w-4" />
                    <span>{t('analytics.comments')} ({periodComments.length})</span>
                  </button>
                  {showComments && <div id="statistics-period-comments" className="mt-2 space-y-3">
                    {periodComments.length === 0 ? <p className="text-gray-500">{t('analytics.noComments')}</p> : periodComments.map((item, index) => <div key={`${item.date}-${index}`} className="rounded-lg bg-gray-50 p-2">
                      <div className="mb-1 font-medium text-gray-600">{daily ? date(item.date) : `${date(item.date)} – ${date(calendarWeekEnd(item.date))}`}</div>
                      <p className="whitespace-pre-wrap break-words text-gray-800">{item.comment}</p>
                    </div>)}
                  </div>}
                </div>
              </div>}
            </div>
            {zoomControl('workload-chart-zoom-mobile mt-2 w-full')}
            {!ratings.some(row => ratingSeries.some(item => item.shown && row[item.key] !== null)) && series.length > 0 && !data.some(row => series.some(item => Number(row[item.key]) > 0)) &&
              <p role="status" className="my-2 text-xs text-gray-500">{t('analytics.noData')}</p>}
    </div>
  </section>;
}
