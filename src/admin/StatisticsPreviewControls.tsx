import { useEffect, useRef, useState } from 'react';
import { format, startOfWeek, endOfWeek, subWeeks } from 'date-fns';
import { ChevronDown } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Rectangle } from 'recharts';
import { Popover, PopoverContent, PopoverTrigger } from '../app/components/ui/popover';
import { useI18n } from '../app/i18n/i18n';
import { useAnimatedWorkload } from '../app/components/analytics/useAnimatedWorkload';

// Actual module names with deliberately illustrative, fixed semester assignments.
export const previewModules = [
  { id: 'chemistry', de: 'Chemie I', en: 'Chemistry I', semester: 1, color: '#969465' },
  { id: 'calculus', de: 'Analysis I', en: 'Calculus I', semester: 1, color: '#C4C09B' },
  { id: 'physics', de: 'Physik', en: 'Physics', semester: 1, color: '#D99666' },
  { id: 'informatics', de: 'Informatik I', en: 'Informatics I', semester: 2, color: '#F0C5A7' },
  { id: 'mechanics', de: 'Technische Mechanik', en: 'Technical Mechanics', semester: 2, color: '#C98F91' },
  { id: 'ecology', de: 'Biologie III: Ökologie', en: 'Biology III: Ecology', semester: 3, color: '#79618F' },
  { id: 'algebra', de: 'Lineare Algebra', en: 'Linear Algebra', semester: 3, color: '#B4A3C6' },
  { id: 'environment', de: 'Einführung Umweltingenieurwissenschaften', en: 'Introduction Environmental Engineering', semester: 2, color: '#A55D65' },
  { id: 'law', de: 'Recht und Ökonomie', en: 'Law and economy', semester: 3, color: '#DCC9BD' },
];
export const facultyWorkloadColors = ['#818cf8', '#4f46e5', '#c7d2fe'];
export function previewModuleHours(week: number, year: number, module: number) {
  if (year === 2025 && week === 53) return 0;
  return (2 + (((week - 39) * 3 + module * 2 + 90) % 9) * 0.4) * (year === 2025 ? 0.76 + ((week + module) % 5) * 0.065 : 1);
}
export function previewFacultyShares(week: number, year: number) {
  const preparation = 0.28 + ((week * 3 + year) % 7) * 0.055;
  const contact = 0.2 + ((week + year) % 4) * 0.035;
  return [preparation, contact, 1 - preparation - contact];
}
const trigger = 'flex h-10 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 text-left text-sm text-gray-600';
const popup = 'max-h-[var(--radix-popover-content-available-height)] max-w-[calc(100vw-24px)] overflow-y-auto rounded-xl bg-white p-4 shadow-xl';
const shortcut = 'rounded-lg border border-gray-200 px-3 py-2 text-xs hover:bg-indigo-50 aria-pressed:border-indigo-700 aria-pressed:bg-indigo-700 aria-pressed:text-white';

export function StatisticsModulePicker({ selected, onChange }: { selected: Set<string>; onChange: (value: Set<string>) => void }) {
  const { language } = useI18n();
  const de = language === 'de';
  const toggle = (ids: string[], enabled: boolean) => { const next = new Set(selected); ids.forEach(id => enabled ? next.add(id) : next.delete(id)); onChange(next); };
  return <div className="grid min-w-0 gap-1.5 text-xs font-medium text-gray-500"><span>{de ? 'Module / Studiensemester' : 'Modules / study semesters'}</span><Popover><PopoverTrigger asChild><button className={trigger}><span className="truncate">{selected.size} {de ? 'Module ausgewählt' : 'modules selected'}</span><ChevronDown className="h-4 w-4 shrink-0" /></button></PopoverTrigger><PopoverContent align="start" className={`${popup} w-96`}>
    <p className="mb-3 text-xs text-gray-400">{de ? 'Echte Modulnamen · Semesterzuordnung nur als Beispiel' : 'Actual module names · Example semester assignments'}</p>
    {[1, 2, 3].map(semester => { const modules = previewModules.filter(m => m.semester === semester); const count = modules.filter(m => selected.has(m.id)).length; return <fieldset key={semester} className="mb-3 border-b border-gray-100 pb-3 last:mb-0 last:border-0 last:pb-0"><legend className="mb-2 w-full"><label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-gray-700"><input type="checkbox" checked={count === modules.length} ref={node => { if (node) node.indeterminate = count > 0 && count < modules.length; }} onChange={e => toggle(modules.map(m => m.id), e.target.checked)} className="accent-indigo-600" />{de ? `${semester}. Semester` : `Semester ${semester}`}<span className="ml-auto text-xs font-normal text-gray-400">{count}/{modules.length}</span></label></legend>{modules.map(m => <label key={m.id} className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-2 text-sm text-gray-600 hover:bg-gray-50"><input type="checkbox" checked={selected.has(m.id)} onChange={e => toggle([m.id], e.target.checked)} className="mt-1 accent-indigo-600" /><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: m.color }} /><span>{m[language]}</span></label>)}</fieldset>; })}
  </PopoverContent></Popover></div>;
}

