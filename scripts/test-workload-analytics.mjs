import assert from 'node:assert/strict';
import { build } from 'esbuild';

// Bundle the actual TypeScript module in memory; no additional test runtime needed.
const bundle = await build({ entryPoints: ['src/app/analytics/workload.ts'], bundle: true, write: false, platform: 'node', format: 'esm' });
const { resolveDateRange, resolveEntryDateRange, aggregateWorkload, bucketWorkload, workloadBarValue, roundQuarterHour, formatStatisticsHours } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const policy = { restricted: true };
const range = resolveDateRange('all', policy, '2026-09-10', '2020-01-01');
assert.deepEqual(range, { start: '2026-08-24', end: '2026-09-13' });
assert.deepEqual(resolveDateRange('custom', policy, '2026-09-10', '2020-01-01', { start: '2020-01-01', end: '2030-01-01' }), range);
const entry = (date, classTime, selfStudyTime, skipped = false) => ({ date, skipped, subjectTimes: [{ subjectId: 'math', classTime, selfStudyTime }] });
const chartRange = { start: '2026-09-22', end: '2026-10-05' };
const referencedPolicy = { restricted: false, referenceDate: '2026-09-15' };
const referencedEntries = [entry('2026-06-01', 100, 100), entry('2026-09-19', 3, 2), entry('2026-10-02', 4, 1)];
assert.deepEqual(resolveEntryDateRange('all', referencedPolicy, referencedEntries, '2026-10-08'), { start: '2026-06-01', end: '2026-10-11' });
assert.equal(resolveEntryDateRange('last4Weeks', referencedPolicy, referencedEntries, '2026-10-08').start, '2026-09-07');
assert.equal(resolveEntryDateRange('last2Weeks', referencedPolicy, referencedEntries, '2026-10-08').start, '2026-09-21');
assert.deepEqual(resolveEntryDateRange('custom', referencedPolicy, referencedEntries, '2026-10-08', { start: '2026-06-01', end: '2026-10-02' }), { start: '2026-06-01', end: '2026-10-02' });
assert.deepEqual(resolveEntryDateRange('all', referencedPolicy, [], '2026-09-10'), { start: '2026-09-07', end: '2026-09-13' });
assert.equal(workloadBarValue(28, chartRange, 'total'), 28);
assert.equal(workloadBarValue(28, chartRange, 'weeklyAverage'), 14);
assert.equal(workloadBarValue(28, chartRange, 'dailyAverage'), 2);
assert.equal(workloadBarValue(6, { start: '2026-10-01', end: '2026-10-03' }, 'weeklyAverage'), 14, 'Partial periods normalize by their actual calendar days');
assert.equal(workloadBarValue(14, { start: '2026-03-24', end: '2026-03-30' }, 'dailyAverage'), 2, 'DST must not affect daily averages');
assert.equal(workloadBarValue(0, chartRange, 'dailyAverage'), 0);
assert.throws(() => workloadBarValue(5, { start: '2026-10-03', end: '2026-10-01' }, 'dailyAverage'));
const chartEntries = [entry('2026-09-21', 100, 100), entry('2026-09-22', 2, 3), entry('2026-09-28', 4, 5), entry('2026-09-29', 6, 7), entry('2026-10-05', 8, 9), entry('2026-10-03', 100, 100, true)];
const weeklyBuckets = bucketWorkload(chartEntries, chartRange, 'weekly');
assert.deepEqual(weeklyBuckets.map(({ start, end }) => ({ start, end })), [{ start: '2026-09-22', end: '2026-09-27' }, { start: '2026-09-28', end: '2026-10-04' }, { start: '2026-10-05', end: '2026-10-05' }]);
assert.deepEqual(weeklyBuckets.map(bucket => bucket.metrics.get('math').total), [{ classTime: 2, selfStudyTime: 3 }, { classTime: 10, selfStudyTime: 12 }, { classTime: 8, selfStudyTime: 9 }]);
const dailyBuckets = bucketWorkload(chartEntries, chartRange, 'daily');
assert.equal(dailyBuckets.length, 14);
assert.equal(dailyBuckets[1].metrics.size, 0, 'Unreported dates remain zero');
assert.deepEqual(bucketWorkload(chartEntries, chartRange, 'monthly').map(bucket => bucket.metrics.get('math').total), [{ classTime: 12, selfStudyTime: 15 }, { classTime: 8, selfStudyTime: 9 }]);
assert.deepEqual(bucketWorkload(chartEntries, chartRange, 'yearly')[0].metrics.get('math').total, { classTime: 20, selfStudyTime: 24 });
assert.equal(bucketWorkload([], { start: '2026-03-24', end: '2026-04-06' }, 'daily').length, 14, 'DST does not add or remove a day');
assert.deepEqual(bucketWorkload([], { start: '2025-12-28', end: '2026-01-03' }, 'yearly').map(({ start, end }) => ({ start, end })), [{ start: '2025-12-28', end: '2025-12-31' }, { start: '2026-01-01', end: '2026-01-03' }]);
assert.throws(() => bucketWorkload([], { start: '2026-10-02', end: '2026-10-01' }, 'weekly'));
const entries = new Map([
  ['2026-08-23', entry('2026-08-23', 100, 100)],
  ['2026-08-28', entry('2026-08-28', 4, 6)],
  ['2026-09-10', entry('2026-09-10', 2, 4)],
  ['2026-09-14', entry('2026-09-14', 100, 100)],
  ['2026-09-01', entry('2026-09-01', 100, 100, true)],
]);
assert.deepEqual(aggregateWorkload(entries.values(), range).get('math'), {
  total: { classTime: 6, selfStudyTime: 10 }, weeklyAverage: { classTime: 2, selfStudyTime: 10 / 3 },
});
entries.set('2026-09-10', entry('2026-09-10', 1, 2));
assert.equal(aggregateWorkload(entries.values(), range).get('math').total.classTime, 5);
entries.delete('2026-09-10');
assert.equal(aggregateWorkload(entries.values(), range).get('math').total.classTime, 4);
assert.equal(aggregateWorkload([], range).size, 0);
const open = { ...policy, restricted: false };
assert.deepEqual(resolveDateRange('last2Weeks', open, '2026-09-10', ''), { start: '2026-08-24', end: '2026-09-13' });
assert.equal(resolveDateRange('last4Weeks', open, '2026-09-10', '').start, '2026-08-10');
assert.equal(resolveDateRange('all', open, '2026-09-10', '2025-01-01').start, '2024-12-30');
const custom = { start: '2026-03-23', end: '2026-04-05' }; // Crosses Zurich DST change.
assert.deepEqual(resolveDateRange('custom', open, '2026-09-10', '', custom), custom);
assert.equal(aggregateWorkload([entry('2026-03-24', 14, 0)], custom).get('math').weeklyAverage.classTime, 7);
assert.throws(() => aggregateWorkload([], { start: '2026-09-10', end: '2026-09-01' }));
for (const preset of ['last2Weeks', 'last4Weeks', 'all']) {
  assert.deepEqual(resolveDateRange(preset, policy, '2026-09-10', '2020-01-01'), range);
}
assert.deepEqual(resolveDateRange('last2Weeks', policy, '2026-09-10', '2020-01-01'), { start: '2026-08-24', end: '2026-09-13' });
assert.deepEqual(resolveDateRange('custom', policy, '2026-09-10', '', { start: '2026-09-02', end: '2026-09-05' }), { start: '2026-09-02', end: '2026-09-05' });
assert.deepEqual(resolveDateRange('custom', policy, '2026-09-10', '', { start: '2020-01-01', end: '2020-01-02' }), { start: '2026-08-24', end: '2026-08-24' });
assert.deepEqual(resolveDateRange('custom', policy, '2026-09-10', '', { start: '2030-01-01', end: '2030-01-02' }), { start: '2026-09-13', end: '2026-09-13' });
const shortRange = resolveDateRange('custom', policy, '2026-09-10', '', { start: '2026-09-08', end: '2026-09-10' });
assert.equal(aggregateWorkload([entry('2026-09-09', 6, 0)], shortRange).get('math').weeklyAverage.classTime, 14);
assert.deepEqual(resolveDateRange('last2Weeks', open, '2026-01-05', ''), { start: '2025-12-22', end: '2026-01-11' });
assert.deepEqual(resolveDateRange('last2Weeks', open, '2026-03-30', ''), { start: '2026-03-16', end: '2026-04-05' });
console.log('Workload analytics tests passed.');

