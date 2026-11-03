import { StatisticsDataTable } from './StatisticsDataTable';
import './statistics-dashboard.css';
import { StatisticsModulePicker, StatisticsPeriodPicker, previewModules, previewModuleHours, previewFacultyShares, facultyWorkloadColors, PreviewWorkloadChart, type SelectedPreviewWeek } from './StatisticsPreviewControls';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../app/components/ui/dialog';
import { useCallback, useEffect, useState } from 'react';
import { BarChart3, ChevronDown, ChevronLeft, ChevronRight, Download, Filter, LogOut, Settings2 } from 'lucide-react';
import { ResponsiveContainer, Tooltip, PieChart, Pie, Cell } from 'recharts';
import { useI18n } from '../app/i18n/i18n';
import { LanguageSelector } from '../app/i18n/LanguageSelector';
import logo from '../assets/logoMethric.png';

type Perspective = 'Faculty' | 'Students' | 'Both';
type Metric = 'Workload' | 'Battery' | 'Data Reliability';
const panel = 'rounded-2xl border border-gray-200/80 bg-white p-5 shadow-sm';
const button = 'inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 transition hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-indigo-500 disabled:cursor-not-allowed disabled:opacity-45';

export default function StatisticsDashboard({ onLogout }: { onLogout: () => void }) {
  const { language } = useI18n();
  const de = language === 'de';
  const text = (german: string, english: string) => de ? german : english;
  const [selectedWeek, setSelectedWeek] = useState<SelectedPreviewWeek | null>(null);
  const [period, setPeriod] = useState({ mode: 'dates', start: 39, end: 52 });
  const [selectedModules, setSelectedModules] = useState(() => new Set(previewModules.slice(0, 6).map(m => m.id)));
  const [perspective, setPerspective] = useState<Perspective>('Both');
  const [metric, setMetric] = useState<Metric>('Workload');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [dataOpen, setDataOpen] = useState(false);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [settingsPopulation, setSettingsPopulation] = useState('Faculty');
  const [pieSlide, setPieSlide] = useState('Faculty');
  const selectWeek = useCallback((week: SelectedPreviewWeek | null) => {
    setSelectedWeek(week);
    if (week) setPieSlide(week.population);
  }, []);
  const [pieContent, setPieContent] = useState('battery');
  const populations = perspective === 'Both' ? ['Faculty', 'Students'] : [perspective];
  const labels = { Faculty: 'Faculty', Students: text('Studierende', 'Students'), Both: text('Beide', 'Both') };
  const preview = text('Entwurf · Beispieldaten', 'Design preview · Sample data');
  const placeholder = text('In diesem Entwurf noch nicht verfügbar', 'Not available in this design preview');
  const activation = ['0', '1', '2', '3'];
  const splitOptions = [text('Keine Aufteilung', 'No split'), text('Modul', 'Module'), text('Modultyp', 'Module type')];
  if (perspective === 'Faculty') splitOptions.push(text('Rolle / Gruppe', 'Role / group'));
  if (perspective === 'Students') splitOptions.push(text('Studiensemester', 'Study semester'), text('Lerntyp', 'Learning type'));
  if (perspective === 'Both') splitOptions.push(text('Faculty vs. Studierende', 'Faculty vs. Students'));
  if (perspective !== 'Both') splitOptions.push(text('Aktivierungsgrad Unterricht', 'Class activation'), text('Aktivierungsgrad Selbststudium', 'Self-study activation'));
  splitOptions.push(text('Aktivierungsgrad Gesamtformat', 'Overall activation'));
  if (perspective !== 'Faculty') splitOptions.push(text('Moduldurchlauf / Semester', 'Course run / semester'));
  const unavailable = new Set([
    text('Modultyp', 'Module type'), text('Studiensemester', 'Study semester'), text('Lerntyp', 'Learning type'),
    text('Moduldurchlauf / Semester', 'Course run / semester'),
    text('Aktivierungsgrad Unterricht', 'Class activation'), text('Aktivierungsgrad Selbststudium', 'Self-study activation'), text('Aktivierungsgrad Gesamtformat', 'Overall activation'),
  ]);
  const missingData = text('Noch keine Metadaten vorhanden', 'Metadata not available yet');
  const choice = (label: string, value: string, options: string[] = []) => <label className="grid min-w-0 gap-1.5 text-xs font-medium text-gray-500">{label}<select disabled={unavailable.has(label)} value={value} onChange={() => {}} title={unavailable.has(label) ? missingData : text('Vorschau: Auswahl ändert die Daten noch nicht', 'Preview: selection does not change the data yet')} className="h-10 w-full min-w-0 rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-600 focus-visible:outline-2 focus-visible:outline-indigo-500 disabled:cursor-not-allowed disabled:opacity-50">{[...new Set([value, ...options])].map(option => <option key={option} value={option} disabled={unavailable.has(option)}>{option}{unavailable.has(option) ? ` · ${missingData}` : ''}</option>)}</select></label>;
  const workloadOptions = (population: string) => population === 'Faculty'
    ? [text('Gesamtstunden', 'Total hours'), text('Vorbereitung', 'Preparation'), text('Kontaktzeit', 'Contact'), text('Nachbereitung', 'Follow-up'), text('Administration', 'Administration'), text('Strukturelle Änderungen', 'Structural changes')]
    : [text('Unterricht', 'Class'), text('Selbststudium', 'Self-study'), text('Unterricht + Selbststudium', 'Class + self-study'), text('Administration', 'Administration'), text('Pendeln', 'Commuting'), text('Alles', 'All')];
  const normalizationOptions = (population: string) => [text('Keine', 'None'), text('pro KP', 'per credit'), text('pro SWS', 'per weekly contact hour'), ...(population === 'Faculty' ? [text('pro eingeschriebener Person', 'per enrolled student'), text('pro geprüfter Person', 'per examined student'), text('pro Studierenden-KP', 'per student-credit')] : [])];
  const all = text('Alle', 'All');
  useEffect(() => { setSelectedWeek(null); }, [period, selectedModules, perspective, metric]);
  const carousel = perspective === 'Both' && pieContent === 'workload';
  const piePopulation = carousel ? pieSlide : selectedWeek?.population ?? (perspective === 'Both' ? settingsPopulation : perspective);
  const switchPie = () => setPieSlide(current => current === 'Faculty' ? 'Students' : 'Faculty');
  const pieYear = selectedWeek?.year ?? 2026;
  const pieWeeks = selectedWeek ? [selectedWeek.week] : Array.from({ length: (period.mode === 'weeks' ? period.end - period.start : 13) + 1 }, (_, i) => (period.mode === 'weeks' ? period.start : 39) + i);
  const sampleHours = (module: number) => pieWeeks.reduce((sum, week) => sum + (selectedModules.has(previewModules[module].id) ? previewModuleHours(week, pieYear, module) : 0), 0);
  const facultyHours = (activity: number) => pieWeeks.reduce((sum, week) => sum + previewModules.reduce((hours, module, i) => hours + (selectedModules.has(module.id) ? previewModuleHours(week, pieYear, i) : 0), 0) * previewFacultyShares(week, pieYear)[activity], 0);
  const seed = (selectedWeek?.week ?? 0) + (pieYear === 2025 ? 3 : 0) + (piePopulation === 'Faculty' ? 2 : 0);
  const batteryValues = [8 + seed % 8, 17 + seed % 5, 45 - seed % 7, 0];
  batteryValues[3] = 100 - batteryValues.slice(0, 3).reduce((a, b) => a + b, 0);
  const batteryColors = ['#d94f5c', '#e78086', '#a1b7aa', '#2ca468'];
  const ratingValues = [4 + seed % 3, 9 + seed % 4, 20 + seed % 5, 32 - seed % 4, 0];
  ratingValues[4] = 100 - ratingValues.slice(0, 4).reduce((a, b) => a + b, 0);
  const pieData = pieContent === 'rating' ? ratingValues.map((value, i) => ({ name: `${i + 1}`, value, color: ['#92400e', '#b45309', '#d97706', '#f59e0b', '#fcd34d'][i] })) : pieContent === 'battery' ? ['1–<2', '2–<3', '3–<4', '4–5'].map((name, i) => ({ name, value: batteryValues[i], color: batteryColors[i] })) : piePopulation === 'Faculty' ? [text('Vorbereitung', 'Preparation'), text('Kontaktzeit', 'Contact'), text('Nachbereitung', 'Follow-up')].map((name, i) => ({ name, value: facultyHours(i), color: facultyWorkloadColors[i] })) : previewModules.map((m, i) => ({ name: m[language], value: sampleHours(i), color: m.color })).filter(m => m.value > 0);
  const pieScope = selectedWeek ? `KW ${selectedWeek.week} · ${selectedWeek.year}` : `${text('Gesamter Zeitraum', 'Entire period')} · ${pieYear} · KW ${pieWeeks[0]}–${pieWeeks[pieWeeks.length - 1]}`;



  return <div className="statistics-dashboard bg-gradient-to-br from-indigo-50 via-white to-purple-50 text-gray-800">
    <div className="statistics-shell">
      <header className="statistics-header flex items-center justify-between gap-3">
        <div className="flex items-center gap-4"><img src={logo} alt="mETHric" className="h-7 w-auto" /><span className="hidden h-8 border-l border-gray-200 sm:block" /><div><h1 className="text-base font-semibold tracking-tight">{text('Statistik', 'Statistics')}</h1></div></div>
        <div className="flex items-center gap-2"><a href="/admin" className={button}>{text('Verwaltung', 'Administration')}</a><LanguageSelector /><button onClick={onLogout} className={button} aria-label={text('Abmelden', 'Sign out')}><LogOut className="h-4 w-4" /></button></div>
      </header>
      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}><DialogContent className="statistics-data-dialog bg-white"><DialogHeader><DialogTitle>{text('Filter', 'Filters')} · {labels[perspective]}</DialogTitle></DialogHeader>
        <p className="text-xs text-gray-500">{text('Vorschau der Filteroptionen. Die Beispieldaten bleiben unverändert.', 'Preview of filter options. Sample data remains unchanged.')}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {choice(text('Modul / Module', 'Module / modules'), all, [text('Beispielmodul', 'Example module'), text('Weiteres Beispielmodul', 'Another example module')])}
          {choice(text('Moduldurchlauf / Semester', 'Course run / semester'), all, ['HS25', 'HS26'])}
          {choice(text('Modultyp', 'Module type'), all, [text('Klassische Vorlesung', 'Traditional lecture'), text('Vorlesung mit Übung', 'Lecture with exercises'), 'Flipped Classroom', text('Projektbasierte Lehre', 'Project-based teaching')])}
          {choice(text('Aktivierungsgrad Unterricht', 'Class activation'), all, activation.map(v => 'U' + v))}
          {choice(text('Aktivierungsgrad Selbststudium', 'Self-study activation'), all, activation.map(v => 'S' + v))}
          {choice(text('Aktivierungsgrad Gesamtformat', 'Overall activation'), all, activation.map(v => 'A' + v))}
          {perspective === 'Faculty' && choice(text('Rolle / Gruppe', 'Role / group'), all, [text('Professor:innen', 'Professors'), text('Dozierende', 'Lecturers'), text('Wissenschaftliche Mitarbeitende', 'Scientific staff'), text('Doktorierende', 'Doctoral candidates'), text('Lehrassistierende', 'Teaching assistants'), text('Studentische Assistierende', 'Student assistants'), text('Externe Gastdozierende', 'External guest lecturers')])}
          {perspective === 'Students' && choice(text('Studiensemester', 'Study semester'), all, ['1', '3', '5'])}
          {perspective === 'Students' && choice(text('Lerntyp', 'Learning type'), all, [text('Minimalist', 'Minimalist'), text('Last-Minute-Experte', 'Last-minute expert'), text('Perfektionist', 'Perfectionist')])}
          {perspective === 'Students' && choice(text('Teilnahmestatus', 'Participation status'), all, [text('Studie abgeschlossen', 'Study completed'), text('Vorzeitig ausgestiegen', 'Withdrawn early')])}
          {choice(text('Geschätzte HS25-Daten', 'Estimated HS25 data'), text('Einschliessen', 'Include'), [text('Ausschliessen', 'Exclude'), text('Nur geschätzte Daten', 'Estimated data only')])}
        </div>
      </DialogContent></Dialog>
      <main className="statistics-layout">
        <div className="statistics-primary">
      <section className={`${panel} statistics-filters`} aria-label={text('Auswahl und Filter', 'Selection and filters')}>
        <div className="statistics-filter-fields">
          <div><p className="mb-1.5 text-xs font-medium text-gray-500">{text('Perspektive', 'Perspective')}</p><div className="flex rounded-xl bg-gray-100 p-1">{(['Faculty', 'Students', 'Both'] as const).map(p => <button key={p} onClick={() => setPerspective(p)} aria-pressed={perspective === p} className={`rounded-lg px-2 py-2 text-xs font-medium transition ${perspective === p ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>{labels[p]}</button>)}</div></div>
          <StatisticsModulePicker selected={selectedModules} onChange={setSelectedModules} />
          <StatisticsPeriodPicker onChange={setPeriod} />
          <div className="min-w-0">{choice(text('Aufteilen nach', 'Split by'), perspective === 'Students' ? text('Modul', 'Module') : text('Keine Aufteilung', 'No split'), splitOptions)}</div>
          <button onClick={() => setFiltersOpen(true)} className={button}><Filter className="h-4 w-4" />{text('Filter', 'Filters')}</button>
          <button disabled title={placeholder} className={button}><Download className="h-4 w-4" />CSV</button>
        </div>
        <button disabled title={placeholder} className="statistics-reset text-xs text-gray-400">{text('Zurücksetzen', 'Reset filters')}</button>
        <button onClick={() => setAnalysisOpen(true)} className={`${button} statistics-analysis-toggle`}><Settings2 className="h-4 w-4" />{text('Analyse', 'Analysis')}</button>
      </section>
          <section className={`${panel} statistics-chart`}>
            <div className="mb-2 flex items-start justify-between gap-4"><div><h2 className="text-lg font-semibold">{text('Workload im Zeitverlauf', 'Workload over time')}</h2><p className="mt-1 text-xs text-gray-500">{text('Wöchentlich · Beispieldaten · Semesterzuordnung illustrativ', 'Weekly · Sample data · Illustrative semester assignments')}</p></div><span className="rounded-lg bg-gray-50 px-3 py-1.5 text-xs text-gray-500">{text('Wochen', 'Weeks')}</span></div>
            {metric === 'Workload' ? <div className="statistics-plots">{populations.map(population => <div key={population} className="statistics-plot">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">{population === 'Faculty' ? 'Faculty' : labels.Students}</h3><span className="text-xs text-gray-500">{population === 'Faculty' ? text('Summe · Stunden', 'Sum · Hours') : text('Mittelwert pro Person · Stunden', 'Mean per person · Hours')}</span></div>
              <PreviewWorkloadChart population={population} selected={selectedModules} period={period} selectedWeek={selectedWeek} onWeekSelect={selectWeek} />

            </div>)}</div> : <div className="statistics-empty-chart flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-gray-200 bg-gray-50 text-center"><BarChart3 className="h-8 w-8 text-indigo-300" /><p className="text-sm font-medium">{metric}</p><p className="max-w-xs text-xs text-gray-500">{text('Hier erscheint der wöchentliche Verlauf auf der Skala 1–5.', 'The weekly trend on the 1–5 scale will appear here.')}</p></div>}
          </section>
          <button onClick={() => setDataOpen(true)} className={`${panel} statistics-data-button flex items-center justify-between text-sm font-semibold`}>{text('Aggregierte Daten anzeigen', 'Show aggregated data')}<ChevronDown className="h-4 w-4 text-gray-400 transition group-open:rotate-180" /></button><Dialog open={dataOpen} onOpenChange={setDataOpen}><DialogContent className="statistics-data-dialog statistics-table-dialog bg-white"><DialogHeader><DialogTitle>{text('Aggregierte Daten', 'Aggregated data')}</DialogTitle></DialogHeader><StatisticsDataTable perspective={perspective} selected={selectedModules} period={period} /></DialogContent></Dialog>
        </div>
        <aside className={`statistics-analysis ${analysisOpen ? 'statistics-analysis-open' : ''}`} aria-label={text('Analyse', 'Analysis')}>
          <section className={`${panel} statistics-settings`}><button className="statistics-analysis-close text-xs text-indigo-700" onClick={() => setAnalysisOpen(false)}>{text('Schliessen', 'Close')}</button><h2 className="mb-2 text-sm font-semibold">{text('Analyse', 'Analysis')}</h2><div className="flex flex-wrap gap-1 rounded-xl bg-gray-100 p-1">{(['Workload', 'Battery', 'Data Reliability'] as const).map(m => <button key={m} onClick={() => setMetric(m)} aria-pressed={metric === m} className={`flex-1 whitespace-nowrap rounded-lg px-2 py-2 text-xs font-medium ${metric === m ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500'}`}>{m}</button>)}</div>
            {perspective === 'Both' && <div className="mt-3 flex gap-2">{populations.map(p => <button key={p} onClick={() => setSettingsPopulation(p)} aria-pressed={settingsPopulation === p} className={`rounded-lg px-3 py-1.5 text-xs ${settingsPopulation === p ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500'}`}>{p === 'Faculty' ? p : labels.Students}</button>)}</div>}
            {(perspective === 'Both' ? [settingsPopulation] : populations).map(population => <div key={population} className="mt-3 space-y-2 border-t border-gray-100 pt-2"><h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">{population === 'Faculty' ? 'Faculty' : labels.Students}</h3>{metric === 'Workload' && choice(text('Workload-Art', 'Workload type'), population === 'Faculty' ? text('Gesamtstunden', 'Total hours') : text('Unterricht + Selbststudium', 'Class + self-study'), workloadOptions(population))}{choice(text('Berechnung', 'Calculation'), metric === 'Battery' ? text('Mittelwert', 'Mean') : metric !== 'Workload' ? 'Median' : population === 'Faculty' ? text('Summe', 'Sum') : text('Mittelwert pro Person', 'Mean per person'), metric === 'Workload' ? [text('Summe', 'Sum'), text('Mittelwert pro Person', 'Mean per person'), text('Median pro Person', 'Median per person')] : [text('Mittelwert', 'Mean'), 'Median', ...(metric === 'Battery' ? [text('75. Perzentil', '75th percentile')] : [])])}{metric === 'Workload' && choice(text('Normierung', 'Normalization'), text('Keine', 'None'), normalizationOptions(population))}{metric === 'Battery' && <p className="text-xs text-gray-500">{text('Wöchentlicher Mittelwert je Person, danach gleiche Gewichtung aller Personen.', 'Weekly mean per person, then equal weight for every person.')}</p>}</div>)}
          </section>
          <section className={`${panel} statistics-summary`}>
            <div className="flex flex-wrap gap-1 border-b border-gray-100 pb-2">{[['battery', 'Battery'], ['workload', text('Workload-Anteile', 'Workload shares')], ['rating', 'Data Rating']].map(([value, label]) => <button key={value} onClick={() => setPieContent(value)} aria-pressed={pieContent === value} className={`rounded-lg px-2 py-1 text-xs ${pieContent === value ? 'bg-indigo-50 text-indigo-700' : 'text-gray-400'}`}>{label}</button>)}</div>
            <div className="statistics-summary-content flex flex-col gap-1">
              <div className="flex items-start justify-between gap-2"><div><p className="text-xs font-semibold text-gray-700">{pieScope}</p><p className="text-xs text-gray-500">{piePopulation === 'Faculty' ? 'Faculty' : labels.Students} · {text('Beispieldaten', 'Sample data')}</p></div>{selectedWeek && <button onClick={() => setSelectedWeek(null)} aria-label={text('Wochenauswahl aufheben', 'Clear selected week')} className="px-1 text-gray-400">×</button>}</div>
              <p className="text-xs text-gray-500">{pieContent === 'rating' ? text('Verteilung der Datenbewertungen (1–5)', 'Data rating distribution (1–5)') : pieContent === 'battery' ? selectedWeek ? text('Personen nach wöchentlichem Battery-Mittelwert', 'People by weekly mean Battery') : text('Personen nach Battery-Mittelwert im Zeitraum', 'People by mean Battery over the period') : text('Anteile der erfassten Stunden', 'Shares of recorded hours')}</p>
              <div className="relative w-full min-h-0 flex-1" style={{ minHeight: 80, paddingInline: carousel ? 22 : 0 }}><ResponsiveContainer width="100%" height="100%"><PieChart><Pie animationBegin={0} animationDuration={220} animationEasing="ease-out" data={pieData} dataKey="value" nameKey="name" innerRadius="50%" outerRadius="85%" paddingAngle={2}>{pieData.map(item => <Cell key={item.name} fill={item.color} />)}</Pie><Tooltip formatter={(value: number) => pieContent !== 'workload' ? `${value}%` : `${value.toFixed(1)} h`} contentStyle={{ borderRadius: 12, borderColor: '#e5e7eb', fontSize: 12 }} /></PieChart></ResponsiveContainer>{carousel && <div onPointerDown={event => event.stopPropagation()}>
                <button type="button" onClick={switchPie} aria-label={text('Vorheriges Workload-Diagramm', 'Previous workload chart')} className="absolute left-0 top-1/2 -translate-y-1/2 rounded-full border border-gray-200 bg-white p-1 text-gray-500 shadow-sm hover:bg-indigo-50 hover:text-indigo-700 focus-visible:outline-2 focus-visible:outline-indigo-500"><ChevronLeft className="h-4 w-4" /></button>
                <button type="button" onClick={switchPie} aria-label={text('Nächstes Workload-Diagramm', 'Next workload chart')} className="absolute right-0 top-1/2 -translate-y-1/2 rounded-full border border-gray-200 bg-white p-1 text-gray-500 shadow-sm hover:bg-indigo-50 hover:text-indigo-700 focus-visible:outline-2 focus-visible:outline-indigo-500"><ChevronRight className="h-4 w-4" /></button>
              </div>}</div>
              {carousel && <div className="flex items-center justify-center gap-2" onPointerDown={event => event.stopPropagation()} aria-label={text('Workload-Diagramm auswählen', 'Select workload chart')}>{['Faculty', 'Students'].map(population => <button key={population} onClick={() => setPieSlide(population)} aria-label={population === 'Faculty' ? 'Faculty' : labels.Students} aria-pressed={pieSlide === population} className={`h-1.5 rounded-full transition-all ${pieSlide === population ? 'w-5 bg-indigo-500' : 'w-1.5 bg-gray-200 hover:bg-gray-400'}`} />)}</div>}
              {pieContent !== 'workload' && <p className="text-xs text-gray-400">{pieContent === 'rating' ? text('Anteile der abgegebenen Bewertungen.', 'Shares of submitted ratings.') : text('Mittelwerte in Bereiche gruppiert. Jede Person zählt einmal.', 'Means grouped into ranges. Each person counts once.')}<span className="mt-1 flex flex-wrap gap-x-2 gap-y-1">{pieData.map(item => <span key={item.name} className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: item.color }} />{item.name}</span>)}</span></p>}
            </div>
          </section>
        </aside>
      </main>
    </div>
  </div>;
}
