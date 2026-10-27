import { BatteryMedium, Bike, Eye, Settings, Star, TrainFront } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { useI18n } from '../../i18n/i18n';

export function StatisticsOptions({ showDataRating, onToggleDataRating, showEnergyLevel, onToggleEnergyLevel, participantRole, onShowAll, showModuleStatistics, onToggleModuleStatistics, showBarTotals, onToggleBarTotals, workloadVisible, onWorkloadVisibleChange }: {
  showDataRating: boolean;
  onToggleDataRating: () => void;
  showEnergyLevel: boolean;
  onToggleEnergyLevel: () => void;
  participantRole: 'student' | 'faculty';
  onShowAll: () => void;
  showModuleStatistics: boolean;
  onToggleModuleStatistics: () => void;
  showBarTotals: boolean;
  onToggleBarTotals: () => void;
  workloadVisible: boolean;
  onWorkloadVisibleChange: (visible: boolean) => void;
}) {
  const { t } = useI18n();
  const ratings = [
    { label: 'dailyEntry.reliability', checked: showDataRating, toggle: onToggleDataRating, color: '#7c3aed' },
    { label: `socialBattery.${participantRole}`, checked: showEnergyLevel, toggle: onToggleEnergyLevel, color: '#0891b2' },
  ];
  const hours = ['dailyEntry.adminEffort', participantRole === 'student' ? 'dailyEntry.commute' : 'weeklyEntry.structuralChanges'];
  const disabledOption = (option: string) => <div key={option} className="flex items-center justify-between gap-3" title={t('analytics.comingSoon')}>
    <span id={`statistics-option-${option}`} className="flex items-center gap-2 text-xs text-gray-400">
      {t(option)}
      {option === 'dailyEntry.commute' && <span aria-hidden="true" className="flex shrink-0 items-center gap-1"><Bike className="h-4 w-4" /><TrainFront className="h-4 w-4" /></span>}
    </span>
    <button type="button" role="switch" aria-checked={false} aria-labelledby={`statistics-option-${option}`} disabled className="relative h-5 w-9 shrink-0 cursor-not-allowed rounded-full bg-gray-200 opacity-60">
      <span aria-hidden="true" className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm" />
    </button>
  </div>;
  return <section aria-label={t('analytics.options')} className="mb-4 border-b border-gray-100 pb-4">
    <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
      <button type="button" onClick={onShowAll} title={t('analytics.showAllModules')} aria-label={t('analytics.showAllModules')} className="flex min-w-0 items-center justify-center gap-1 whitespace-nowrap rounded-lg border border-gray-200 px-1.5 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-indigo-500">
        <Eye aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />{t('analytics.allModulesCompact')}
      </button>
      <Popover>
        <PopoverTrigger asChild>
          <button type="button" title={t('analytics.displaySettings')} aria-label={t('analytics.displaySettings')} className="flex items-center justify-center rounded-lg border border-gray-200 px-2.5 py-2 text-gray-700 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-indigo-500"><Settings aria-hidden="true" className="h-4 w-4" /></button>
        </PopoverTrigger>
        <PopoverContent align="end" className="max-w-[calc(100vw-2rem)] rounded-xl border-gray-200 bg-white p-4">
          <h3 className="mb-4 text-sm font-semibold text-gray-900">{t('analytics.displaySettings')}</h3>
          <div className="space-y-4">
            {[
              { label: 'analytics.moduleStatisticsSetting', checked: showModuleStatistics, toggle: onToggleModuleStatistics },
              { label: 'analytics.barTotalsSetting', checked: showBarTotals, toggle: onToggleBarTotals },
            ].map(setting => <label key={setting.label} className="flex cursor-pointer items-center justify-between gap-4 text-xs text-gray-700">
              <span>{t(setting.label)}</span>
              <button type="button" role="switch" aria-checked={setting.checked} aria-label={t(setting.label)} onClick={setting.toggle} className={`relative h-5 w-9 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-indigo-500 ${setting.checked ? 'bg-indigo-600' : 'bg-gray-300'}`}>
                <span aria-hidden="true" className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${setting.checked ? 'translate-x-4' : ''}`} />
              </button>
            </label>)}
          </div>
        </PopoverContent>
      </Popover>
    </div>
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span id="statistics-option-workload" className="text-xs text-gray-700">{t('analytics.workload')}</span>
        <button type="button" role="switch" aria-checked={workloadVisible} aria-labelledby="statistics-option-workload" onClick={() => onWorkloadVisibleChange(!workloadVisible)} className={`relative h-5 w-9 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-indigo-500 ${workloadVisible ? 'bg-indigo-600' : 'bg-gray-300'}`}>
          <span aria-hidden="true" className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${workloadVisible ? 'translate-x-4' : ''}`} />
        </button>
      </div>
      {ratings.map(setting => <div key={setting.label} className="flex items-center justify-between gap-3">
        <span id={`statistics-option-${setting.label}`} className="flex items-center gap-2 text-xs text-gray-700">
          {t(setting.label)}
          {setting.label === 'dailyEntry.reliability'
            ? <Star aria-hidden="true" className="h-4 w-4 shrink-0 fill-amber-400 text-amber-400" />
            : <BatteryMedium aria-hidden="true" className="h-4 w-4 shrink-0" style={{ color: setting.color }} />}
        </span>
        <button type="button" role="switch" aria-checked={setting.checked} aria-labelledby={`statistics-option-${setting.label}`} onClick={setting.toggle} className={`relative h-5 w-9 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-indigo-500 ${setting.checked ? 'bg-indigo-600' : 'bg-gray-300'}`}>
          <span aria-hidden="true" className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${setting.checked ? 'translate-x-4' : ''}`} />
        </button>
      </div>)}
      {hours.map(disabledOption)}
    </div>
  </section>;
}
