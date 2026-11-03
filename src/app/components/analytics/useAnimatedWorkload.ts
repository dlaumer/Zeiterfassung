import { useEffect, useRef, useState } from 'react';

type Row = { label: string; period: string; [key: string]: string | number };
type Frame = { data: Row[]; maximum: number; tickMaximum: number };
const total = (row?: Row) => row ? Object.values(row).reduce<number>((sum, value) => sum + (typeof value === 'number' ? value : 0), 0) : 0;
const BAR_DURATION = 500;
const AXIS_PAUSE = 200;
const AXIS_DURATION = 300;

/** Change stack heights first, then restore headroom or rescale below 35% occupancy. */
export function useAnimatedWorkload(data: Row[], maximum: number, grouping: string, fixedScale = false) {
  const signature = JSON.stringify({ data, maximum });
  const [frame, setFrame] = useState<Frame>(() => ({ data: fixedScale ? data.map(row => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, typeof value === 'number' ? 0 : value])) as Row) : data, maximum, tickMaximum: maximum }));
  const current = useRef(frame);
  const previousGrouping = useRef(grouping);
  useEffect(() => {
    const parsed = JSON.parse(signature);
    const target: Frame = { ...parsed, tickMaximum: parsed.maximum };
    const start = current.current;
    const groupingChanged = previousGrouping.current !== grouping;
    previousGrouping.current = grouping;
    const commit = (next: Frame) => { current.current = next; setFrame(next); };
    if (groupingChanged) { commit(target); return; }
    const largest = Math.max(0, ...target.data.map(total));
    const rescale = !fixedScale && (largest * 1.1 > start.maximum || largest < start.maximum * 0.35);
    if (!rescale) { target.maximum = start.maximum; target.tickMaximum = start.tickMaximum; }

    const previousRows = new Map(start.data.map(row => [row.period, row]));
    const started = performance.now();
    let request = 0;
    const animate = (now: number) => {
      const elapsed = now - started;
      const scaling = elapsed >= BAR_DURATION + AXIS_PAUSE;
      const progress = Math.min(1, scaling
        ? (elapsed - BAR_DURATION - AXIS_PAUSE) / AXIS_DURATION
        : elapsed / BAR_DURATION);
      const eased = progress * progress * (3 - 2 * progress);
      if ((!rescale && elapsed >= BAR_DURATION) || (scaling && progress === 1)) { commit(target); return; }
      commit({
        maximum: scaling ? start.maximum + (target.maximum - start.maximum) * eased : start.maximum,
        tickMaximum: scaling ? target.tickMaximum : start.tickMaximum,
        data: scaling ? target.data : target.data.map(row => {
          // Keep each module's identity and color throughout the shared stack animation.
          // Hidden series remain mounted with zero targets until they finish shrinking.
          return Object.fromEntries(Object.entries(row).map(([key, value]) => {
            if (typeof value !== 'number') return [key, value];
            const before = Number(previousRows.get(row.period)?.[key] ?? 0);
            return [key, before + (value - before) * eased];
          })) as Row;
        }),
      });
      request = requestAnimationFrame(animate);
    };
    request = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(request);
  }, [signature, grouping, fixedScale]);
  return frame;
}
