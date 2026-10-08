import { AnalyticsPolicy, DateRange, PeriodPreset } from '../../analytics/workload';
import { useI18n } from '../../i18n/i18n';

interface Props {
  policy: AnalyticsPolicy;
  value: PeriodPreset;
  range: DateRange;
  onChange: (preset: PeriodPreset, range?: DateRange) => void;
}

export function TimeRangeFilter({ policy, value, range, onChange }: Props) {
  const { t } = useI18n();
  return (
    <div className="mb-3 space-y-1.5" role="group" aria-label={t('analytics.period')}
      title={policy.restricted ? t('analytics.restricted') : undefined}>
      <div className="period-filter-scroll flex flex-nowrap gap-1.5 overflow-x-auto pb-1" tabIndex={0} aria-label={t('analytics.period')}>
        {(['last7', 'last14', 'last30', 'all'] as PeriodPreset[]).map(preset => (
          <button key={preset} type="button" disabled={policy.restricted && preset !== 'last14'}
            aria-pressed={value === preset} onClick={() => onChange(preset)}
            className={`shrink-0 whitespace-nowrap rounded-lg border px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-indigo-500 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-50 disabled:text-gray-400 ${value === preset ? 'border-indigo-800 bg-indigo-800 text-white' : 'border-gray-300 bg-white text-gray-600 hover:bg-indigo-50'}`}>
            {t(`analytics.${preset}`)}
          </button>
        ))}
      </div>
      <div className="flex min-w-0 items-center gap-1.5">
        <input type="date" aria-label={t('analytics.start')} value={range.start} max={range.end}
          disabled={policy.restricted} onChange={event => event.target.value && onChange('custom', { ...range, start: event.target.value })}
          className="w-0 min-w-0 max-w-32 flex-1 rounded-lg border border-gray-200 px-1.5 py-1.5 text-xs disabled:bg-gray-50 disabled:text-gray-400" />
        <span aria-hidden="true" className="text-gray-400">–</span>
        <input type="date" aria-label={t('analytics.end')} value={range.end} min={range.start}
          disabled={policy.restricted} onChange={event => event.target.value && onChange('custom', { ...range, end: event.target.value })}
          className="w-0 min-w-0 max-w-32 flex-1 rounded-lg border border-gray-200 px-1.5 py-1.5 text-xs disabled:bg-gray-50 disabled:text-gray-400" />
      </div>
    </div>
  );
}
