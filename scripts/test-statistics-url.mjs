import assert from 'node:assert/strict';
import { build } from 'esbuild';
const load = async path => {
  const result = await build({ entryPoints: [path], bundle: true, write: false, platform: 'node', format: 'esm' });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
};
const { readStatistics, writeStatistics } = await load('src/app/analytics/statisticsUrl.ts');
const w = await load('src/app/analytics/workload.ts');
const state = readStatistics(new URLSearchParams(), true);
Object.assign(state, { initialized: true, open: true, group: 'monthly', value: 'dailyAverage', period: 'custom', dates: { start: '2026-10-20', end: '2026-10-22' }, modules: new Set(['a,b & c', 'second']), hidden: new Set(['a,b & c:classTime']), rating: true, workload: false, zoom: 2.3 });
const params = writeStatistics(new URLSearchParams('lang=de&token=keep#value'), state);
assert.equal(params.get('lang'), 'de');
assert.equal(params.get('token'), 'keep#value');
assert.deepEqual(readStatistics(params, true), state);
assert.equal(writeStatistics(params, state).toString(), params.toString());
const empty = { ...state, modules: new Set(), hidden: new Set() };
assert.equal(readStatistics(writeStatistics(params, empty), true).modules.size, 0);
for (const dates of [['2026-02-30','2026-03-01'], ['2026-10-22','2026-10-20'], ['bad','bad']]) {
  const invalid = new URLSearchParams('stats.v=1&stats.period=custom&stats.group=oops&stats.value=oops&stats.zoom=NaN');
  invalid.set('stats.from', dates[0]); invalid.set('stats.to', dates[1]);
  const decoded = readStatistics(invalid, true);
  assert.equal(decoded.period, 'last2Weeks'); assert.equal(decoded.group, 'daily'); assert.equal(decoded.value, 'total'); assert.equal(decoded.zoom, 1);
}
assert.equal(readStatistics(new URLSearchParams('stats.v=2&stats.open=1'), true).open, false);
assert.equal(readStatistics(new URLSearchParams('stats.v=1&stats.group=weekly&stats.value=weeklyAverage'), false).value, 'total');
const policy = { restricted: false };
for (const today of ['2026-10-30', '2026-12-01']) {
  for (const group of ['daily', 'weekly', 'monthly']) assert.deepEqual(w.resolveDateRange('custom', policy, today, '2020-01-01', state.dates, group), state.dates);
}
assert.notDeepEqual(w.resolveDateRange('last2Weeks', policy, '2026-10-30', '2020-01-01'), w.resolveDateRange('last2Weeks', policy, '2026-11-09', '2020-01-01'));
const entry = date => ({ date, subjectTimes: [{ subjectId: 's', classTime: 1, selfStudyTime: 0 }] });
assert.equal(w.resolveEntryDateRange('all', policy, [entry('2026-10-20')], '2026-10-30').start, '2026-10-19');
assert.equal(w.resolveEntryDateRange('all', policy, [entry('2026-09-01'), entry('2026-10-20')], '2026-10-30').start, '2026-08-31');
const buckets = w.bucketWorkload([entry('2026-10-19'), entry('2026-10-20'), entry('2026-10-23')], state.dates, 'weekly');
assert.deepEqual({ start: buckets[0].start, end: buckets[0].end }, state.dates);
assert.equal(buckets[0].metrics.get('s').total.classTime, 1);
console.log('PASS: statistics URL round trips, validation, stable dates, live presets and exact partial-week totals');
