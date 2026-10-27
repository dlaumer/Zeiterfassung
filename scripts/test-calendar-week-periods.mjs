import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const bundle = await build({entryPoints:['src/app/analytics/workload.ts'],bundle:true,write:false,platform:'node',format:'esm'});
const w = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const today = '2026-10-28';
const range = w.resolveDateRange('last2Weeks', {restricted:false}, today, '2026-01-01');
assert.deepEqual(range,{start:'2026-10-12',end:'2026-11-01'});
assert.equal(w.bucketWorkload([],range,'weekly').length,3);
assert.equal(w.bucketWorkload([],range,'daily').length,21);
assert.deepEqual(w.resolveDateRange('last4Weeks',{restricted:false},today,today),{start:'2026-09-28',end:'2026-11-01'});
assert.deepEqual(w.resolveDateRange('all',{restricted:true},today,'2020-01-01'),range);
assert.deepEqual(w.resolveEntryDateRange('last2Weeks',{restricted:false},[{date:'2020-01-01'}],today),range);
assert.deepEqual(w.resolveDateRange('last2Weeks',{restricted:false},'2027-01-01','2026-01-01'),{start:'2026-12-14',end:'2027-01-03'});
const entries = ['2026-10-12','2026-10-19','2026-10-28'].map(date=>({date,subjectTimes:[{subjectId:'s',classTime:7,selfStudyTime:0}]}));
const metrics=w.completedWeekMetrics(entries,range,today).get('s');
assert.equal(metrics.total.classTime,14);assert.equal(metrics.weeklyAverage.classTime,7);
assert.equal(w.completedWeekMetrics(entries,{start:'2026-10-26',end:'2026-11-01'},today).size,0);
const context={module:{exports:{}}};vm.runInNewContext(readFileSync('Backend/pb_hooks/submission-review.js','utf8'),context);
const review=context.module.exports;
let configuredWeeks = 2;
const settingsApp = { findFirstRecordByFilter: (_, filter) => { assert.equal(filter, 'key = "reviewTimeWeeks"'); return {get: () => String(configuredWeeks)}; } };
assert.equal(review.settings(settingsApp,new Date(today+'T12:00:00')).reviewCutoff,'2026-10-12');
assert.equal(review.settings(settingsApp,new Date('2026-11-01T12:00:00')).reviewCutoff,'2026-10-12');
assert.equal(review.settings(settingsApp,new Date('2026-11-02T12:00:00')).reviewCutoff,'2026-10-19');
assert.deepEqual(Array.from(review.editableWeeklyStarts(settingsApp,'p',[],new Date(today+'T12:00:00'))),['2026-10-26','2026-10-19','2026-10-12']);
console.log('PASS: calendar weeks, sparse entries, year boundary, completed-week summaries and review cutoff');

const history = [
  {date:'2026-01-07', subjectTimes:[{subjectId:'old',classTime:2,selfStudyTime:0}]},
  {date:'2026-04-15', subjectTimes:[{subjectId:'current',classTime:0,selfStudyTime:0}]},
  {date:'2026-05-04', subjectTimes:[{subjectId:'current',classTime:3,selfStudyTime:0}]},
];
const allRange = ids => w.resolveEntryDateRange('all',{restricted:false,referenceDate:'2026-09-01'},w.savedModuleEntries(history,new Set(ids)).values(),today);
assert.equal(allRange(['current']).start,'2026-04-13','Zero-hour submissions set the first calendar week; reference date is ignored');
assert.equal(allRange(['current','old']).start,'2026-01-05','Adding a historical module expands All');
assert.equal(allRange(['current']).start,'2026-04-13','Removing a module removes its history from the range');
assert.equal(allRange([]).start,'2026-10-26','No saved module history falls back to the current week');
console.log('PASS: saved-module history, reference-date independence and module additions/removals');

