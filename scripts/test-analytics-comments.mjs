import assert from 'node:assert/strict';
import { build } from 'esbuild';
const bundle = await build({ entryPoints: ['src/app/analytics/workload.ts'], bundle: true, write: false, platform: 'node', format: 'esm' });
const { collectPeriodComments } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const entries = [
 { date: '2026-10-02', comments: [' Correction ', 'Original'], comment: 'Correction' },
 { date: '2026-10-01', comment: 'First' },
 { date: '2026-10-03', comment: '   ' },
 { date: '2026-10-04', skipped: true, comment: 'Skipped' },
 { date: '2026-09-28', comment: 'Previous week' },
];
assert.deepEqual(collectPeriodComments(entries, { start: '2026-10-01', end: '2026-10-04' }), [
 { date: '2026-10-01', comment: 'First' },
 { date: '2026-10-02', comment: 'Correction' },
 { date: '2026-10-02', comment: 'Original' },
]);
assert.deepEqual(collectPeriodComments([entries[4]], { start: '2026-10-01', end: '2026-10-03' }, 'week'), [{ date: '2026-09-28', comment: 'Previous week' }]);
assert.deepEqual(collectPeriodComments(entries, { start: '2026-11-01', end: '2026-11-30' }), []);
console.log('Period comment tests passed');
