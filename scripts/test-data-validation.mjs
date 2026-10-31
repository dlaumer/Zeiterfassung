import assert from 'node:assert/strict';
import { loadHook } from './lib/load-hook.mjs';
const validation = loadHook('submission-validation.js');
for (const date of ['2026-02-29', '2026-04-31', '2026-13-01', '2026-01-01T00:00:00', '']) assert.equal(validation.dateOnly(date), false);
for (const date of ['2024-02-29', '2026-10-30']) assert.equal(validation.dateOnly(date), true);
for (const body of [
  {adminEffortMinutes:-1}, {commuteMinutes:'bad'}, {structuralChangesMinutes:Infinity},
  {subjectTimes:[null]}, {subjectTimes:{}}, {categoryTimes:[{categoryId:'x',minutes:true}]},
  {subjectTimes:[{subjectId:'x'},{subjectId:'x'}]}, {categoryTimes:[{categoryId:'x'},{categoryId:'x'}]},
]) assert.throws(() => validation.totals(body));
validation.totals({subjectTimes:[{subjectId:'x',classMinutes:1.5,studyMinutes:'60'}]});
const queries = loadHook('record-queries.js');
const calls = [];
const app = {findRecordsByFilter(collection,filter,sort,limit,offset,params) {
  assert.equal(limit,0); assert.equal(offset,0);
  calls.push(filter);
  return Object.values(params).map(id => ({id}));
}};
const ids = Array.from({length:1205},(_,i)=>'record'+i);
const records = queries.related(app,'submission_items','submission',[...ids,...ids]);
assert.equal(records.length,ids.length);
assert.equal(calls.length,13);
assert.ok(calls.every(filter => filter.split(' || ').length <= 100));
assert.equal(queries.related(app,'submission_items','submission',[]).length,0);
const review = loadHook('submission-review.js');
const record = (id, predecessor='', mode='correction') => ({id,get:key=>({replacesSubmission:predecessor,submissionMode:mode})[key]});
const chain = [record('root','','initial'), ...Array.from({length:1200},(_,i)=>record('c'+i,i===0?'root':'c'+(i-1)))];
assert.equal(review.active({findRecordById:()=>assert.fail('Preloaded chains need no additional database reads')},chain).length,chain.length);
assert.throws(()=>review.active({},[record('a','b'),record('b','a')]),/Cyclic/);
const csv = loadHook('csv.js');
assert.equal(csv.row([-1, '=1+1', 'a\rb', 'a,"b']), '-1,\'=1+1,"a\rb","a,""b"');
assert.equal(csv.escape('="2026-10-30 00:00:00"'),'"=""2026-10-30 00:00:00"""');
const previousTimezone = process.env.TZ;
try {
  for (const timezone of ['UTC','Europe/Zurich','America/Los_Angeles']) {
    process.env.TZ = timezone;
    class SwissMonday extends Date { constructor(...args) { super(...(args.length ? args : ['2026-10-25T23:30:00Z'])); } }
    const policy = loadHook('submission-review.js',{Date:SwissMonday});
    assert.equal(policy.settings({findFirstRecordByFilter:()=>({get:()=>2})}).reviewCutoff,'2026-10-12',timezone);
  }
} finally { if(previousTimezone === undefined) delete process.env.TZ; else process.env.TZ = previousTimezone; }
console.log('PASS: invalid dates/times, duplicate rows, bounded complete reads, cached history chains, cycles and CSV escaping');
