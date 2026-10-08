import { WorkloadGrouping, WorkloadMetrics } from '../../analytics/workload';
import { useI18n } from '../../i18n/i18n';
import { WORKLOAD_OPACITY } from '../../analytics/workloadColors';
import { ReactNode } from 'react';

export function SubjectStatistics({ metrics, color, singleTime = false, grouping = 'weekly', periodCount, categoryAction, categoryHidden }: { metrics?: WorkloadMetrics; color: string; singleTime?: boolean; grouping?: WorkloadGrouping; periodCount?: number; categoryAction?: (category: 'classTime' | 'selfStudyTime') => ReactNode; categoryHidden?: (category: 'classTime' | 'selfStudyTime') => boolean }) {
  const { t, language } = useI18n();
  const hours = (value: number) => `${new Intl.NumberFormat(language === 'de' ? 'de-CH' : 'en', { maximumFractionDigits: 1 }).format(value)} h`;
  return (
    <dl className={`grid ${categoryAction ? 'grid-cols-[0.625rem_minmax(0,1fr)_minmax(0,1fr)_auto]' : 'grid-cols-[0.625rem_minmax(0,1fr)_minmax(0,1fr)]'} items-center gap-x-2 gap-y-2 pl-2 text-xs leading-4 text-gray-700`}>
      {(singleTime ? ['classTime'] as const : ['classTime', 'selfStudyTime'] as const).map(category => (
        <div key={category} className="contents"
          title={singleTime ? t('weeklyEntry.hours') : t(`analytics.${category}`)}>
          <dt className={`shrink-0 ${categoryHidden?.(category) ? 'opacity-40 grayscale' : ''}`}>
            <span aria-hidden="true" className="block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color, opacity: WORKLOAD_OPACITY[category] }} />
            <span className="sr-only">{singleTime ? t('weeklyEntry.hours') : t(`analytics.${category}`)}</span>
          </dt>
          <dd className="contents tabular-nums">
            <span className={`whitespace-nowrap ${categoryHidden?.(category) ? 'opacity-40' : ''}`}>{t('analytics.totalCompact')}: <strong className="font-semibold">{hours(metrics?.total[category] ?? 0)}</strong></span>
            <span className={`whitespace-nowrap ${categoryHidden?.(category) ? 'opacity-40' : ''}`}>{t(`analytics.${grouping}Compact`)}: <strong className="font-semibold">{hours(periodCount ? (metrics?.total[category] ?? 0) / periodCount : metrics?.weeklyAverage[category] ?? 0)}</strong></span>
          </dd>
          {categoryAction && <dd>{categoryAction(category)}</dd>}
        </div>
      ))}
    </dl>
  );
}
