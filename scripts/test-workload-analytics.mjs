import assert from 'node:assert/strict';
import { build } from 'esbuild';

// Bundle the actual TypeScript module in memory; no additional test runtime needed.
const bundle = await build({ entryPoints: ['src/app/analytics/workload.ts'], bundle: true, write: false, platform: 'node', format: 'esm' });
const { resolveDateRange, resolveEntryDateRange, aggregateWorkload, bucketWorkload, workloadBarValue } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const policy = { restricted: true };
const range = resolveDateRange('all', policy, '2026-09-10', '2020-01-01');
assert.deepEqual(range, { start: '2026-08-28', end: '2026-09-10' });
assert.deepEqual(resolveDateRange('custom', policy, '2026-09-10', '2020-01-01', { start: '2020-01-01', end: '2030-01-01' }), range);
const entry = (date, classTime, selfStudyTime, skipped = false) => ({ date, skipped, subjectTimes: [{ subjectId: 'math', classTime, selfStudyTime }] });
const chartRange = { start: '2026-09-22', end: '2026-10-05' };
const referencedPolicy = { restricted: false, referenceDate: '2026-09-15' };
const referencedEntries = [entry('2026-06-01', 100, 100), entry('2026-09-19', 3, 2), entry('2026-10-02', 4, 1)];
assert.deepEqual(resolveEntryDateRange('all', referencedPolicy, referencedEntries, '2026-10-08'), { start: '2026-09-15', end: '2026-10-02' });
assert.equal(resolveEntryDateRange('last30', referencedPolicy, referencedEntries, '2026-10-08').start, '2026-09-15');
assert.equal(resolveEntryDateRange('last7', referencedPolicy, referencedEntries, '2026-10-08').start, '2026-09-26');
assert.deepEqual(resolveEntryDateRange('custom', referencedPolicy, referencedEntries, '2026-10-08', { start: '2026-06-01', end: '2026-10-02' }), { start: '2026-09-15', end: '2026-10-02' });
assert.deepEqual(resolveEntryDateRange('all', referencedPolicy, [], '2026-09-10'), { start: '2026-09-15', end: '2026-09-15' });
assert.equal(workloadBarValue(28, chartRange, 'total'), 28);
assert.equal(workloadBarValue(28, chartRange, 'weeklyAverage'), 14);
assert.equal(workloadBarValue(28, chartRange, 'dailyAverage'), 2);
assert.equal(workloadBarValue(6, { start: '2026-10-01', end: '2026-10-03' }, 'weeklyAverage'), 14, 'Partial periods normalize by their actual calendar days');
assert.equal(workloadBarValue(14, { start: '2026-03-24', end: '2026-03-30' }, 'dailyAverage'), 2, 'DST must not affect daily averages');
assert.equal(workloadBarValue(0, chartRange, 'dailyAverage'), 0);
assert.throws(() => workloadBarValue(5, { start: '2026-10-03', end: '2026-10-01' }, 'dailyAverage'));
const chartEntries = [entry('2026-09-21', 100, 100), entry('2026-09-22', 2, 3), entry('2026-09-28', 4, 5), entry('2026-09-29', 6, 7), entry('2026-10-05', 8, 9), entry('2026-10-03', 100, 100, true)];
const weeklyBuckets = bucketWorkload(chartEntries, chartRange, 'weekly');
assert.deepEqual(weeklyBuckets.map(({ start, end }) => ({ start, end })), [{ start: '2026-09-22', end: '2026-09-28' }, { start: '2026-09-29', end: '2026-10-05' }]);
assert.deepEqual(weeklyBuckets.map(bucket => bucket.metrics.get('math').total), [{ classTime: 6, selfStudyTime: 8 }, { classTime: 14, selfStudyTime: 16 }]);
const dailyBuckets = bucketWorkload(chartEntries, chartRange, 'daily');
assert.equal(dailyBuckets.length, 14);
assert.equal(dailyBuckets[1].metrics.size, 0, 'Unreported dates remain zero');
assert.deepEqual(bucketWorkload(chartEntries, chartRange, 'monthly').map(bucket => bucket.metrics.get('math').total), [{ classTime: 12, selfStudyTime: 15 }, { classTime: 8, selfStudyTime: 9 }]);
assert.deepEqual(bucketWorkload(chartEntries, chartRange, 'yearly')[0].metrics.get('math').total, { classTime: 20, selfStudyTime: 24 });
assert.equal(bucketWorkload([], { start: '2026-03-24', end: '2026-04-06' }, 'daily').length, 14, 'DST does not add or remove a day');
assert.deepEqual(bucketWorkload([], { start: '2025-12-28', end: '2026-01-03' }, 'yearly').map(({ start, end }) => ({ start, end })), [{ start: '2025-12-28', end: '2025-12-31' }, { start: '2026-01-01', end: '2026-01-03' }]);
assert.throws(() => bucketWorkload([], { start: '2026-10-02', end: '2026-10-01' }, 'weekly'));
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