assert.deepEqual(w.resolveDateRange('custom',{restricted:true},today,'2020-01-01',{start:'2026-10-20',end:'2026-10-22'}),{start:'2026-10-19',end:'2026-10-25'});
assert.deepEqual(w.resolveDateRange('custom',{restricted:true},today,'2020-01-01',{start:'2020-01-01',end:'2030-01-01'}),range);
assert.deepEqual(w.resolveDateRange('custom',{restricted:true},today,'2020-01-01',{start:'2020-01-01',end:'2020-01-03'}),{start:'2026-10-12',end:'2026-10-18'});
assert.deepEqual(w.resolveDateRange('custom',{restricted:true},today,'2020-01-01',{start:'2030-01-01',end:'2030-01-03'}),{start:'2026-10-26',end:'2026-11-01'});
console.log('PASS: participant custom dates stay within the three-calendar-week window');

assert.deepEqual(w.resolveDateRange('custom',{restricted:true},today,'2020-01-01',{start:'2026-10-20',end:'2026-10-22'},'daily'),{start:'2026-10-20',end:'2026-10-22'});
assert.equal(w.resolveEntryDateRange('all',{restricted:false},history,today,undefined,'day','daily').start,'2026-01-07');
assert.equal(w.resolveEntryDateRange('all',{restricted:false},history,today,undefined,'day','weekly').start,'2026-01-05');
assert.deepEqual(w.resolveDateRange('custom',{restricted:true},today,'2020-01-01',{start:'2020-01-01',end:'2030-01-01'},'daily'),range);
console.log('PASS: daily custom dates and All preserve weekdays while weekly ranges stay aligned');

for (const weeks of [0, 1, 4, 6]) {
  configuredWeeks = weeks;
  const config = review.settings(settingsApp,new Date(today+'T12:00:00'));
  assert.equal(config.reviewTimeWeeks,weeks);
  const restricted = {restricted:true,reviewTimeWeeks:weeks};
  const window = w.resolveDateRange('all',restricted,today,'2020-01-01');
  assert.equal(window.start,config.reviewCutoff);
  assert.equal(w.bucketWorkload([],window,'weekly').length,weeks+1);
  assert.equal(review.editableWeeklyStarts(settingsApp,'p',[],new Date(today+'T12:00:00')).length,weeks+1);
  assert.deepEqual(w.resolveDateRange('custom',restricted,today,today,{start:'2020-01-01',end:'2030-01-01'},'daily'),window);
}
configuredWeeks = -1;assert.throws(()=>review.settings(settingsApp),/Invalid/);
console.log('PASS: database week setting drives editable weeks and participant statistics, including zero');

const routes = {};
let persistedWeeks = '4';
const settingRecord = {get:()=>persistedWeeks,set:(field,value)=>{assert.equal(field,'value');persistedWeeks=value;}};
const routeApp = {findFirstRecordByFilter:(_,filter)=>{assert.equal(filter,'key = "reviewTimeWeeks"');return settingRecord;},save:record=>assert.equal(record,settingRecord)};
vm.runInNewContext(readFileSync('Backend/pb_hooks/admin-settings.pb.js','utf8'),{
 routerAdd:(method,path,handler)=>{routes[method]=handler;},
 $apis:{requireAuth:()=>{}},$app:routeApp,__hooks:'hooks',require:()=>review,
});
const callRoute = (method,value) => routes[method]({requestInfo:()=>({body:{reviewTimeWeeks:value}}),json:(status,body)=>({status,body})});
assert.equal(callRoute('GET').body.reviewTimeWeeks,4);
assert.equal(callRoute('PATCH',6).status,200);
assert.equal(persistedWeeks,'6');
assert.equal(callRoute('GET').body.reviewTimeWeeks,6);
for(const invalid of [-1,1.5,'2',null,5201]) assert.equal(callRoute('PATCH',invalid).status,400);
assert.equal(persistedWeeks,'6');
console.log('PASS: dashboard API reads, validates and persists the canonical database setting');
