import assert from 'node:assert/strict';
import { build } from 'esbuild';

// Bundle the actual TypeScript module in memory; no additional test runtime needed.
const bundle = await build({ entryPoints: ['src/app/analytics/workload.ts'], bundle: true, write: false, platform: 'node', format: 'esm' });
const { resolveDateRange, resolveEntryDateRange, aggregateWorkload } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const policy = { restricted: true };
const range = resolveDateRange('all', policy, '2026-09-10', '2020-01-01');
assert.deepEqual(range, { start: '2026-08-28', end: '2026-09-10' });
assert.deepEqual(resolveDateRange('custom', policy, '2026-09-10', '2020-01-01', { start: '2020-01-01', end: '2030-01-01' }), range);
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
assert.deepEqual(resolveDateRange('last7', open, '2026-09-10', ''), { start: '2026-09-04', end: '2026-09-10' });
assert.equal(resolveDateRange('last30', open, '2026-09-10', '').start, '2026-08-12');
assert.equal(resolveDateRange('all', open, '2026-09-10', '2025-01-01').start, '2025-01-01');
const custom = { start: '2026-03-23', end: '2026-04-05' }; // Crosses Zurich DST change.
assert.deepEqual(resolveDateRange('custom', open, '2026-09-10', '', custom), custom);
assert.equal(aggregateWorkload([entry('2026-03-24', 14, 0)], custom).get('math').weeklyAverage.classTime, 7);
assert.throws(() => aggregateWorkload([], { start: '2026-09-10', end: '2026-09-01' }));
for (const preset of ['last7', 'last14', 'last30', 'all']) {
  assert.deepEqual(resolveDateRange(preset, policy, '2026-09-10', '2020-01-01'), range);
}
assert.deepEqual(resolveDateRange('last14', open, '2026-01-05', ''), { start: '2025-12-23', end: '2026-01-05' });
assert.deepEqual(resolveDateRange('last7', open, '2026-03-30', ''), { start: '2026-03-24', end: '2026-03-30' });
console.log('Workload analytics tests passed.');

// Anchor to the recorded date, including skipped entries, regardless of map order or today's date.
const history = [entry('2026-10-03', 4, 2), entry('2026-10-05', 0, 0, true), entry('2026-09-30', 2, 0)];
for (const [preset, start] of [['last7', '2026-09-29'], ['last14', '2026-09-22'], ['last30', '2026-09-06']]) {
  assert.deepEqual(resolveEntryDateRange(preset, open, history, '2026-10-20'), { start, end: '2026-10-05' });
}
assert.deepEqual(resolveEntryDateRange('all', open, history, '2026-10-20'), { start: '2026-09-30', end: '2026-10-05' });
const anchored = resolveEntryDateRange('all', policy, history, '2026-10-20');
assert.deepEqual(anchored, { start: '2026-09-22', end: '2026-10-05' });
assert.equal(aggregateWorkload(history, anchored).get('math').weeklyAverage.classTime, 3, 'Gaps count as zero, retaining the full two-week denominator');
assert.deepEqual(resolveEntryDateRange('custom', open, history, '2026-10-20', custom), custom);
history.splice(1, 1);
assert.equal(resolveEntryDateRange('last14', policy, history, '2026-10-20').end, '2026-10-03');
history.push(entry('2026-10-06', 1, 1));
assert.equal(resolveEntryDateRange('last14', policy, history, '2026-10-20').end, '2026-10-06');
assert.deepEqual(resolveEntryDateRange('last7', open, [], '2026-10-08'), { start: '2026-10-02', end: '2026-10-08' });
console.log('Latest-entry date windows and missing-day averages passed.');
