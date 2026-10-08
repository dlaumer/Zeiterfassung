import { ReactNode } from 'react';
import { ChartNoAxesColumn } from 'lucide-react';

export function StatisticsCard({ children, actions, statistics, onOpenStatistics, statisticsLabel }: {
  children: ReactNode;
  actions?: ReactNode;
  statistics?: ReactNode;
  onOpenStatistics?: () => void;
  statisticsLabel?: string;
}) {

  return (
    <div className="group min-w-0 overflow-hidden rounded-xl bg-gray-50 px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        {children}
        <div className="flex shrink-0 items-center gap-1">
          {onOpenStatistics && <button type="button" onClick={onOpenStatistics} aria-label={statisticsLabel}
            className="shrink-0 rounded-lg p-1 text-gray-500 hover:bg-indigo-100 hover:text-indigo-700 focus-visible:outline-2 focus-visible:outline-indigo-500">
            <ChartNoAxesColumn className="h-4 w-4" />
          </button>}
          {actions}
        </div>
      </div>
      {statistics && <div className="mt-2 flex items-center gap-2 border-t border-gray-200 pt-2">
        <div className="min-w-0 flex-1">{statistics}</div>
      </div>}
    </div>
  );
}
