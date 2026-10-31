import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundle = await build({ entryPoints: ['src/app/analytics/workload.ts'], bundle: true, write: false, platform: 'node', format: 'esm' });
const { aggregateWorkload, averageRatings, workloadBarValue, formatStatisticsHours, roundQuarterHour } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const range = { start: '2026-10-05', end: '2026-10-11' };
assert.equal(roundQuarterHour(7 / 60), 0);
assert.equal(roundQuarterHour(8 / 60), 0.25);
assert.equal(roundQuarterHour(7.5 / 60), 0.25);
for (const mode of ['day', 'week']) {
  const entries = [5, 6].map(day => ({ date: `2026-10-0${day}`, subjectTimes: [{ subjectId: 's', classTime: 0.13, selfStudyTime: 0.12 }] }));
  const total = aggregateWorkload(entries, range, mode).get('s').total;
  const weight = mode === 'week' ? 13 / 7 : 2;
  assert.equal(total.classTime, 0.25 * weight);
  assert.equal(total.selfStudyTime, 0);
  assert.equal(entries[0].subjectTimes[0].classTime, 0.13);
}
assert.equal(workloadBarValue(0.06, range, 'total'), 0);
assert.equal(workloadBarValue(3.75, range, 'dailyAverage'), 3.75 / 7);
assert.equal(formatStatisticsHours(3.75 / 7, 'en', 'dailyAverage'), '0.54');
assert.equal(workloadBarValue(0.5, range, 'dailyAverage'), 0.5 / 7);
assert.equal(formatStatisticsHours(0.5 / 7, 'en', 'dailyAverage'), '0.07');
const monthlyRange = { start: '2026-10-01', end: '2026-10-31' };
assert.equal(workloadBarValue(10, monthlyRange, 'weeklyAverage'), 10 / 31 * 7);
assert.equal(formatStatisticsHours(10 / 31 * 7, 'en', 'weeklyAverage'), '2.26');
const ratings = averageRatings([1, 2, 2].map((value, i) => ({ date: `2026-10-0${5 + i}`, reliability: value, socialBattery: 6 - value, subjectTimes: [] })), range);
assert.equal(ratings.reliability, 5 / 3);
assert.equal(ratings.socialBattery, 13 / 3);
const number = new Intl.NumberFormat('en', { maximumFractionDigits: 2 });
assert.equal(number.format(ratings.reliability), '1.67');
assert.equal(number.format(ratings.socialBattery), '4.33');
console.log('PASS: quarter-hour inputs, precise workload and rating averages, two-decimal average labels');
