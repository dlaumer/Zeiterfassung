import { ReactNode, useId, useState } from 'react';
import { ChartNoAxesColumn } from 'lucide-react';
import { useI18n } from '../../i18n/i18n';

export function CollapsibleStatisticsCard({ name, children, actions, statistics }: {
  name: string;
  children: ReactNode;
  actions?: ReactNode;
  statistics?: ReactNode;
}) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();
  const label = `${t(expanded ? 'analytics.hide' : 'analytics.show')}: ${name}`;

  return (
    <div className="group min-w-0 overflow-hidden rounded-xl bg-gray-50 px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        {children}
        <div className="flex shrink-0 items-center gap-1">
          {actions}
          {statistics && <button type="button" aria-label={label} title={label}
            aria-expanded={expanded} aria-controls={contentId}
            onClick={() => setExpanded(previous => !previous)}
            className={`rounded-lg p-2 transition-colors focus-visible:outline-2 focus-visible:outline-indigo-500 ${expanded ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:bg-indigo-100 hover:text-indigo-700'}`}>
            <ChartNoAxesColumn className="h-4 w-4" aria-hidden="true" />
          </button>}
        </div>
      </div>
      {statistics && <div id={contentId} hidden={!expanded}>{statistics}</div>}
    </div>
  );
}
