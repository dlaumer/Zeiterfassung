import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundle = await build({ entryPoints: ['src/app/analytics/workload.ts'], bundle: true, write: false, platform: 'node', format: 'esm' });
const { aggregateWorkload, workloadBarValue, formatStatisticsHours, roundQuarterHour } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
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
for (const mode of ['total', 'weeklyAverage', 'dailyAverage']) {
  for (const total of [0.06, 0.7, 3.9, 4.2]) {
    const value = workloadBarValue(total, range, mode);
    assert.equal(value * 4, Math.round(value * 4));
    assert.equal(Number(formatStatisticsHours(value, 'en')), value);
  }
}
assert.equal(workloadBarValue(3.9, range, 'dailyAverage'), 0.5);
assert.equal(workloadBarValue(4.2, range, 'dailyAverage'), 0.5);
assert.equal(workloadBarValue(0.5, range, 'dailyAverage'), 0);
console.log('PASS: inputs round before aggregation; bar heights and labels agree for totals and averages');
