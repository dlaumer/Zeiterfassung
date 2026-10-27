import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const load = file => {const context={module:{exports:{}}};vm.runInNewContext(readFileSync(file,'utf8'),context);return context.module.exports;};
const review = load('Backend/pb_hooks/submission-review.js');
const datePolicy = load('Backend/pb_hooks/submission-date-policy.js');
const record=(id,values)=>({id,get:key=>values[key]??''});
function overview(now,{mode='day',reference='2026-10-19',dates=[]}={}) {
 const routes={};
 const participant=record('p',{name:'Test participant',entryMode:mode,referenceDate:reference,type:mode==='day'?'student':'faculty'});
 const submissions=dates.map((date,i)=>record('s'+i,{participant:'p',periodType:mode,periodStart:date+' 00:00:00.000Z',periodEnd:date+' 23:59:59.000Z',submissionMode:'initial',submittedAt:date+' 12:00:00.000Z'}));
 const app={findRecordsByFilter:collection=>collection==='participants'?[participant]:collection==='submissions'?submissions:[]};
 vm.runInNewContext(readFileSync('Backend/pb_hooks/admin-view.pb.js','utf8'),{
  onRecordAfterDeleteSuccess:()=>{}, routerAdd:(method,path,handler)=>{routes[method+' '+path]=handler;},$apis:{requireAuth:()=>{}},$app:app,__hooks:'hooks',
  require:name=>name.endsWith('submission-date-policy.js')?{todayKey:()=>datePolicy.todayKey(new Date(now))}:review,
 });
 return routes['GET /api/admin/overview']({json:(status,body)=>{assert.equal(status,200);return body;}}).participants[0].missingCount;
}
// Six completed weekdays on Tuesday morning, regardless of today's submission.
assert.equal(overview('2026-10-27T07:00:00Z'),6);
assert.equal(overview('2026-10-27T07:00:00Z',{dates:['2026-10-27']}),6);
assert.equal(overview('2026-10-27T07:00:00Z',{dates:['2026-10-28','2026-10-29','2026-11-02']}),6,'Future vacation skips cannot erase old gaps');
assert.equal(overview('2026-10-27T07:00:00Z',{dates:['2026-10-26','2026-10-27']}),5);
// Swiss midnight, winter: UTC date still says Monday.
assert.equal(overview('2026-10-26T22:59:59Z'),5);
assert.equal(overview('2026-10-26T23:00:00Z'),6);
assert.equal(overview('2026-10-27T07:40:00Z'),6);
// Summer: the daily rollover occurs at 22:00 UTC.
assert.equal(overview('2026-07-06T21:59:59Z',{reference:'2026-07-06'}),0);
assert.equal(overview('2026-07-06T22:00:00Z',{reference:'2026-07-06'}),1);
// A weekend never receives a synthetic minus-one adjustment.
assert.equal(overview('2026-10-24T07:00:00Z'),5);
assert.equal(overview('2026-10-25T07:00:00Z'),5);
assert.equal(overview('2026-10-27T07:00:00Z',{reference:'2026-11-01'}),0);
// Weekly counts exclude only the current week and ignore future skips.
assert.equal(overview('2026-10-26T23:00:00Z',{mode:'week',reference:'2026-10-05'}),3);
assert.equal(overview('2026-10-26T23:00:00Z',{mode:'week',reference:'2026-10-05',dates:['2026-10-26','2026-11-02']}),3);
assert.equal(overview('2026-10-26T23:00:00Z',{mode:'week',reference:'2026-10-05',dates:['2026-10-19']}),2);
console.log('PASS: actual admin overview counts completed Swiss-calendar periods, including midnight, summer time, weekends, current submissions and future skips');

function workload(now) {
 let handler;
 const participant=record('p',{entryMode:'day',referenceDate:'2026-10-19',type:'student'});
 const app={findFirstRecordByFilter:collection=>collection==='participants'?participant:record('settings',{value:'2'}),findRecordsByFilter:()=>[]};
 vm.runInNewContext(readFileSync('Backend/pb_hooks/workload-status.pb.js','utf8'),{
  routerAdd:(_,__,callback)=>{handler=callback;},$app:app,__hooks:'hooks',
  require:name=>name.endsWith('submission-date-policy.js')?{todayKey:()=>datePolicy.todayKey(new Date(now))}:review,
 });
 return handler({requestInfo:()=>({query:{participantId:'p'}}),json:(status,body)=>{assert.equal(status,200);return body;}});
}
const previousTimezone=process.env.TZ;
try {
 for(const timezone of ['UTC','Europe/Zurich','America/Los_Angeles']) {
  process.env.TZ=timezone;
  assert.equal(overview('2026-10-26T23:00:00Z'),6,timezone);
  const status=workload('2026-10-26T23:00:00Z');
  assert.equal(status.currentPeriod.periodStart.slice(0,10),'2026-10-27',timezone);
  assert.equal(status.missingPeriods.length,7,'Participant calendar includes today, admin counts only completed days');
 }
} finally { if(previousTimezone===undefined) delete process.env.TZ; else process.env.TZ=previousTimezone; }
console.log('PASS: admin and participant dates agree across UTC, Zurich and US server timezones');
