import { ReactNode, useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n/i18n';

/** Keep gestures on the handle so scrolling module content remains native. */
export function SubmissionPanels({ calendar, children }: {
  calendar: (collapsed: boolean) => ReactNode;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 1023px) and (orientation: portrait)').matches);
  const startY = useRef<number | null>(null);
  useEffect(() => {
    const query = window.matchMedia('(max-width: 1023px) and (orientation: portrait)');
    const update = () => { setMobile(query.matches); setExpanded(false); };
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  const collapsed = mobile && expanded;
  return (
    <div className={`submission-panels ${collapsed ? 'submission-panels-expanded' : ''}`}>
      <div className="min-h-0 overflow-hidden lg:pr-2">
        <div className="h-full w-full max-w-5xl mx-auto">{calendar(collapsed)}</div>
      </div>
      <div className="relative flex min-w-0 min-h-0 flex-col">
        <div role="separator" tabIndex={0} aria-orientation="horizontal"
          aria-valuemin={0} aria-valuemax={1} aria-valuenow={collapsed ? 1 : 0}
          aria-label={t(collapsed ? 'panels.restoreCalendar' : 'panels.expandModules')}
          onPointerDown={event => {
            if (!event.isPrimary || event.button !== 0) return;
            startY.current = event.clientY;
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={event => {
            if (startY.current !== null) {
              const distance = event.clientY - startY.current;
              if (Math.abs(distance) > 24) {
                setExpanded(distance < 0);
                startY.current = null;
              }
            }
          }}
          onPointerUp={() => { startY.current = null; }}
          onPointerCancel={() => { startY.current = null; }}
          onKeyDown={event => {
            if (['ArrowUp', 'ArrowDown', 'Enter', ' '].includes(event.key)) {
              event.preventDefault();
              setExpanded(value => event.key === 'ArrowUp' ? true : event.key === 'ArrowDown' ? false : !value);
            }
          }}
          className="module-drag-handle absolute inset-x-4 top-0 z-10 flex h-7 touch-none select-none items-center justify-center rounded-lg cursor-grab active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-indigo-500 lg:hidden">
          <span className="h-1 w-10 rounded-full bg-gray-300" aria-hidden="true" />
        </div>
        <div className="min-h-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
