import assert from 'node:assert/strict';
import { build } from 'esbuild';
const bundled = await build({entryPoints:['src/app/analytics/facultyWorkload.ts'],bundle:true,write:false,platform:'node',format:'esm'});
const { facultyWorkloadShares, completedFacultyWorkloadMetrics } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
const entry = (date, hours, adminEffort, structuralChanges, skipped=false) => ({date, adminEffort, structuralChanges, skipped, subjectTimes:[{subjectId:'work',classTime:hours,selfStudyTime:0}]});
const range={start:'2026-10-01',end:'2026-10-31'};
const rows=[entry('2026-10-05',10,5,0),entry('2026-10-12',30,3,10),entry('2026-09-21',100,100,100),entry('2026-10-19',90,90,90,true)];
const shares=facultyWorkloadShares(rows,range,'week');
assert.equal(shares[0].hours,8);assert.equal(shares[0].fraction,.2);
assert.equal(shares[1].hours,10);assert.equal(shares[1].fraction,.25);
const zero=facultyWorkloadShares([entry('2026-10-05',10,0,0)],range,'week');
assert.equal(zero[0].fraction,0);assert.equal(zero[1].fraction,0);assert.equal(zero[0].hasData,true);
const empty=facultyWorkloadShares([],range,'week');assert.equal(empty[0].hasData,false);
const partial=facultyWorkloadShares([entry('2026-09-28',14,7,3.5)],{start:'2026-10-01',end:'2026-10-04'},'week');
assert.equal(partial[0].hours,4);assert.equal(partial[0].fraction,.5);
assert.equal(shares[0].side,-1);assert.equal(shares[1].side,1);assert.notEqual(shares[0].color,shares[1].color);
console.log('PASS: faculty weighted percentages, hours, zero markers, empty periods and partial weeks');

const overview = completedFacultyWorkloadMetrics([
 entry('2026-10-12', 20, 4, 2), entry('2026-10-19', 30, 6, 3), entry('2026-10-26', 40, 8, 4),
], {start:'2026-10-12',end:'2026-11-01'}, '2026-10-30', 'week');
assert.equal(overview.get('adminEffort').total.classTime,10);
assert.equal(overview.get('adminEffort').weeklyAverage.classTime,5);
assert.equal(overview.get('structuralChanges').total.classTime,5);
assert.equal(overview.get('structuralChanges').weeklyAverage.classTime,2.5);
console.log('PASS: faculty sidebar totals and weekly averages exclude the current week');
assert.equal(shares[0].totalWorkload, 40);
assert.equal(shares[0].totalWorkload * shares[0].fraction, 8);
assert.equal(shares[1].totalWorkload * shares[1].fraction, 10);
