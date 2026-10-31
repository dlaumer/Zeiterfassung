import { Dispatch, SetStateAction, useEffect, useState } from 'react';
import { format, isValid, parseISO } from 'date-fns';
import { ChartValueMode, DateRange, PeriodPreset, WorkloadGrouping } from './workload';

export interface StatisticsState {
  initialized: boolean;
  open: boolean;
  modules: Set<string>;
  hidden: Set<string>;
  period: PeriodPreset;
  dates?: DateRange;
  group: WorkloadGrouping;
  value: ChartValueMode;
  summaries: boolean;
  totals: boolean;
  workload: boolean;
  rating: boolean;
  energy: boolean;
  commute: boolean;
  admin: boolean;
  structural: boolean;
  adminHidden: boolean;
  structuralHidden: boolean;
  zoom: number;
}
const prefix = 'stats.';
const dateValid = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && isValid(parseISO(value)) && format(parseISO(value), 'yyyy-MM-dd') === value;
const choice = <T extends string>(value: string | null, values: T[], fallback: T): T => values.includes(value as T) ? value as T : fallback;
// Repeated parameters avoid ambiguous delimiters in stable module IDs.
export function readStatistics(params: URLSearchParams, daily: boolean, defaultTotals = true): StatisticsState {
  const get = (key: string) => params.get(prefix + key);
  const active = get('v') === '1';
  const bool = (key: string, fallback: boolean) => active ? get(key) === '1' ? true : get(key) === '0' ? false : fallback : fallback;
  const group = choice<WorkloadGrouping>(active ? get('group') : null, daily ? ['daily', 'weekly', 'monthly'] : ['weekly', 'monthly'], daily ? 'daily' : 'weekly');
  let value = choice(active ? get('value') : null, ['total', 'weeklyAverage', 'dailyAverage'], 'total');
  if (group === 'daily' || (group === 'weekly' && value === 'weeklyAverage')) value = 'total';
  const start = get('from') ?? '', end = get('to') ?? '';
  const dates = active && dateValid(start) && dateValid(end) && start <= end ? { start, end } : undefined;
  let period = choice(active ? get('period') : null, ['last2Weeks', 'last4Weeks', 'all', 'custom'], 'last2Weeks');
  if (period === 'custom' && !dates) period = 'last2Weeks';
  const zoom = Number(get('zoom') ?? 1);
  return {
    initialized: active, open: bool('open', false),
    modules: new Set(active ? params.getAll(prefix + 'module').filter(Boolean) : []),
    hidden: new Set(active ? params.getAll(prefix + 'hide').filter(key => /:(classTime|selfStudyTime)$/.test(key)) : []),
    period, dates: period === 'custom' ? dates : undefined, group, value,
    summaries: bool('summaries', true), totals: bool('totals', defaultTotals), workload: true,
    rating: bool('rating', false), energy: !bool('rating', false) && bool('energy', false),
    commute: bool('commute', false), admin: bool('admin', false),
    structural: bool('structural', false),
    adminHidden: bool('adminHidden', false), structuralHidden: bool('structuralHidden', false),
    zoom: active && Number.isFinite(zoom) ? Math.min(8, Math.max(1, zoom)) : 1,
  };
}

export function writeStatistics(params: URLSearchParams, state: StatisticsState) {
  const result = new URLSearchParams(params);
  for (const key of [...result.keys()]) if (key.startsWith(prefix)) result.delete(key);
  if (!state.initialized) return result;
  const set = (key: string, value: string | number) => result.set(prefix + key, String(value));
  set('v', 1);
  for (const id of [...state.modules].sort()) result.append(prefix + 'module', id);
  set('group', state.group); set('period', state.period); set('value', state.value);
  if (state.period === 'custom' && state.dates) { set('from', state.dates.start); set('to', state.dates.end); }
  for (const key of [...state.hidden].sort()) result.append(prefix + 'hide', key);
  for (const key of ['open', 'summaries', 'totals', 'workload', 'rating', 'energy', 'commute', 'admin', 'structural', 'adminHidden', 'structuralHidden'] as const) set(key, state[key] ? 1 : 0);
  set('zoom', state.zoom);
  return result;
}

export function useStatisticsUrl(daily: boolean) {
  const readCurrent = () => readStatistics(new URLSearchParams(window.location.search), daily, !window.matchMedia('(max-width: 1023px)').matches);
  const [state, setState] = useState(readCurrent);
  useEffect(() => {
    const restore = () => setState(readCurrent());
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, [daily]);
  useEffect(() => {
    if (!state.initialized) return;
    const url = new URL(window.location.href);
    url.search = writeStatistics(url.searchParams, state).toString();
    if (url.href !== window.location.href) window.history.replaceState(window.history.state, '', url);
  }, [state]);
  const setting = <K extends keyof StatisticsState>(key: K): [StatisticsState[K], Dispatch<SetStateAction<StatisticsState[K]>>] => [state[key], update => {
    setState(current => {
      const next = typeof update === 'function' ? (update as (previous: StatisticsState[K]) => StatisticsState[K])(current[key]) : update;
      return { ...current, [key]: next, ...(key === 'rating' && next ? { energy: false } : {}), ...(key === 'energy' && next ? { rating: false } : {}), workload: true };
    });
  }];
  return setting;
}