// Presets follow today's calendar weeks; All starts at the earliest saved week.
const history = [entry('2026-10-03', 4, 2), entry('2026-10-05', 0, 0, true), entry('2026-09-30', 2, 0)];
for (const [preset, start] of [['last2Weeks', '2026-10-05'], ['last4Weeks', '2026-09-21']]) {
  assert.deepEqual(resolveEntryDateRange(preset, open, history, '2026-10-20'), { start, end: '2026-10-25' });
}
assert.deepEqual(resolveEntryDateRange('all', open, history, '2026-10-20'), { start: '2026-09-28', end: '2026-10-25' });
assert.deepEqual(resolveEntryDateRange('custom', open, history, '2026-10-20', custom), custom);
assert.deepEqual(resolveEntryDateRange('last2Weeks', open, [], '2026-10-08'), { start: '2026-09-21', end: '2026-10-11' });
assert.equal(roundQuarterHour(0.47), 0.5);
assert.equal(roundQuarterHour(0.375), 0.5);
assert.equal(formatStatisticsHours(0.47, 'en'), '0.5');
assert.equal(formatStatisticsHours(0.26, 'de'), '0.25');
const dailyRaw = [entry('2026-09-29', 0.13, 0.12), entry('2026-09-30', 0.13, 0.12)];
const rounded = aggregateWorkload(dailyRaw, { start: '2026-09-29', end: '2026-09-30' }, 'day').get('math');
assert.deepEqual(rounded.total, { classTime: 0.5, selfStudyTime: 0 });
assert.equal(dailyRaw[0].subjectTimes[0].classTime, 0.13, 'Analytics must not mutate stored raw values');
const mixedWeek = [entry('2026-09-28', 7, 14)];
const mixedRange = { start: '2026-09-28', end: '2026-10-04' };
const split = bucketWorkload(mixedWeek, mixedRange, 'monthly', 'week');
assert.deepEqual(split.map(bucket => bucket.metrics.get('math').total), [{ classTime: 3, selfStudyTime: 6 }, { classTime: 4, selfStudyTime: 8 }]);
assert.deepEqual(aggregateWorkload(mixedWeek, mixedRange, 'week').get('math').total, { classTime: 7, selfStudyTime: 14 });
assert.equal(aggregateWorkload(mixedWeek, { start: '2026-10-01', end: '2026-10-31' }, 'week').get('math').total.classTime, 4);
assert.equal(bucketWorkload(mixedWeek, mixedRange, 'daily', 'week').reduce((sum, bucket) => sum + bucket.metrics.get('math').total.classTime, 0), 7);
assert.deepEqual(resolveEntryDateRange('all', open, mixedWeek, '2026-10-22', undefined, 'week'), { start: '2026-09-28', end: '2026-10-25' }, 'All includes history through the current calendar week');
const fractionalWeek = aggregateWorkload([entry('2026-09-28', 1, 0)], { start: '2026-10-01', end: '2026-10-31' }, 'week').get('math');
assert.equal(fractionalWeek.total.classTime, 4 / 7, 'Do not round proportional allocations before calculating averages');
const newYear = bucketWorkload([entry('2025-12-29', 7, 0)], { start: '2025-12-29', end: '2026-01-04' }, 'monthly', 'week');
assert.deepEqual(newYear.map(bucket => bucket.metrics.get('math').total.classTime), [3, 4]);
console.log('Quarter-hour rounding and proportional weekly allocation passed.');
