import { WorkloadMetrics } from '../../analytics/workload';
import { useI18n } from '../../i18n/i18n';
import { WORKLOAD_OPACITY } from '../../analytics/workloadColors';

export function SubjectStatistics({ metrics, color, singleTime = false }: { metrics?: WorkloadMetrics; color: string; singleTime?: boolean }) {
  const { t, language } = useI18n();
  const hours = (value: number) => `${new Intl.NumberFormat(language === 'de' ? 'de-CH' : 'en', { maximumFractionDigits: 1 }).format(value)} h`;
  return (
    <div className="mt-2 grid grid-cols-2 gap-3 border-t border-gray-200 pt-2">
      {(['total', 'weeklyAverage'] as const).map(metric => (
        <div key={metric}>
          <p className="mb-1 text-xs font-semibold text-gray-800">{t(`analytics.${metric}`)}</p>
          <dl className="space-y-1">
            {(singleTime ? ['classTime'] as const : ['classTime', 'selfStudyTime'] as const).map(category => (
              <div key={category} className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
                <dt className="flex items-center gap-1 text-xs text-gray-600">
                  <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color, opacity: WORKLOAD_OPACITY[category] }} />
                  {singleTime ? t('weeklyEntry.hours') : t(`analytics.${category}`)}
                </dt>
                <dd className="text-xs font-semibold tabular-nums text-gray-900">{hours(metrics?.[metric][category] ?? 0)}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}
