import './statistics-dashboard.css';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../app/components/ui/dialog';
import { useState } from 'react';
import { BarChart3, ChevronDown, Download, Filter, LogOut, Settings2 } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useI18n } from '../app/i18n/i18n';
import { LanguageSelector } from '../app/i18n/LanguageSelector';
import logo from '../assets/logoMethric.png';

type Perspective = 'Faculty' | 'Students' | 'Both';
type Metric = 'Workload' | 'Battery' | 'Data Reliability';
const sample = [
  { week: 'KW 39', preparation: 18, contact: 12, followup: 6, study: 7, class: 4 },
  { week: 'KW 40', preparation: 23, contact: 12, followup: 8, study: 9, class: 4 },
  { week: 'KW 41', preparation: 15, contact: 14, followup: 7, study: 6, class: 5 },
  { week: 'KW 42', preparation: 28, contact: 12, followup: 9, study: 11, class: 4 },
  { week: 'KW 43', preparation: 20, contact: 16, followup: 8, study: 8, class: 6 },
  { week: 'KW 44', preparation: 17, contact: 12, followup: 6, study: 7, class: 4 },
  { week: 'KW 45', preparation: 21, contact: 14, followup: 7, study: 9, class: 5 },
  { week: 'KW 46', preparation: 16, contact: 12, followup: 8, study: 8, class: 4 },
  { week: 'KW 47', preparation: 24, contact: 16, followup: 9, study: 12, class: 6 },
  { week: 'KW 48', preparation: 19, contact: 14, followup: 6, study: 10, class: 5 },
  { week: 'KW 49', preparation: 27, contact: 12, followup: 10, study: 13, class: 4 },
  { week: 'KW 50', preparation: 22, contact: 16, followup: 8, study: 11, class: 6 },
  { week: 'KW 51', preparation: 14, contact: 10, followup: 7, study: 9, class: 3 },
  { week: 'KW 52', preparation: 10, contact: 6, followup: 5, study: 6, class: 2 },
];
const panel = 'rounded-2xl border border-gray-200/80 bg-white p-5 shadow-sm';
const button = 'inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 transition hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-indigo-500 disabled:cursor-not-allowed disabled:opacity-45';