export function StatisticsPeriodPicker({ onChange }: { onChange: (period: { mode: string; start: number; end: number }) => void }) {
  const { language } = useI18n(); const de = language === 'de';
  const [mode, setMode] = useState('dates');
  const [preset, setPreset] = useState('custom');
  const [dates, setDates] = useState({ start: '2026-09-21', end: '2026-12-27' });
  const [weeks, setWeeks] = useState({ start: 39, end: 52 });
  useEffect(() => { onChange({ mode, ...weeks }); }, [mode, weeks.start, weeks.end, onChange]);
  const datePreset = (value: string) => { setPreset(value); const today = new Date(); setDates(value === 'all' ? { start: '2026-09-21', end: '2026-12-27' } : { start: format(startOfWeek(subWeeks(today, value === 'two' ? 2 : 4), { weekStartsOn: 1 }), 'yyyy-MM-dd'), end: format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd') }); };
  return <div className="grid min-w-0 gap-1.5 text-xs font-medium text-gray-500"><span>{de ? 'Zeitraum' : 'Period'}</span><Popover><PopoverTrigger asChild><button className={trigger}><span className="truncate">{mode === 'weeks' ? `KW ${weeks.start}–${weeks.end}` : `${format(new Date(dates.start + 'T12:00:00'), 'dd.MM.yyyy')} – ${format(new Date(dates.end + 'T12:00:00'), 'dd.MM.yyyy')}`}</span><ChevronDown className="h-4 w-4 shrink-0" /></button></PopoverTrigger><PopoverContent align="start" className={`${popup} w-[520px]`}>
    <div className="mb-4 flex gap-1 rounded-lg bg-gray-100 p-1">{[['dates', de ? 'Datum' : 'Dates'], ['weeks', de ? 'Kalenderwochen (KW)' : 'Calendar weeks (KW)']].map(([value, label]) => <button key={value} onClick={() => setMode(value)} aria-pressed={mode === value} className="flex-1 rounded-md px-3 py-2 text-xs aria-pressed:bg-white aria-pressed:text-indigo-700 aria-pressed:shadow-sm">{label}</button>)}</div>
    {mode === 'dates' ? <><div className="mb-3 flex flex-wrap gap-2">{[['two', de ? 'Letzte 2 Wochen' : 'Last 2 weeks'], ['four', de ? 'Letzte 4 Wochen' : 'Last 4 weeks'], ['all', de ? 'Alle' : 'All']].map(([value, label]) => <button key={value} onClick={() => datePreset(value)} aria-pressed={preset === value} className={shortcut}>{label}</button>)}</div><div className="grid grid-cols-2 gap-3">{(['start', 'end'] as const).map(key => <label key={key} className="grid min-w-0 gap-1 text-xs text-gray-500">{key === 'start' ? (de ? 'Von' : 'From') : (de ? 'Bis' : 'To')}<input type="date" required value={dates[key]} min={key === 'end' ? dates.start : undefined} max={key === 'start' ? dates.end : undefined} onChange={e => { const v = e.target.value; if (v && (key === 'start' ? v <= dates.end : v >= dates.start)) { setDates({ ...dates, [key]: v }); setPreset('custom'); } }} className="w-full min-w-0 rounded-lg border border-gray-200 px-2 py-2 text-sm" /></label>)}</div></> : <><div className="mb-3 flex flex-wrap gap-2">{[['spring', de ? 'Frühjahrssemester' : 'Spring semester', 8, 22], ['fall', de ? 'Herbstsemester' : 'Fall semester', 38, 51]] .map(([value, label, start, end]) => <button key={value} onClick={() => { setPreset(String(value)); setWeeks({ start: Number(start), end: Number(end) }); }} aria-pressed={preset === value} className={shortcut}>{label}</button>)}</div><div className="grid grid-cols-2 gap-3">{(['start', 'end'] as const).map(key => <label key={key} className="grid gap-1 text-xs text-gray-500">{key === 'start' ? (de ? 'Von KW' : 'From week') : (de ? 'Bis KW' : 'To week')}<select value={weeks[key]} onChange={e => { const value = Number(e.target.value); setWeeks(key === 'start' ? { start: value, end: Math.max(value, weeks.end) } : { start: Math.min(value, weeks.start), end: value }); setPreset('custom'); }} className="rounded-lg border border-gray-200 px-2 py-2 text-sm">{Array.from({ length: 53 }, (_, i) => <option key={i} value={i + 1}>KW {i + 1}</option>)}</select></label>)}</div><p className="mt-3 text-xs text-gray-400">{de ? 'Jahresübergreifende KW-Auswahl. Semester-Kürzel sind vorläufige Beispiele; KW 53 nur in passenden Jahren.' : 'Week selection applies across years. Semester shortcuts are provisional; week 53 applies only in applicable years.'}</p></>}
    <p className="mt-3 text-xs text-indigo-600">{de ? mode === 'weeks' ? 'Simulierter Jahresvergleich: 2025 und 2026 je KW. KW 53 nur in 2026.' : 'Datumsvorschau: 14 Beispielwochen aus 2026.' : mode === 'weeks' ? 'Simulated comparison: 2025 and 2026 per week. Week 53 in 2026 only.' : 'Date preview: 14 sample weeks from 2026.'}</p>
  </PopoverContent></Popover></div>;
}

export type SelectedPreviewWeek = { week: number; year: number; population: string };
export function PreviewWorkloadChart({ population, selected, period, selectedWeek, onWeekSelect }: { population: string; selected: Set<string>; period: { mode: string; start: number; end: number }; selectedWeek: SelectedPreviewWeek | null; onWeekSelect: (week: SelectedPreviewWeek | null) => void }) {
  const chartRef = useRef<HTMLDivElement>(null);
  const hoverPopupRef = useRef<HTMLDivElement>(null);
  const pinnedPosition = useRef({ left: 8, top: 8, width: 0 });
  const pinWeek = (week: SelectedPreviewWeek | null) => {
    const popup = hoverPopupRef.current?.getBoundingClientRect();
    const chart = chartRef.current?.getBoundingClientRect();
    if (week && popup && chart) pinnedPosition.current = { left: popup.left - chart.left, top: popup.top - chart.top, width: popup.width };
    onWeekSelect(week);
  };
  const pinned = selectedWeek?.population === population ? selectedWeek : null;
  useEffect(() => {
    if (!pinned) return;
    const outside = (event: PointerEvent) => { if (!chartRef.current?.contains(event.target as Node)) onWeekSelect(null); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') onWeekSelect(null); };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [pinned, onWeekSelect]);
  const { language } = useI18n(); const faculty = population === 'Faculty';
  const compare = period.mode === 'weeks';
  const series = faculty ? [{ id: 'preparation', de: 'Vorbereitung', en: 'Preparation', color: facultyWorkloadColors[0] }, { id: 'contact', de: 'Kontaktzeit', en: 'Contact', color: facultyWorkloadColors[1] }, { id: 'followup', de: 'Nachbereitung', en: 'Follow-up', color: facultyWorkloadColors[2] }] : previewModules;
  const start = compare ? period.start : 39;
  const end = compare ? period.end : 52;
  type Row = { label: string; period: string; [key: string]: string | number };
  const makeData = (year: number): Row[] => Array.from({ length: end - start + 1 }, (_, offset) => {
    const week = start + offset;
    const hours = (module: number) => {
      if (!selected.has(previewModules[module].id) || (year === 2025 && week === 53)) return 0;
      return previewModuleHours(week, year, module);
    };
    return { label: `KW ${week}`, period: String(week), ...Object.fromEntries(series.map((s, index) => [s.id, faculty ? previewModules.reduce((sum, _, i) => sum + hours(i) * previewFacultyShares(week, year)[index], 0) : hours(index)])) };
  });
  const data2026 = makeData(2026);
  const data2025 = makeData(2025);
  const total = (row: Row) => series.reduce((sum, s) => sum + Number(row[s.id] || 0), 0);
  const maximum = Math.max(1, ...data2026.map(total), ...(compare ? data2025.map(total) : [])) * 1.2;
  // Keep each course-run stack on the same scale and use the personal chart's shared animation.
  const grouping = `${population}:${period.mode}`;
  const current = useAnimatedWorkload(data2026, maximum, grouping);
  const previous = useAnimatedWorkload(data2025, maximum, grouping);
  const years = compare ? [2025, 2026] : [2026];
  const rows = current.data.map((row, index) => ({ label: row.label, ...Object.fromEntries(years.flatMap(year => series.map(s => [`${year}_${s.id}`, (year === 2025 ? previous.data[index] : row)?.[s.id] ?? 0]))) }));
  const number = new Intl.NumberFormat(language === 'de' ? 'de-CH' : 'en', { maximumFractionDigits: 1 });
  const renderPopup = (row: Record<string, any>, label: string, locked = false) => {
      const visible = series.filter(s => years.some(year => Number(row[`${year}_${s.id}`]) > 0));
      return <div ref={locked ? undefined : hoverPopupRef} className="relative rounded-2xl border border-gray-200/80 bg-white/95 p-4 text-xs shadow-[0_8px_32px_rgba(30,27,75,0.12)] backdrop-blur-sm" style={{ maxWidth: 'min(420px, calc(100vw - 32px))', width: locked && pinnedPosition.current.width ? pinnedPosition.current.width : undefined }}>
        <div className="mb-3 flex items-center justify-between gap-6 pr-5"><span className="font-semibold text-gray-800">{label}</span><span className="text-[10px] text-gray-400">{language === 'de' ? 'Workload · Stunden' : 'Workload · Hours'}</span></div>
        <table className="w-full border-collapse"><thead><tr><th className="pb-2 text-left font-normal text-gray-400">{faculty ? (language === 'de' ? 'Tätigkeit' : 'Activity') : (language === 'de' ? 'Modul' : 'Module')}</th>{years.map(year => <th key={year} className="pb-2 pl-4 text-right font-semibold text-indigo-600">{year}</th>)}</tr></thead>
          <tbody>{visible.map(s => <tr key={s.id}><td className="py-1.5 text-gray-600"><span className="inline-flex items-center gap-2"><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} /><span className="max-w-48 leading-snug">{s[language]}</span></span></td>{years.map(year => <td key={year} className="py-1.5 pl-4 text-right tabular-nums text-gray-700">{number.format(Number(row[`${year}_${s.id}`] || 0))}</td>)}</tr>)}</tbody>
          <tfoot><tr className="border-t border-gray-100"><th className="pt-3 text-left font-semibold text-gray-800">Total</th>{years.map(year => <td key={year} className="pl-4 pt-3 text-right font-semibold tabular-nums text-indigo-700">{number.format(series.reduce((sum, s) => sum + Number(row[`${year}_${s.id}`] || 0), 0))} h</td>)}</tr></tfoot>
        </table>
        <button type="button" onClick={() => onWeekSelect(null)} aria-label={language === 'de' ? 'Schliessen' : 'Close'} className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full text-base text-gray-400 hover:bg-gray-100 hover:text-gray-700">×</button>
      </div>;
  };
  const pinnedRow = pinned ? rows.find(row => row.label === `KW ${pinned.week}`) : undefined;
  return <>
    <div className="mb-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500" aria-label={language === 'de' ? 'Moduldurchläufe' : 'Course runs'}>
      {years.map(year => <span key={year} className="inline-flex items-center gap-1.5 rounded-md border border-gray-100 bg-gray-50 px-2 py-1"><span className="h-3 w-2 rounded-t-sm bg-indigo-600" style={{ opacity: year === 2025 ? 0.45 : 1 }} /><strong className="font-semibold text-gray-700">{year}</strong>{compare && <span className="text-gray-400">{year === 2025 ? (language === 'de' ? 'links · hell' : 'left · light') : (language === 'de' ? 'rechts · kräftig' : 'right · solid')}</span>}</span>)}
    </div>
    <div className="statistics-chart-canvas relative" ref={chartRef} role="img" aria-label={language === 'de' ? `Wöchentlicher Workload · Beispieldaten ${years.join(' / ')}` : `Weekly workload · sample data ${years.join(' / ')}`}><ResponsiveContainer width="100%" height="100%"><BarChart data={rows} maxBarSize={compare ? 22 : 30} barGap={3} barCategoryGap="20%" stackOffset="none" margin={{ top: 20, right: 8, bottom: 0, left: -18 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef0f4" /><XAxis dataKey="label" tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false} axisLine={false} /><YAxis domain={[0, compare ? Math.max(current.maximum, previous.maximum) : current.maximum]} allowDataOverflow tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} /><Tooltip cursor={{ fill: '#eef2ff', fillOpacity: 0.55 }} wrapperStyle={{ zIndex: 30, outline: 'none', ...(pinned ? { visibility: 'hidden' as const } : {}) }} content={({ active, payload, label }) => active && payload?.length ? renderPopup(payload[0].payload, String(label)) : null} />{years.flatMap(year => series.map(s => <Bar key={`${year}_${s.id}`} dataKey={`${year}_${s.id}`} name={`${year} · ${s[language]}`} stackId={String(year)} fill={s.color} isAnimationActive={false} shape={(props: any) => {
      const top = [...series].reverse().find(item => Number(props.payload?.[`${year}_${item.id}`]) > 0);
      const isTop = top?.id === s.id;
      const sum = series.reduce((value, item) => value + Number(props.payload?.[`${year}_${item.id}`] || 0), 0);
      return <g tabIndex={props.height > 0 ? 0 : -1} role="button" aria-label={`${props.payload.label}, ${year}`} style={{ cursor: 'pointer' }} onClick={() => pinWeek(pinned?.week === Number(String(props.payload.label).replace('KW ', '')) && pinned?.year === year ? null : { week: Number(String(props.payload.label).replace('KW ', '')), year, population })} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); pinWeek({ week: Number(String(props.payload.label).replace('KW ', '')), year, population }); } }}><Rectangle {...props} fillOpacity={year === 2025 ? 0.45 : 1} radius={isTop ? [4, 4, 0, 0] : [0, 0, 0, 0]} />{isTop && <text x={props.x + props.width / 2} y={props.y - 6} textAnchor="middle" fill={year === 2025 ? '#64748b' : '#334155'} fontSize={compare ? 9 : 10} fontWeight={600} style={{ pointerEvents: 'none' }}>{number.format(sum)}</text>}</g>;
    }} />))}</BarChart></ResponsiveContainer>{pinnedRow && <div className="absolute z-30" style={{ left: pinnedPosition.current.left, top: pinnedPosition.current.top, width: pinnedPosition.current.width || undefined }}>{renderPopup(pinnedRow, `KW ${pinned!.week}`, true)}</div>}</div>
    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">{series.filter(s => faculty || selected.has(s.id)).map(s => <span key={s.id} className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: s.color }} />{s[language]}</span>)}</div>
  </>;
}
