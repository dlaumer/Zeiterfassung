import { ReactNode, useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n/i18n';

/** Keep gestures on the handle so scrolling module content remains native. */
export function SubmissionPanels({ calendar, children, chartActive = false, expandRequest = 0 }: {
  calendar: (collapsed: boolean) => ReactNode;
  children: ReactNode | ((collapsed: boolean) => ReactNode);
  chartActive?: boolean;
  expandRequest?: number;
}) {
  const { t } = useI18n();
  const [position, setPosition] = useState<0 | 1 | 2>(chartActive ? 0 : 1);
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 1023px) and (orientation: portrait)').matches);
  const startY = useRef<number | null>(null);
  useEffect(() => { setPosition(chartActive ? 0 : 1); startY.current = null; }, [expandRequest, chartActive]);
  useEffect(() => {
    const query = window.matchMedia('(max-width: 1023px) and (orientation: portrait)');
    const update = () => { setMobile(query.matches); setPosition(1); };
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  const collapsed = mobile && position === 2;
  const modulesCollapsed = mobile && position === 0;
  return (
    <div className={`submission-panels ${collapsed ? 'submission-panels-expanded' : modulesCollapsed ? 'submission-panels-collapsed' : ''}`}>
      <div className="min-h-0 overflow-hidden lg:pr-2">
        <div className="h-full w-full max-w-5xl mx-auto">{calendar(collapsed)}</div>
      </div>
      <div className="relative flex min-w-0 min-h-0 flex-col overflow-hidden">
        <div role="separator" tabIndex={0} aria-orientation="horizontal"
          aria-valuemin={0} aria-valuemax={2} aria-valuenow={position}
          aria-label={t('panels.resizeModules')}
          aria-valuetext={t(modulesCollapsed ? 'panels.modulesCollapsed' : collapsed ? 'panels.expandModules' : 'panels.splitView')}
          onPointerDown={event => {
            if (!event.isPrimary || event.button !== 0) return;
            startY.current = event.clientY;
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={event => {
            if (startY.current !== null) {
              const distance = event.clientY - startY.current;
              if (Math.abs(distance) > 24) {
                setPosition(value => Math.max(0, Math.min(2, value + (distance < 0 ? 1 : -1))) as 0 | 1 | 2);
                startY.current = null;
              }
            }
          }}
          onPointerUp={() => { startY.current = null; }}
          onPointerCancel={() => { startY.current = null; }}
          onKeyDown={event => {
            if (['ArrowUp', 'ArrowDown', 'Enter', ' '].includes(event.key)) {
              event.preventDefault();
              setPosition(value => event.key === 'ArrowUp' ? Math.min(2, value + 1) as 0 | 1 | 2 : event.key === 'ArrowDown' ? Math.max(0, value - 1) as 0 | 1 | 2 : value === 0 ? 1 : 0);
            }
          }}
          className="module-drag-handle absolute inset-x-4 top-0 z-10 flex h-7 touch-none select-none items-center justify-center rounded-lg cursor-grab active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-indigo-500 lg:hidden">
          <span className="h-1 w-10 rounded-full bg-gray-300" aria-hidden="true" />
        </div>
        <div className="min-h-0 flex-1">{typeof children === 'function' ? children(modulesCollapsed) : children}</div>
      </div>
    </div>
  );
}
