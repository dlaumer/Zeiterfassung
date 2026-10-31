import { BatteryMedium, Bike, Eye, EyeOff, Settings, Star, TrainFront } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { useI18n } from '../../i18n/i18n';

export function StatisticsOptions({ showStructural, onToggleStructural, showCommute, onToggleCommute, showAdmin, onToggleAdmin, showDataRating, onToggleDataRating, showEnergyLevel, onToggleEnergyLevel, participantRole, allModulesVisible, onToggleAllModules, showModuleStatistics, onToggleModuleStatistics, showBarTotals, onToggleBarTotals }: {
  showStructural: boolean;
  onToggleStructural: () => void;
  showCommute: boolean;
  onToggleCommute: () => void;
  showAdmin: boolean;
  onToggleAdmin: () => void;
  showDataRating: boolean;
  onToggleDataRating: () => void;
  showEnergyLevel: boolean;
  onToggleEnergyLevel: () => void;
  participantRole: 'student' | 'faculty';
  allModulesVisible: boolean;
  onToggleAllModules: () => void;
  showModuleStatistics: boolean;
  onToggleModuleStatistics: () => void;
  showBarTotals: boolean;
  onToggleBarTotals: () => void;
}) {
  const { t } = useI18n();
  const ratings = [
    { label: 'dailyEntry.reliability', checked: showDataRating, toggle: onToggleDataRating, color: 'var(--color-amber-400)' },
    { label: `socialBattery.${participantRole}`, checked: showEnergyLevel, toggle: onToggleEnergyLevel, color: '#2ca468' },
  ];
  return <section aria-label={t('analytics.options')} className="mb-4 border-b border-gray-100 pb-4">
    <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
      <button type="button" onClick={onToggleAllModules} title={t(allModulesVisible ? 'analytics.hideAllModules' : 'analytics.showAllModules')} aria-label={t(allModulesVisible ? 'analytics.hideAllModules' : 'analytics.showAllModules')} className="flex min-w-0 items-center justify-center gap-1 whitespace-nowrap rounded-lg border border-gray-200 px-1.5 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-indigo-500">
        {allModulesVisible ? <EyeOff aria-hidden="true" className="h-3.5 w-3.5 shrink-0" /> : <Eye aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />}{t(allModulesVisible ? 'analytics.hideAllModules' : 'analytics.showAllModules')}
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
            {[
              { label: 'dailyEntry.adminEffort', checked: showAdmin, toggle: onToggleAdmin },
              participantRole === 'student' ? { label: 'dailyEntry.commute', checked: showCommute, toggle: onToggleCommute } : { label: 'weeklyEntry.structuralChanges', checked: showStructural, toggle: onToggleStructural },
            ].map(item => <div key={item.label} className="flex items-center justify-between gap-3 text-xs text-gray-700">
              <span>{t(item.label)}{item.label === 'dailyEntry.commute' && <span aria-hidden="true" className="ml-2 inline-flex gap-1"><Bike className="h-4 w-4" /><TrainFront className="h-4 w-4" /></span>}</span>
              <button type="button" role="switch" aria-checked={item.checked} aria-label={t(item.label)} onClick={item.toggle} className={`relative h-5 w-9 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-indigo-500 ${item.checked ? 'bg-indigo-600' : 'bg-gray-300'}`}>
                <span aria-hidden="true" className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${item.checked ? 'translate-x-4' : ''}`} />
              </button>
            </div>)}
          </div>
        </PopoverContent>
      </Popover>
    </div>
    <div className="space-y-2">
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
    </div>
  </section>;
}
