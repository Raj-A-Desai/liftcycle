import test from 'node:test'
import assert from 'node:assert/strict'
import {emptyRhythm,mergeRhythm,entriesFor,workoutEntries,dateKey,weekFor,loadFor,isDone} from '../src/rhythm.ts'

test('Training is the only source of workouts; Monday does not invent Push',()=>{
  const r=emptyRhythm()
  assert.equal(entriesFor(r,'2026-10-05',workoutEntries('2026-10-05',null,[],null)).filter(e=>e.kind==='workout').length,0)
  const tuesday=entriesFor(r,'2026-10-06',workoutEntries('2026-10-06',{name:'Push'},[],null))
  assert.equal(tuesday.filter(e=>e.kind==='workout').length,1)
  assert.equal(tuesday.find(e=>e.kind==='workout').title,'Push workout')
  assert.equal(tuesday.some(e=>e.id==='vedflow'),false)
})
test('completed, skipped, and resumed workouts reflect actual records without duplication',()=>{
  const w={id:'w1',date:'2026-10-06',name:'Push',status:'completed',exercises:[]}
  const r=emptyRhythm()
  let items=workoutEntries(w.date,{name:'Pull'},[w],null)
  assert.equal(items.length,1);assert.equal(items[0].title,'Push workout');assert.equal(isDone(r,w.date,items[0]),true)
  items=workoutEntries(w.date,null,[{...w,status:'skipped'}],null)
  assert.equal(items[0].status,'skipped');assert.equal(isDone(r,w.date,items[0]),false)
  items=workoutEntries(w.date,null,[w],w)
  assert.equal(items.length,1);assert.equal(items[0].status,'draft')
})
test('Rhythm transfer merges checkmarks, water, goals, meetings and snapshot idempotently',()=>{
  const r=emptyRhythm();r.daily['2026-10-05']={walk:true,water:2};r.weeklyWins['2026-10-04']=[{text:'Existing goal',done:false}]
  const payload={version:1,progress:{daily:{'2026-10-05':{walk:false,read:true,water:1}},weeklyWins:{'2026-10-04':[{text:'Existing goal',done:true},{text:'Imported goal',done:false}]},load:{'2026-10-05':'green'}},meetings:[{id:'m1',date:'2026-10-05',title:'Private meeting',start:960,end:1020}],calendarSnapshot:{'2026-10-05':[{id:'e1',title:'Busy',detail:'Private',at:14,endAt:15}]}}
  const once=mergeRhythm(r,payload),twice=mergeRhythm(once,payload)
  assert.deepEqual(twice.daily['2026-10-05'],{walk:true,read:true,water:2});assert.equal(twice.weeklyWins['2026-10-04'].length,2);assert.equal(twice.weeklyWins['2026-10-04'][0].done,true)
  assert.equal(twice.meetings.length,1);assert.equal(twice.calendarSnapshot['2026-10-05'].length,1);assert.equal(r.daily['2026-10-05'].read,undefined)
})
test('meetings split work into chronological nonoverlapping segments with stable completion identity',()=>{
  const r=emptyRhythm();r.meetings=[{id:'m',title:'Meeting',date:'2026-10-05',start:960,end:1020}];r.daily['2026-10-05']={'task-fed':true}
  const entries=entriesFor(r,'2026-10-05',[]),work=entries.filter(e=>e.id==='fed')
  assert.deepEqual(work.map(e=>[e.at,e.endAt]),[[10,12.5],[13.25,16],[17,17.5]])
  assert.ok(work.every(e=>isDone(r,'2026-10-05',e)))
})
test('Eastern date, Sunday-first weeks, and automatic federal off-days are retained',()=>{
  assert.equal(dateKey(new Date('2026-10-06T02:00:00Z')),'2026-10-05')
  assert.deepEqual(weekFor('2026-10-05'),['2026-10-04','2026-10-05','2026-10-06','2026-10-07','2026-10-08','2026-10-09','2026-10-10'])
  assert.equal(loadFor(emptyRhythm(),'2026-10-12'),'off')
})
