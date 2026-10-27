import assert from 'node:assert/strict';
import { build } from 'esbuild';
const bundle = await build({ entryPoints: ['src/app/analytics/workload.ts'], bundle: true, write: false, platform: 'node', format: 'esm' });
const { averageRatings } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const range = { start: '2026-10-01', end: '2026-10-31' };
const rows = [
  { date: '2026-10-01', reliability: 1, socialBattery: 5 },
  { date: '2026-10-02', reliability: 4, socialBattery: 0 },
  { date: '2026-10-03', reliability: 0, socialBattery: 3 },
  { date: '2026-10-04', reliability: 5, socialBattery: 1, skipped: true },
  { date: '2026-09-30', reliability: 5, socialBattery: 1 },
];
assert.deepEqual(averageRatings(rows, range), { reliability: 2.5, socialBattery: 4 });
assert.deepEqual(averageRatings([], range), { reliability: null, socialBattery: null });
assert.deepEqual(averageRatings([{ date: '2026-10-01', reliability: NaN, socialBattery: 6 }], range), { reliability: null, socialBattery: null });
assert.deepEqual(averageRatings([{ date: '2026-09-28', reliability: 1 }, { date: '2026-10-05', reliability: 5 }], { start: '2026-10-01', end: '2026-10-06' }, 'week'), { reliability: 7 / 3, socialBattery: null });
console.log('Rating averages passed');
