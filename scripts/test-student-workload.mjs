import assert from 'node:assert/strict';
import { build } from 'esbuild';
const result = await build({ entryPoints: ['src/app/analytics/studentWorkload.ts'], bundle: true, write: false, platform: 'node', format: 'esm' });
const { withStudentWorkload } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
const bundled = await build({ entryPoints: ['src/app/analytics/workload.ts'], bundle: true, write: false, platform: 'node', format: 'esm' });
const { bucketWorkload, completedWeekMetrics, resolveEntryDateRange } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
const records = [
 { date: '2026-10-19', commuteTime: 1.5, adminEffort: .5, subjectTimes: [{subjectId:'removed',classTime:9,selfStudyTime:0}] },
 { date: '2026-10-20', commuteTime: .5, adminEffort: 1, subjectTimes: [] },
 { date: '2026-10-21', commuteTime: 9, adminEffort: 9, skipped: true, subjectTimes: [] },
 { date: '2026-10-26', commuteTime: 3, adminEffort: 2, subjectTimes: [] },
];
const enabled = new Set(['extra:commute','extra:admin']);
const augmented = withStudentWorkload(records, new Map(), enabled);
assert.equal(augmented.size,3);
assert.equal(records[0].subjectTimes[0].subjectId,'removed');
assert.ok(!Array.from(augmented.values()).some(e=>e.subjectTimes.some(s=>s.subjectId==='removed')));
const range = {start:'2026-10-19',end:'2026-11-01'};
const summary = completedWeekMetrics(augmented.values(), range, '2026-10-30');
assert.equal(summary.get('extra:commute').total.classTime,2);
assert.equal(summary.get('extra:admin').total.classTime,1.5);
assert.equal(summary.get('extra:commute').weeklyAverage.classTime,2);
const buckets = bucketWorkload(augmented.values(), range, 'weekly');
assert.equal(buckets[0].metrics.get('extra:commute').total.classTime,2);
assert.equal(buckets[1].metrics.get('extra:admin').total.classTime,2);
assert.equal(withStudentWorkload(records,new Map(),new Set()).size,0);
assert.equal(withStudentWorkload(records,new Map(),new Set(['extra:commute'])).get('2026-10-19').subjectTimes.length,1);
console.log('PASS: student extra hours, summaries, buckets, skipped entries, module filtering and disabled categories');

const history = [
 {date:'2026-06-01',subjectTimes:[],adminEffort:0},
 {date:'2026-06-02',subjectTimes:[]},
 {date:'2026-06-03',subjectTimes:[],adminEffort:NaN},
 {date:'2026-09-14',subjectTimes:[{subjectId:'module',classTime:2,selfStudyTime:0}],adminEffort:1},
];
const moduleEntries = new Map([[history[3].date,history[3]]]);
const adminEnabled = withStudentWorkload(history,moduleEntries,new Set(['extra:admin']));
assert.deepEqual([...adminEnabled.keys()],['2026-09-14']);
const policy={restricted:false};
assert.deepEqual(resolveEntryDateRange('all',policy,adminEnabled.values(),'2026-10-30'),resolveEntryDateRange('all',policy,moduleEntries.values(),'2026-10-30'));
const positiveHistory = [{date:'2026-06-01',subjectTimes:[],adminEffort:1},...history.slice(1)];
assert.equal(withStudentWorkload(positiveHistory,moduleEntries,new Set(['extra:admin'])).has('2026-06-01'),true);
const savedZero={date:'2026-06-01',subjectTimes:[{subjectId:'module',classTime:0,selfStudyTime:0}]};
assert.equal(withStudentWorkload([savedZero],new Map([[savedZero.date,savedZero]]),new Set(['extra:admin'])).has(savedZero.date),true);
console.log('PASS: empty extra categories do not extend All history; positive extras and saved zero module entries remain included');
const commuteHistory = history.map(({adminEffort,...entry}) => ({...entry,commuteTime:adminEffort}));
const commuteEnabled = withStudentWorkload(commuteHistory,moduleEntries,new Set(['extra:commute']));
assert.deepEqual([...commuteEnabled.keys()],['2026-09-14']);
assert.deepEqual(resolveEntryDateRange('all',policy,commuteEnabled.values(),'2026-10-30'),resolveEntryDateRange('all',policy,moduleEntries.values(),'2026-10-30'));
assert.equal(withStudentWorkload([{date:'2026-06-01',subjectTimes:[],commuteTime:1},...commuteHistory.slice(1)],moduleEntries,new Set(['extra:commute'])).has('2026-06-01'),true);
console.log('PASS: empty commute history does not extend All; actual earlier commute hours remain included');

const moduleRange = resolveEntryDateRange('all',policy,moduleEntries.values(),'2026-10-30');
for (const [field,id] of [['commuteTime','extra:commute'],['adminEffort','extra:admin']]) {
 const extended = withStudentWorkload([{date:'2026-06-01',subjectTimes:[],[field]:9},...history],moduleEntries,new Set([id]));
 const chartBuckets = bucketWorkload(extended.values(),moduleRange,'weekly');
 assert.ok(chartBuckets.every(bucket=>bucket.start>=moduleRange.start));
 assert.ok(chartBuckets.every(bucket=>(bucket.metrics.get(id)?.total.classTime??0)<9));
}
console.log('PASS: positive older commute and admin hours stay outside the module-defined chart range');
