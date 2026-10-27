import { AnalyticsPolicy, DateRange, PeriodPreset } from '../../analytics/workload';
import { useI18n } from '../../i18n/i18n';
import { ReactNode, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { getDateLocale } from '../../i18n/dateLocale';
import { Calendar } from '../ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { CalendarDays } from 'lucide-react';

interface Props {
  policy: AnalyticsPolicy;
  value: PeriodPreset;
  range: DateRange;
  rangeBounds?: DateRange;
  onChange: (preset: PeriodPreset, range?: DateRange) => void;
  trailingControl?: ReactNode;
}

export function TimeRangeFilter({ policy, value, range, rangeBounds, onChange, trailingControl }: Props) {
  const { t } = useI18n();
  return (
    <div className="chart-controls-scroll mb-1 flex shrink-0 flex-nowrap items-center gap-x-2 overflow-x-auto lg:mb-3 lg:flex-wrap lg:gap-y-2" role="group" aria-label={t('analytics.period')} tabIndex={0}
      title={policy.restricted ? t('analytics.restricted', { weeks: policy.reviewTimeWeeks ?? 2 }) : undefined}>
      <div className="flex shrink-0 flex-nowrap gap-1.5" aria-label={t('analytics.period')}>
        {(['last2Weeks', 'last4Weeks', 'all'] as PeriodPreset[]).map(preset => (
          <button key={preset} type="button" disabled={policy.restricted && preset !== 'last2Weeks'}
            title={t(preset === 'all' ? 'analytics.allRangeHelp' : 'analytics.rangeHelp')} aria-pressed={value === preset} onClick={() => onChange(preset)}
            className={`shrink-0 whitespace-nowrap rounded-lg border px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-indigo-500 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-50 disabled:text-gray-400 ${value === preset ? 'border-indigo-800 bg-indigo-800 text-white' : 'border-gray-300 bg-white text-gray-600 hover:bg-indigo-50'}`}>
            {policy.restricted && preset === 'last2Weeks' ? t('analytics.lastWeeks', { weeks: policy.reviewTimeWeeks ?? 2 }) : t(`analytics.${preset}`)}
          </button>
        ))}
      </div>
      <div className="flex w-64 shrink-0 items-center gap-1.5" title={t('analytics.rangeHelp')}>
        <DateSelector label={t('analytics.start')} value={range.start}
          min={rangeBounds?.start} max={range.end}
          onChange={start => onChange('custom', { ...range, start })} />
        <span aria-hidden="true" className="text-gray-400">–</span>
        <DateSelector label={t('analytics.end')} value={range.end}
          min={range.start} max={rangeBounds?.end}
          onChange={end => onChange('custom', { ...range, end })} />
      </div>
      {trailingControl}
    </div>
  );
}

function DateSelector({ label, value, disabled, min, max, onChange }: {
  label: string; value: string; disabled?: boolean; min?: string; max?: string; onChange: (value: string) => void;
}) {
  const { language } = useI18n();
  const [open, setOpen] = useState(false);
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild>
      <button type="button" disabled={disabled} aria-label={`${label}: ${format(parseISO(value), 'dd.MM.yyyy')}`}
        className="flex min-w-0 max-w-32 flex-1 items-center justify-between gap-1 rounded-lg border border-gray-200 px-1.5 py-1.5 text-xs disabled:bg-gray-50 disabled:text-gray-400">
        {format(parseISO(value), 'dd.MM.yyyy')}<CalendarDays aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      </button>
    </PopoverTrigger>
    <PopoverContent align="start" className="w-auto bg-white p-0" aria-label={label}>
      <Calendar mode="single" selected={parseISO(value)} defaultMonth={parseISO(value)}
        locale={getDateLocale(language)} weekStartsOn={1} ISOWeek initialFocus
        disabled={[...(min ? [{ before: parseISO(min) }] : []), ...(max ? [{ after: parseISO(max) }] : [])]}
        onSelect={date => { if (date) { onChange(format(date, 'yyyy-MM-dd')); setOpen(false); } }} />
    </PopoverContent>
  </Popover>;
}