export default function StatisticsDashboard({ onLogout }: { onLogout: () => void }) {
  const { language } = useI18n();
  const de = language === 'de';
  const text = (german: string, english: string) => de ? german : english;
  const [perspective, setPerspective] = useState<Perspective>('Both');
  const [metric, setMetric] = useState<Metric>('Workload');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [dataOpen, setDataOpen] = useState(false);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [settingsPopulation, setSettingsPopulation] = useState('Faculty');
  const [tab, setTab] = useState('comparison');
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
  const choice = (label: string, value: string, options: string[] = []) => <label className="grid min-w-0 gap-1.5 text-xs font-medium text-gray-500">{label}<select value={value} onChange={() => {}} title={text('Vorschau: Auswahl ändert die Daten noch nicht', 'Preview: selection does not change the data yet')} className="h-10 w-full min-w-0 rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-600 focus-visible:outline-2 focus-visible:outline-indigo-500">{[...new Set([value, ...options])].map(option => <option key={option} value={option}>{option}</option>)}</select></label>;
  const workloadOptions = (population: string) => population === 'Faculty'
    ? [text('Gesamtstunden', 'Total hours'), text('Vorbereitung', 'Preparation'), text('Kontaktzeit', 'Contact'), text('Nachbereitung', 'Follow-up'), text('Administration', 'Administration'), text('Strukturelle Änderungen', 'Structural changes')]
    : [text('Unterricht', 'Class'), text('Selbststudium', 'Self-study'), text('Unterricht + Selbststudium', 'Class + self-study'), text('Administration', 'Administration'), text('Pendeln', 'Commuting'), text('Alles', 'All')];
  const normalizationOptions = (population: string) => [text('Keine', 'None'), text('pro KP', 'per credit'), text('pro SWS', 'per weekly contact hour'), ...(population === 'Faculty' ? [text('pro eingeschriebener Person', 'per enrolled student'), text('pro geprüfter Person', 'per examined student'), text('pro Studierenden-KP', 'per student-credit')] : [])];
  const all = text('Alle', 'All');


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
          {choice(text('Modultyp', 'Module type'), all, ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'])}
          {choice(text('Aktivierungsgrad Unterricht', 'Class activation'), all, activation.map(v => 'U' + v))}
          {choice(text('Aktivierungsgrad Selbststudium', 'Self-study activation'), all, activation.map(v => 'S' + v))}
          {choice(text('Aktivierungsgrad Gesamtformat', 'Overall activation'), all, activation.map(v => 'A' + v))}
          {perspective === 'Faculty' && choice(text('Rolle / Gruppe', 'Role / group'), all, [text('Professor:innen', 'Professors'), text('Dozierende', 'Lecturers'), text('Wissenschaftliche Mitarbeitende', 'Scientific staff'), text('Doktorierende', 'Doctoral candidates'), text('Lehrassistierende', 'Teaching assistants'), text('Studentische Assistierende', 'Student assistants'), text('Externe Gastdozierende', 'External guest lecturers')])}
          {perspective === 'Students' && choice(text('Lerntyp', 'Learning type'), all, [text('Beispiel-Lerntyp A', 'Example learning type A'), text('Beispiel-Lerntyp B', 'Example learning type B')])}
          {perspective === 'Students' && choice(text('Teilnahmestatus', 'Participation status'), all, [text('Studie abgeschlossen', 'Study completed'), text('Vorzeitig ausgestiegen', 'Withdrawn early')])}
          {choice(text('Geschätzte HS25-Daten', 'Estimated HS25 data'), text('Einschliessen', 'Include'), [text('Ausschliessen', 'Exclude'), text('Nur geschätzte Daten', 'Estimated data only')])}
          {perspective !== 'Both' && choice(text('Person (Admin-Datenkontrolle)', 'Person (admin data review)'), all, [text('Beispielperson A', 'Example person A'), text('Beispielperson B', 'Example person B')])}
        </div>
      </DialogContent></Dialog>
      <main className="statistics-layout">
        <div className="statistics-primary">
      <section className={`${panel} statistics-filters`} aria-label={text('Auswahl und Filter', 'Selection and filters')}>
        <div className="statistics-filter-fields">
          <div><p className="mb-1.5 text-xs font-medium text-gray-500">{text('Perspektive', 'Perspective')}</p><div className="flex rounded-xl bg-gray-100 p-1">{(['Faculty', 'Students', 'Both'] as const).map(p => <button key={p} onClick={() => setPerspective(p)} aria-pressed={perspective === p} className={`rounded-lg px-2 py-2 text-xs font-medium transition ${perspective === p ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>{labels[p]}</button>)}</div></div>
          <div className="min-w-0">{choice(text('Modul / Durchlauf', 'Module / course run'), text('Beispielmodul · HS26', 'Example module · HS26'), [all, text('Beispielmodul · HS25', 'Example module · HS25'), text('Weiteres Beispielmodul · HS26', 'Another example module · HS26')])}</div>
          <div className="min-w-0">{choice(text('Zeitraum', 'Period'), '21.09. – 27.12.2026', [text('Letzte Woche', 'Last week'), text('Letzter Monat', 'Last month'), all, text('Benutzerdefiniert von–bis', 'Custom from–to')])}</div>
          <div className="min-w-0">{choice(text('Aufteilen nach', 'Split by'), text('Keine Aufteilung', 'No split'), splitOptions)}</div>
          <button onClick={() => setFiltersOpen(true)} className={button}><Filter className="h-4 w-4" />{text('Filter', 'Filters')}</button>
          <button disabled title={placeholder} className={button}><Download className="h-4 w-4" />CSV</button>
        </div>
        <button disabled title={placeholder} className="statistics-reset text-xs text-gray-400">{text('Zurücksetzen', 'Reset filters')}</button>
        <button onClick={() => setAnalysisOpen(true)} className={`${button} statistics-analysis-toggle`}><Settings2 className="h-4 w-4" />{text('Analyse', 'Analysis')}</button>
      </section>
          <section className={`${panel} statistics-chart`}>
            <div className="mb-2 flex items-start justify-between gap-4"><div><h2 className="text-lg font-semibold">{text('Workload im Zeitverlauf', 'Workload over time')}</h2><p className="mt-1 text-xs text-gray-500">{text('Wöchentlich · Beispielmodul · HS26 · Beispieldaten', 'Weekly · Example module · HS26 · Sample data')}</p></div><span className="rounded-lg bg-gray-50 px-3 py-1.5 text-xs text-gray-500">{text('Wochen', 'Weeks')}</span></div>
            {metric === 'Workload' ? <div className="statistics-plots">{populations.map(population => <div key={population} className="statistics-plot">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">{population === 'Faculty' ? 'Faculty' : labels.Students}</h3><span className="text-xs text-gray-500">{population === 'Faculty' ? text('Summe · Stunden', 'Sum · Hours') : text('Median pro Person · Stunden', 'Median per person · Hours')}</span></div>
              <div className="statistics-chart-canvas" role="img" aria-label={`${population}: ${text('wöchentlicher Workload, Beispieldaten', 'weekly workload, sample data')}`}><ResponsiveContainer width="100%" height="100%"><BarChart data={sample} barSize={30} margin={{ top: 5, right: 8, bottom: 0, left: -18 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef0f4" /><XAxis dataKey="week" tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} /><YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} /><Tooltip cursor={{ fill: '#f5f3ff' }} contentStyle={{ borderRadius: 12, borderColor: '#e5e7eb', fontSize: 12 }} />{population === 'Faculty' ? <><Bar dataKey="preparation" name={text('Vorbereitung', 'Preparation')} stackId="work" fill="#818cf8" /><Bar dataKey="contact" name={text('Kontaktzeit', 'Contact')} stackId="work" fill="#4f46e5" /><Bar dataKey="followup" name={text('Nachbereitung', 'Follow-up')} stackId="work" fill="#c7d2fe" radius={[4, 4, 0, 0]} /></> : <><Bar dataKey="class" name={text('Unterricht', 'Class')} stackId="work" fill="#0d9488" /><Bar dataKey="study" name={text('Selbststudium', 'Self-study')} stackId="work" fill="#5eead4" radius={[4, 4, 0, 0]} /></>}</BarChart></ResponsiveContainer></div>
              <div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-500">{(population === 'Faculty' ? [[text('Vorbereitung', 'Preparation'), '#818cf8'], [text('Kontaktzeit', 'Contact'), '#4f46e5'], [text('Nachbereitung', 'Follow-up'), '#c7d2fe']] : [[text('Unterricht', 'Class'), '#0d9488'], [text('Selbststudium', 'Self-study'), '#5eead4']]).map(([label, color]) => <span key={label} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />{label}</span>)}</div>
            </div>)}</div> : <div className="statistics-empty-chart flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-gray-200 bg-gray-50 text-center"><BarChart3 className="h-8 w-8 text-indigo-300" /><p className="text-sm font-medium">{metric}</p><p className="max-w-xs text-xs text-gray-500">{text('Hier erscheint der wöchentliche Verlauf auf der Skala 1–5.', 'The weekly trend on the 1–5 scale will appear here.')}</p></div>}
          </section>
          <button onClick={() => setDataOpen(true)} className={`${panel} statistics-data-button flex items-center justify-between text-sm font-semibold`}>{text('Aggregierte Daten anzeigen', 'Show aggregated data')}<ChevronDown className="h-4 w-4 text-gray-400 transition group-open:rotate-180" /></button><Dialog open={dataOpen} onOpenChange={setDataOpen}><DialogContent className="statistics-data-dialog bg-white"><DialogHeader><DialogTitle>{text('Aggregierte Daten', 'Aggregated data')}</DialogTitle></DialogHeader><p className="mt-3 text-xs text-gray-500">{text('Platzhalter für die angezeigten Wochenwerte, Personenanzahl, fehlende Erfassungen und geschätzten Anteile.', 'Space for the displayed weekly values, participant counts, missing entries and estimated shares.')}</p><div className="mt-4 min-w-0"><table className="w-full text-left text-xs"><caption className="mb-3 text-left text-gray-400">{preview}</caption><thead className="border-b border-gray-200 text-gray-500"><tr>{[text('Woche', 'Week'), text('Personen', 'People'), text('Fehlend', 'Missing'), text('Geschätzt', 'Estimated')].map(h => <th key={h} className="px-3 py-3 font-medium">{h}</th>)}</tr></thead><tbody>{sample.map(row => <tr key={row.week} className="border-b border-gray-100"><td className="px-3 py-3">{row.week}</td><td className="px-3">—</td><td className="px-3">—</td><td className="px-3">—</td></tr>)}</tbody></table></div></DialogContent></Dialog>
        </div>
        <aside className={`statistics-analysis ${analysisOpen ? 'statistics-analysis-open' : ''}`} aria-label={text('Analyse', 'Analysis')}>
          <section className={`${panel} statistics-settings`}><button className="statistics-analysis-close text-xs text-indigo-700" onClick={() => setAnalysisOpen(false)}>{text('Schliessen', 'Close')}</button><h2 className="mb-2 text-sm font-semibold">{text('Analyse', 'Analysis')}</h2><div className="flex flex-wrap gap-1 rounded-xl bg-gray-100 p-1">{(['Workload', 'Battery', 'Data Reliability'] as const).map(m => <button key={m} onClick={() => setMetric(m)} aria-pressed={metric === m} className={`flex-1 whitespace-nowrap rounded-lg px-2 py-2 text-xs font-medium ${metric === m ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500'}`}>{m}</button>)}</div>
            {perspective === 'Both' && <div className="mt-3 flex gap-2">{populations.map(p => <button key={p} onClick={() => setSettingsPopulation(p)} aria-pressed={settingsPopulation === p} className={`rounded-lg px-3 py-1.5 text-xs ${settingsPopulation === p ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500'}`}>{p === 'Faculty' ? p : labels.Students}</button>)}</div>}
            {(perspective === 'Both' ? [settingsPopulation] : populations).map(population => <div key={population} className="mt-3 space-y-2 border-t border-gray-100 pt-2"><h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">{population === 'Faculty' ? 'Faculty' : labels.Students}</h3>{metric === 'Workload' && choice(text('Workload-Art', 'Workload type'), population === 'Faculty' ? text('Gesamtstunden', 'Total hours') : text('Unterricht + Selbststudium', 'Class + self-study'), workloadOptions(population))}{choice(text('Berechnung', 'Calculation'), metric !== 'Workload' ? 'Median' : population === 'Faculty' ? text('Summe', 'Sum') : text('Median pro Person', 'Median per person'), metric === 'Workload' ? [text('Summe', 'Sum'), text('Mittelwert pro Person', 'Mean per person'), text('Median pro Person', 'Median per person')] : ['Median', text('Mittelwert', 'Mean')])}{metric === 'Workload' && choice(text('Normierung', 'Normalization'), text('Keine', 'None'), normalizationOptions(population))}</div>)}
          </section>
          <section className={`${panel} statistics-summary`}><div className="flex border-b border-gray-100">{[['comparison', text('Vergleich', 'Comparison')], ['distribution', text('Verteilung', 'Distribution')], ['figures', text('Kennzahlen', 'Key figures')]].map(([value, label]) => <button key={value} onClick={() => setTab(value)} aria-pressed={tab === value} className={`flex-1 border-b-2 px-1 pb-3 text-xs font-medium ${tab === value ? 'border-indigo-500 text-indigo-700' : 'border-transparent text-gray-400'}`}>{label}</button>)}</div><div className="statistics-summary-content flex flex-col items-center justify-center gap-2 py-3 text-center"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-400"><BarChart3 className="h-6 w-6" /></div><p className="text-sm font-medium">{tab === 'comparison' ? text('Der gewählte Zeitraum im Überblick', 'The selected period at a glance') : tab === 'distribution' ? text('Anteile und Antwortverteilung', 'Shares and response distribution') : text('Die wichtigsten Kennzahlen', 'Key figures at a glance')}</p><p className="max-w-64 text-xs leading-relaxed text-gray-500">{tab === 'comparison' ? text('Platz für den Vergleich nach Modul oder Gruppe.', 'Space for comparison by module or group.') : tab === 'distribution' ? text('Platz für ein Donutdiagramm passend zur Kennzahl.', 'Space for a donut chart matching the selected metric.') : text('Stunden, Personen, Module und Datenstatus.', 'Hours, people, modules and data status.')}</p></div></section>
        </aside>
      </main>
    </div>
  </div>;
}
