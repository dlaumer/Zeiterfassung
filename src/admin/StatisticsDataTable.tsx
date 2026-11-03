import { useState } from 'react';
import { useI18n } from '../app/i18n/i18n';
import { previewModules, previewModuleHours, previewFacultyShares } from './StatisticsPreviewControls';

export function StatisticsDataTable({ perspective, selected, period }: { perspective: string; selected: Set<string>; period: { mode: string; start: number; end: number } }) {
  const { language } = useI18n();
  const de = language === 'de';
  const [copied, setCopied] = useState('');
  const [copyError, setCopyError] = useState(false);
  const years = period.mode === 'weeks' ? [2025, 2026] : [2026];
  const start = period.mode === 'weeks' ? period.start : 39;
  const end = period.mode === 'weeks' ? period.end : 52;
  const populations = perspective === 'Both' ? ['Faculty', 'Students'] : [perspective];
  const number = new Intl.NumberFormat(de ? 'de-CH' : 'en', { maximumFractionDigits: 0 });
  return <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_190px]">
    <div className="min-w-0 space-y-6">
      <p className="text-xs text-gray-500">{de ? 'Eine Zeile pro Säule. Alle Werte in Stunden; dieselben Beispieldaten wie im Diagramm. Die Wochenauswahl im Diagramm schränkt diese Tabelle nicht ein.' : 'One row per bar. All values in hours, using the same sample data as the chart. Selecting a week in the chart does not restrict this table.'}</p>
      {populations.map(population => {
        const faculty = population === 'Faculty';
        const columns = faculty ? (de ? ['Vorbereitung', 'Kontaktzeit', 'Nachbereitung'] : ['Preparation', 'Contact', 'Follow-up']) : previewModules.filter(m => selected.has(m.id)).map(m => m[language]);
        const headers = [de ? 'Jahr' : 'Year', 'KW', ...columns, de ? 'Gesamt (h)' : 'Total (h)'];
        const rows = Array.from({ length: end - start + 1 }, (_, i) => start + i).flatMap(week => years.filter(year => !(year === 2025 && week === 53)).map(year => {
          const hours = previewModules.map((m, i) => selected.has(m.id) ? previewModuleHours(week, year, i) : 0);
          const total = hours.reduce((a, b) => a + b, 0);
          const values = faculty ? previewFacultyShares(week, year).map(share => total * share) : hours.filter((_, i) => selected.has(previewModules[i].id));
          return [year, week, ...values, total];
        }));
        const title = faculty ? 'Faculty' : de ? 'Studierende' : 'Students';
        return <section key={population} className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-sm font-semibold">{title}</h3><p className="text-xs text-gray-500">{faculty ? (de ? 'Summe des Lehrteams' : 'Teaching-team sum') : (de ? 'Mittelwert pro Person' : 'Mean per person')}</p></div><button className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-indigo-700 hover:bg-indigo-50" onClick={async () => { try { await navigator.clipboard.writeText([headers.join('\t'), ...rows.map(row => row.map((value, index) => index < 2 ? String(value) : String(Math.round(value))).join('\t'))].join('\n')); setCopied(population); setCopyError(false); } catch { setCopyError(true); } }}>{copied === population ? (de ? 'Kopiert' : 'Copied') : (de ? 'Für Excel kopieren' : 'Copy for Excel')}</button></div>
          <div className="max-w-full overflow-x-auto rounded-lg border border-gray-200"><table className="w-full text-left text-xs"><caption className="sr-only">{title} · {de ? 'Beispieldaten in Stunden' : 'Sample data in hours'}</caption><thead className="bg-gray-50 text-gray-500"><tr>{headers.map((header, i) => <th key={`${header}-${i}`} className="min-w-20 px-3 py-3 font-medium">{header}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={i} className="border-t border-gray-100 even:bg-gray-50/50">{row.map((value, index) => <td key={index} className={`whitespace-nowrap px-3 py-2 tabular-nums ${index === row.length - 1 ? 'font-semibold text-gray-800' : 'text-gray-600'}`}>{index < 2 ? value : number.format(value)}</td>)}</tr>)}</tbody></table></div>
        </section>;
      })}
      <p className="text-xs text-gray-400">{de ? 'Alle Stundenwerte sind auf volle Stunden gerundet, auch beim Kopieren für Excel. Gesamtsummen werden vor dem Runden berechnet.' : 'All hour values are rounded to whole hours, including when copied for Excel. Totals are calculated before rounding.'}</p>
      {copyError && <p role="status" className="text-xs text-amber-700">{de ? 'Kopieren nicht verfügbar. Die Tabelle kann direkt markiert und kopiert werden.' : 'Clipboard unavailable. Select and copy the table directly.'}</p>}
    </div>
    <aside className="h-fit rounded-xl bg-gray-50 p-4 text-xs text-gray-500"><h3 className="mb-3 font-semibold text-gray-700">{de ? 'Metadaten' : 'Metadata'}</h3><dl className="space-y-3">{[de ? 'Personenanzahl' : 'People count', de ? 'Fehlende Erfassungen' : 'Missing entries', de ? 'Anteil geschätzter Daten' : 'Estimated share'].map(label => <div key={label}><dt>{label}</dt><dd className="mt-1 text-gray-400">{de ? 'Noch nicht verfügbar' : 'Not available yet'}</dd></div>)}</dl><p className="mt-4">{de ? 'Beispieldaten · Keine individuellen Personendaten' : 'Sample data · No individual participant data'}</p></aside>
  </div>;
}
