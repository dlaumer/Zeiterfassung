import { useRef } from 'react';
import { useI18n } from '../../i18n/i18n';

import { ChartValueMode } from '../../analytics/workload';
export type { ChartValueMode } from '../../analytics/workload';
export type ChartTimeFilter = 'all' | 'study' | 'class';
export const CHART_TOGGLE_TRACK = 'relative isolate grid w-56 shrink-0 justify-self-center rounded-xl border border-gray-200 bg-gray-100/80 p-1';
export const CHART_TOGGLE_THUMB = 'pointer-events-none absolute bottom-1 left-1 top-1 -z-10 rounded-lg bg-white shadow-sm ring-1 ring-black/5 transition-all duration-200 motion-reduce:transition-none';

export function ChartDisplayControls({ mode, onModeChange, timeFilter, onTimeFilterChange, singleTime }: {
  mode: ChartValueMode;
  onModeChange: (mode: ChartValueMode) => void;
  timeFilter?: ChartTimeFilter;
  onTimeFilterChange: (filter: ChartTimeFilter) => void;
  singleTime: boolean;
}) {
  const { t } = useI18n();
  const dragging = useRef<number | null>(null);
  const positions: ChartTimeFilter[] = ['all', 'class', 'study'];
  const valuePositions: ChartValueMode[] = ['total', 'weeklyAverage', 'dailyAverage'];
  return <>
    <div role="group" aria-label={t('analytics.values')} className={`${CHART_TOGGLE_TRACK} grid-cols-3`}>
      <span aria-hidden="true" className={CHART_TOGGLE_THUMB}
        style={{ width: 'calc((100% - 0.5rem) / 3)', transform: `translateX(${valuePositions.indexOf(mode) * 100}%)` }} />
      {valuePositions.map(value => <button key={value} type="button" aria-pressed={mode === value} onClick={() => onModeChange(value)}
        className={`whitespace-nowrap rounded-lg px-2 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-indigo-500 ${mode === value ? 'text-indigo-800' : 'text-gray-500 hover:text-gray-900'}`}>
        {t(value === 'total' ? 'analytics.totalMode' : value === 'weeklyAverage' ? 'analytics.weeklyCompact' : 'analytics.dailyCompact')}
      </button>)}
    </div>
    {!singleTime && <div role="radiogroup" aria-label={t('analytics.timeCategories')}
      className={`${CHART_TOGGLE_TRACK} touch-pan-y grid-cols-3`} style={{ width: '18rem' }}
      onPointerDown={event => {
        if (!event.isPrimary || event.button !== 0) return;
        dragging.current = event.pointerId;
        event.currentTarget.setPointerCapture(event.pointerId);
        const bounds = event.currentTarget.getBoundingClientRect();
        onTimeFilterChange(positions[Math.max(0, Math.min(2, Math.floor((event.clientX - bounds.left) / bounds.width * 3)))]);
      }}
      onPointerMove={event => {
        if (dragging.current !== event.pointerId) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        onTimeFilterChange(positions[Math.max(0, Math.min(2, Math.floor((event.clientX - bounds.left) / bounds.width * 3)))]);
      }}
      onPointerUp={() => { dragging.current = null; }} onPointerCancel={() => { dragging.current = null; }}>
      <span aria-hidden="true" className={CHART_TOGGLE_THUMB}
        style={{ width: 'calc((100% - 0.5rem) / 3)', opacity: timeFilter ? 1 : 0, transform: `translateX(${Math.max(0, positions.indexOf(timeFilter!)) * 100}%)` }} />
      {positions.map((value, index) => <button key={value} type="button" role="radio" aria-checked={timeFilter === value} onClick={() => onTimeFilterChange(value)}
        onKeyDown={event => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : (index + (event.key === 'ArrowRight' ? 1 : 2)) % 3;
          onTimeFilterChange(positions[next]);
          event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus();
        }}
        className={`cursor-grab whitespace-nowrap rounded-lg px-2 py-1.5 text-xs font-medium transition-colors active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-indigo-500 ${timeFilter === value ? 'text-indigo-800' : 'text-gray-500 hover:text-gray-900'}`}>
        {t(`analytics.filter${value[0].toUpperCase()}${value.slice(1)}`)}
      </button>)}
    </div>}
  </>;
}
