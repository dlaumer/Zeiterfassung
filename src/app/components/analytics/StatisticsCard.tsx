import { ReactNode } from 'react';
import { ChartNoAxesColumn } from 'lucide-react';

export function StatisticsCard({ children, actions, statistics }: {
  children: ReactNode;
  actions?: ReactNode;
  statistics?: ReactNode;
}) {

  return (
    <div className="group min-w-0 overflow-hidden rounded-xl bg-gray-50 px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        {children}
        <div className="flex shrink-0 items-center gap-1">
          {actions}
        </div>
      </div>
      {statistics && <div className="mt-2 flex items-center gap-2 border-t border-gray-200 pt-2">
        <div className="min-w-0 flex-1">{statistics}</div>
        <span className="shrink-0 rounded-lg p-1 text-gray-400" aria-hidden="true">
          <ChartNoAxesColumn className="h-4 w-4" />
        </span>
      </div>}
    </div>
  );
}
