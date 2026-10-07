import assert from 'node:assert/strict';
import { build } from 'esbuild';

// Bundle the actual TypeScript module in memory; no additional test runtime needed.
const bundle = await build({ entryPoints: ['src/app/analytics/workload.ts'], bundle: true, write: false, platform: 'node', format: 'esm' });
const { resolveDateRange, aggregateWorkload } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const policy = { restricted: true, reviewDays: 14 };
const range = resolveDateRange('all', policy, '2026-09-10', '2020-01-01');
assert.deepEqual(range, { start: '2026-08-28', end: '2026-09-10' });
assert.deepEqual(resolveDateRange('custom', policy, '2026-09-10', '2020-01-01', { start: '2020-01-01', end: '2030-01-01' }), range);
assert.equal(resolveDateRange('review', { ...policy, reviewDays: 21 }, '2026-09-10', '').start, '2026-08-21');
assert.equal(resolveDateRange('review', { ...policy, reviewDays: 0 }, '2026-09-10', '').start, '2026-09-10');
const entry = (date, classTime, selfStudyTime, skipped = false) => ({ date, skipped, subjectTimes: [{ subjectId: 'math', classTime, selfStudyTime }] });
const entries = new Map([
  ['2026-08-27', entry('2026-08-27', 100, 100)],
  ['2026-08-28', entry('2026-08-28', 4, 6)],
  ['2026-09-10', entry('2026-09-10', 2, 4)],
  ['2026-09-11', entry('2026-09-11', 100, 100)],
  ['2026-09-01', entry('2026-09-01', 100, 100, true)],
]);
assert.deepEqual(aggregateWorkload(entries.values(), range).get('math'), {
  total: { classTime: 6, selfStudyTime: 10 }, weeklyAverage: { classTime: 3, selfStudyTime: 5 },
});
entries.set('2026-09-10', entry('2026-09-10', 1, 2));
assert.equal(aggregateWorkload(entries.values(), range).get('math').total.classTime, 5);
entries.delete('2026-09-10');
assert.equal(aggregateWorkload(entries.values(), range).get('math').total.classTime, 4);
assert.equal(aggregateWorkload([], range).size, 0);
const open = { ...policy, restricted: false };
assert.deepEqual(resolveDateRange('week', open, '2026-09-10', ''), { start: '2026-09-07', end: '2026-09-10' });
assert.equal(resolveDateRange('month', open, '2026-09-10', '').start, '2026-09-01');
assert.equal(resolveDateRange('all', open, '2026-09-10', '2025-01-01').start, '2025-01-01');
const custom = { start: '2026-03-23', end: '2026-04-05' }; // Crosses Zurich DST change.
assert.deepEqual(resolveDateRange('custom', open, '2026-09-10', '', custom), custom);
assert.equal(aggregateWorkload([entry('2026-03-24', 14, 0)], custom).get('math').weeklyAverage.classTime, 7);
assert.throws(() => aggregateWorkload([], { start: '2026-09-10', end: '2026-09-01' }));
console.log('Workload analytics tests passed.');
