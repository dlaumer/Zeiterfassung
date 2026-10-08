import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ZoomIn, X } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { format, parseISO } from 'date-fns';
import { workloadBarValue, AnalyticsPolicy, bucketWorkload, DateRange, PeriodPreset, WorkloadEntry, WorkloadGrouping } from '../../analytics/workload';
import { WORKLOAD_OPACITY } from '../../analytics/workloadColors';
import { useI18n } from '../../i18n/i18n';
import { getDateLocale } from '../../i18n/dateLocale';
import { compareSubjectsByDisplayName, getSubjectDisplayName, Subject } from '../CourseManagement';
import { TimeRangeFilter } from './TimeRangeFilter';
import { CHART_TOGGLE_THUMB, CHART_TOGGLE_TRACK, ChartDisplayControls, ChartTimeFilter, ChartValueMode } from './ChartDisplayControls';

type Category = 'classTime' | 'selfStudyTime';
interface Props {
  collapsed?: boolean;
  selected?: Subject;
  subjects: Subject[];
  entries: Map<string, WorkloadEntry>;
  policy: AnalyticsPolicy;
  preset: PeriodPreset;
  range: DateRange;
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

export function WorkloadChartPanel({ collapsed = false, selected, subjects, entries, policy, preset, range, singleTime, daily, visible, hiddenCategories, grouping, onGroupingChange, valueMode, onValueModeChange, timeFilter, onTimeFilterChange, onRangeChange, onClose }: Props) {
  const { t, language } = useI18n();
  const [selectedPeriod, setSelectedPeriod] = useState<string>();
  const [zoom, setZoom] = useState(1);
  const chartRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (contentRef.current) contentRef.current.inert = collapsed; }, [collapsed]);
  const popupRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<SVGRectElement | null>(null);
  const [popupPosition, setPopupPosition] = useState({ left: 12, top: 12 });
  useLayoutEffect(() => {
    const chart = chartRef.current;
    const popup = popupRef.current;
    if (!selectedPeriod || !chart || !popup) return;
    const position = () => {
      const anchor = anchorRef.current?.isConnected ? anchorRef.current : Array.from(chart.querySelectorAll<SVGRectElement>('rect[data-period]')).find(rect => rect.dataset.period === selectedPeriod && Number(rect.getAttribute('height')) > 0);
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
  }, [selectedPeriod, visible, hiddenCategories, language, zoom]);
  useEffect(() => { setSelectedPeriod(undefined); }, [grouping, valueMode, range.start, range.end]);
  useEffect(() => { setZoom(1); }, [grouping, range.start, range.end]);
  useEffect(() => { if (zoom === 1 && chartRef.current) chartRef.current.scrollLeft = 0; }, [zoom]);
  const ordered = [...subjects].sort(compareSubjectsByDisplayName(language));
  const categories: Category[] = singleTime ? ['classTime'] : ['classTime', 'selfStudyTime'];
  const buckets = useMemo(() => bucketWorkload(entries.values(), range, grouping), [entries, range.start, range.end, grouping]);

  const number = new Intl.NumberFormat(language === 'de' ? 'de-CH' : 'en', { maximumFractionDigits: 1 });
  const date = (value: string) => format(parseISO(value), 'dd.MM.yyyy');
  const weekdays = language === 'de' ? ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'] : ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const series = ordered.flatMap((subject, index) => categories.map(category => ({
    subject, category, key: `series${index}${category}`, name: `${getSubjectDisplayName(subject, language)}${singleTime ? '' : ` · ${t(`analytics.${category}`)}`}`,
  }))).filter(({ subject, category }) => visible.has(subject.id) && !hiddenCategories.has(`${subject.id}:${category}`));
  const data = buckets.map(bucket => ({
    label: grouping === 'weekly' ? `${format(parseISO(bucket.start), 'dd.MM.')}–${format(parseISO(bucket.end), 'dd.MM.')}`
      : grouping === 'monthly' ? format(parseISO(bucket.start), 'MM.yyyy') : grouping === 'yearly' ? bucket.start.slice(0, 4) : `${weekdays[parseISO(bucket.start).getDay()]} ${format(parseISO(bucket.start), 'dd.MM.')}`,
    period: grouping === 'daily' ? format(parseISO(bucket.start), 'EEEE, dd.MM.yyyy', { locale: getDateLocale(language) }) : `${date(bucket.start)} – ${date(bucket.end)}`,
    ...Object.fromEntries(series.map(({ subject, category, key }) => [key, workloadBarValue(bucket.metrics.get(subject.id)?.total[category] ?? 0, bucket, valueMode)])),
  }));
  const selectedRow = data.find(row => row.period === selectedPeriod);
  const groupings = (['daily', 'weekly', 'monthly', 'yearly'] as WorkloadGrouping[]).filter(value => daily || value !== 'daily');
  return <section aria-label={t('analytics.show')} className={`workload-chart-panel flex h-full min-h-0 flex-col rounded-2xl border border-gray-100 bg-white shadow-sm ${collapsed ? 'overflow-hidden p-3' : 'overflow-y-auto p-4 md:p-6'}`} onClick={() => setSelectedPeriod(undefined)} onKeyDown={event => { if (event.key === 'Escape') { if (selectedPeriod) setSelectedPeriod(undefined); else onClose(); } }}>
    <div className={`flex shrink-0 items-center justify-between gap-2 ${collapsed ? '' : 'mb-3 flex-wrap'}`}>
      <h2 className={`min-w-0 text-lg font-semibold text-gray-900 ${collapsed ? 'truncate' : ''}`}>{selected ? getSubjectDisplayName(selected, language) : t('analytics.statistics')}</h2>
      <button type="button" autoFocus onClick={onClose} className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-indigo-500"><CalendarDays className="h-4 w-4" />{t('analytics.calendar')}</button>
    </div>
    <div ref={contentRef} aria-hidden={collapsed} className={`flex min-w-0 flex-1 flex-col ${collapsed ? 'invisible' : ''}`}>
            <TimeRangeFilter policy={policy} value={preset} range={range} onChange={onRangeChange} trailingControl={
              <div className="workload-chart-zoom ml-auto flex w-36 shrink-0 items-center gap-2 text-xs text-gray-500">
                <ZoomIn aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                <input type="range" min="1" max="8" step="0.1" value={zoom} aria-label={t('analytics.zoom')}
                  onChange={event => setZoom(Number(event.target.value))}
                  aria-valuetext={zoom === 1 ? t('analytics.fitChart') : `${number.format(zoom)}×`}
                  className="chart-zoom-slider h-5 min-w-0 flex-1 cursor-pointer focus-visible:outline-2 focus-visible:outline-indigo-500" />
                <span className="min-w-7 text-right tabular-nums">{zoom === 1 ? '1×' : `${number.format(zoom)}×`}</span>
              </div>
            } />
            <div className="chart-controls-scroll mb-2 flex shrink-0 items-center gap-2 overflow-x-auto pt-1 lg:mb-4 lg:grid lg:grid-cols-[repeat(auto-fit,minmax(224px,1fr))] lg:gap-3 lg:border-t lg:border-gray-100 lg:pt-4" tabIndex={0} role="group" aria-label={t('analytics.chartControls')}>
              <div role="group" aria-label={t('analytics.groupBy')} className={CHART_TOGGLE_TRACK} style={{ gridTemplateColumns: `repeat(${groupings.length}, minmax(0, 1fr))` }}>
                <span aria-hidden="true" className={CHART_TOGGLE_THUMB} style={{ width: `calc((100% - 0.5rem) / ${groupings.length})`, transform: `translateX(${groupings.indexOf(grouping) * 100}%)` }} />
                {groupings.map(value => <button key={value} type="button" aria-pressed={grouping === value} onClick={() => onGroupingChange(value)}
                  className={`whitespace-nowrap rounded-lg px-2 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-indigo-500 ${grouping === value ? 'text-indigo-800' : 'text-gray-500 hover:text-gray-900'}`}>{t(`analytics.${value}`)}</button>)}
              </div>
              <ChartDisplayControls mode={valueMode} onModeChange={onValueModeChange} timeFilter={timeFilter} onTimeFilterChange={onTimeFilterChange} singleTime={singleTime} />
            </div>
            <div ref={chartRef} className={`workload-chart-scroll relative min-h-[180px] flex-1 rounded-xl border border-gray-100 bg-gray-50/50 p-3 ${zoom === 1 ? 'overflow-x-hidden' : 'overflow-x-auto'}`}>
              <div className="workload-chart-canvas h-full min-h-[180px]" style={{ width: `${zoom * 100}%` }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data} accessibilityLayer margin={{ top: 16, right: 16, bottom: 16, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="label" height={grouping === 'daily' ? 44 : 30}
                      tick={grouping === 'daily' ? ({ x, y, payload }: any) => {
                        const [weekday, day] = String(payload.value).split(' ');
                        return <text x={x} y={y} textAnchor="middle" fontSize={11} fill="#6b7280">
                          <tspan x={x} dy={10}>{day}</tspan>
                          <tspan x={x} dy={14}>{weekday}</tspan>
                        </text>;
                      } : { fontSize: 11, fill: '#6b7280' }}
                      tickLine={false} axisLine={false} minTickGap={16} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} tickFormatter={value => `${number.format(value)} h`} width={65} domain={[0, 'auto']} />
                    {series.map(({ subject, category, key, name }) => <Bar key={key} dataKey={key} name={name} stackId="hours" fill={subject.color} fillOpacity={WORKLOAD_OPACITY[category]} maxBarSize={110} isAnimationActive={false}
                      shape={(props: any) => {
                        const title = `${name}: ${number.format(props.payload?.[key] ?? 0)} h`;
                        const choose = (anchor: SVGRectElement) => { anchorRef.current = anchor; setSelectedPeriod(current => current === props.payload?.period ? undefined : props.payload?.period); };
                        return <rect x={props.x} y={props.y} width={props.width} height={props.height} fill={subject.color} fillOpacity={WORKLOAD_OPACITY[category]}
                          data-period={props.payload?.period} className="workload-bar-segment" role="button" tabIndex={props.height > 0 ? 0 : -1} aria-label={`${props.payload?.period} · ${title}`} aria-pressed={selectedPeriod === props.payload?.period}
                          onClick={event => { event.stopPropagation(); choose(event.currentTarget); }}
                          onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); choose(event.currentTarget); } }}>
                          <title>{title}</title>
                        </rect>;
                      }} />)}
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {selectedRow && <div ref={popupRef} style={popupPosition} role="region" aria-label={selectedRow.period} onClick={event => event.stopPropagation()}
                className="absolute z-10 max-h-[calc(100%-1.5rem)] w-80 max-w-[calc(100%-1.5rem)] overflow-y-auto rounded-xl border border-gray-200 bg-white p-3 text-xs shadow-lg">
                <div className="mb-2 flex items-start justify-between gap-2 font-medium text-gray-800">
                  <span>{selectedRow.period}</span>
                  <button type="button" aria-label={t('common.close')} onClick={() => setSelectedPeriod(undefined)} className="rounded p-1 hover:bg-gray-100"><X className="h-3.5 w-3.5" /></button>
                </div>
                {ordered.filter(subject => series.some(item => item.subject.id === subject.id)).map(subject => <div key={subject.id} className="mb-3 text-black last:mb-0">
                  <div className="mb-1.5 flex items-center gap-2 font-medium">
                    <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: subject.color }} />
                    <span>{getSubjectDisplayName(subject, language)}</span>
                  </div>
                  <div className="flex items-center gap-4 pl-4 tabular-nums">
                    {series.filter(item => item.subject.id === subject.id).map(item => <span key={item.key} className="inline-flex items-center gap-1.5 whitespace-nowrap" title={singleTime ? t('weeklyEntry.hours') : t(`analytics.${item.category}`)}>
                      <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: subject.color, opacity: WORKLOAD_OPACITY[item.category] }} />
                      <span className="sr-only">{singleTime ? t('weeklyEntry.hours') : t(`analytics.${item.category}`)}: </span>
                      <span>{t(valueMode === 'total' ? 'analytics.totalCompact' : valueMode === 'weeklyAverage' ? 'analytics.weeklyCompact' : 'analytics.dailyCompact')}: <strong className="font-semibold">{number.format(Number(selectedRow[item.key]) || 0)} h</strong></span>
                    </span>)}
                  </div>
                </div>)}
              </div>}
            </div>
            {(series.length === 0 || !data.some(row => series.some(item => Number(row[item.key]) > 0))) &&
              <p role="status" className="my-2 text-xs text-gray-500">{t(series.length === 0 ? 'analytics.noVisibleSeries' : 'analytics.noData')}</p>}
    </div>
  </section>;
}
