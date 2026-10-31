import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { isFutureSubmission } from '../src/app/submissionDatePolicy.mjs';
const context = {module:{exports:{}}};
vm.runInNewContext(readFileSync('Backend/pb_hooks/submission-date-policy.js','utf8'),context);
const policy = context.module.exports;
const validationContext = {module:{exports:{}}};
vm.runInNewContext(readFileSync('Backend/pb_hooks/submission-validation.js','utf8'),validationContext);
const validation = validationContext.module.exports;
const sunday = new Date('2026-10-25T20:00:00Z');
const monday = new Date('2026-10-25T23:00:00Z');
assert.equal(policy.todayKey(monday),'2026-10-26');
assert.equal(policy.todayKey(new Date('2026-07-01T22:00:00Z')),'2026-07-02');
for(const [date,mode,now,future] of [
 ['2026-10-26','day',sunday,true],['2026-10-25','day',sunday,false],
 ['2026-10-26','week',sunday,true],['2026-10-26','week',monday,false],
 ['2026-11-01','week',monday,false],['2026-11-02','week',monday,true],
 ['2026-10-27','day',monday,true],['2026-10-26','day',monday,false],
 ['2026-03-30','week',new Date('2026-03-29T21:59:59Z'),true],
 ['2026-03-30','week',new Date('2026-03-29T22:00:00Z'),false],
]) {
 assert.equal(policy.isFuture(date,mode,now),future);
 assert.equal(isFutureSubmission(date,mode,now),future,'Frontend and server must agree');
 assert.equal(policy.assertAllowed({skipped:true},date,mode,now),future);
 if(future) assert.throws(()=>policy.assertAllowed({},date,mode,now),/only be skipped/);
}
const future = '2026-11-02';
for(const body of [
 {skipped:true,adminEffortMinutes:15},{skipped:true,commuteMinutes:15},
 {skipped:true,structuralChangesMinutes:15},
 {skipped:true,subjectTimes:[{classMinutes:60}]},
 {skipped:true,subjectTimes:[{studyMinutes:60}]},
 {skipped:true,categoryTimes:[{minutes:60}]},
 {skipped:true,categoryTimes:[{minutes:-60}]},
 {skipped:true,categoryTimes:[{minutes:'invalid'}]},
 {skipped:'true'},
]) assert.throws(()=>policy.assertAllowed(body,future,'day',monday),/only be skipped/);
// Exercise both real POST handlers: forged skip payloads must fail before any transaction.
const routes = {};
let transactions = 0;
vm.runInNewContext(readFileSync('Backend/pb_hooks/create-daily-submission.pb.js','utf8'),{
 routerAdd:(method,path,handler)=>{routes[method+' '+path]=handler;},
 $app:{runInTransaction:()=>{transactions++;}},
 __hooks:'hooks',require:name=>name.endsWith('submission-date-policy.js') ? {assertAllowed:(body,date,mode)=>policy.assertAllowed(body,date,mode,monday)} : name.endsWith('submission-validation.js') ? validation : {},
});
for(const mode of ['daily','weekly']) {
 const field=mode==='daily'?'date':'weekStart';
 const call=extra=>routes['POST /api/submissions/'+mode]({requestInfo:()=>({body:{participantId:'p',[field]:future,reliability:5,...extra}}),json:(status,body)=>({status,body})});
 const before=transactions;
 assert.equal(call({subjectTimes:[{classMinutes:60}]}).status,400);
 assert.equal(call({skipped:true,categoryTimes:[{minutes:60}]}).status,400);
 assert.equal(transactions,before);
 call({skipped:true});assert.equal(transactions,before+1,'Zero-work skip may reach the transaction');
}
console.log('PASS: future dates blocked, Monday unlock, Zurich midnight and DST, zero-work skips, and both API guards');
