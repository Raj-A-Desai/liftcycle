import test from 'node:test'
import assert from 'node:assert/strict'
import { primaryAttention } from '../src/attention.ts'
import { exerciseTrend, progression, skipRemainingSets, undoSkipRemaining } from '../src/workoutIntelligence.ts'
import { buildWeeklyReviewInput } from '../src/weeklyReview.ts'
import { emptyRhythm, normalizeRhythm } from '../src/rhythm.ts'
import { deriveMomentum, planningSuggestions } from '../src/planning.ts'
const state=()=>({schemaVersion:3,unit:'lb',library:[],plan:{},cycles:[{id:'cycle',name:'Pull',startDate:'2026-09-20',weeks:6,days:['','','pull','','pull','',''],splits:[{id:'pull',name:'Pull',items:[]}]}],activeCycleId:'cycle',history:[],draft:null,rhythm:emptyRhythm()})
const set=(reps=8,weight=50,rir=2)=>({id:'set',weight,reps,rir,warmup:false,done:true,skipped:false})
const exercise=(patch={})=>({id:'e',exerciseId:'pull',name:'Pullover',equipment:'Kettlebell',variation:'Flat',loadMode:'external',loadBasis:'total',unilateral:false,credits:{Back:1},sets:[set()],...patch})
const workout=(date,reps=8,patch={})=>({id:date,date,name:'Pull',unit:'lb',notes:'',exercises:[exercise({sets:[set(reps)]})],...patch})
test('Today prioritizes draft, current fixed, imminent fixed, workout, intention, goal, then open space',()=>{
 const s=state(),date='2026-10-08';s.rhythm.meetings=[{id:'fixed',title:'Review',date,start:660,end:720}]
 s.rhythm.intentions=[{id:'i',title:'Focus block',date,duration:30,detail:'',done:false,moves:[]}]
 s.rhythm.weeklyWins['2026-10-04']=[{id:'g',text:'Ship',done:false}]
 s.draft=workout('2026-10-07');assert.equal(primaryAttention(s,date,11).kind,'draft')
 s.draft=null;assert.equal(primaryAttention(s,date,11).title,'Review');assert.equal(primaryAttention(s,date,10.5).label,'Up next')
 assert.equal(primaryAttention(s,date,7.5).entry.kind,'workout')
 s.history=[{...workout(date),status:'skipped'}];assert.equal(primaryAttention(s,date,12).title,'Focus block')
 s.rhythm.intentions[0].done=true;assert.equal(primaryAttention(s,date,12).kind,'goal')
 s.rhythm.weeklyWins['2026-10-04'][0].done=true;assert.equal(primaryAttention(s,date,21).kind,'open')
})
test('trend comparisons ignore unit, load basis, variation, future and incomplete work',()=>{
 const e=exercise(),history=[workout('2026-10-07',11),workout('2026-10-05',9),workout('2026-10-01',8),workout('2026-10-09',30)]
 assert.equal(exerciseTrend(history,e,'lb','2026-10-08'),'+3 total reps across 3 sessions at the same load.')
 assert.equal(exerciseTrend(history,e,'kg','2026-10-08'),null)
 assert.equal(exerciseTrend(history,{...e,loadBasis:'per-hand'},'lb','2026-10-08'),'First recorded session with this setup.')
 history[0].exercises[0].sets=[set(11),set(11)];assert.equal(exerciseTrend(history,e,'lb','2026-10-08'),'Same working load for the last 2 sessions.')
 assert.equal(exerciseTrend([workout('2026-09-20')],e,'lb','2026-10-08'),'18 days since this setup’s last session.')
})
test('skip reason persists as an optional field and undo restores prior reason',()=>{
 const e=exercise({skipReason:'time',sets:[{...set(),done:false}]});const undo=skipRemainingSets(e);assert.equal(e.skipReason,undefined)
 e.skipReason='fatigue';assert.equal(JSON.parse(JSON.stringify(e)).skipReason,'fatigue');undoSkipRemaining(e,undo);assert.equal(e.skipReason,'time')
})
test('bodyweight progression never asks for a load increase at zero load',()=>{
 const e=exercise({loadMode:'bodyweight',sets:[set(12,0)]}),w=workout('2026-10-01',12,{exercises:[e]})
 assert.notEqual(progression({...e,id:'pull',repMin:6,repMax:12},[w],e,'lb','2026-10-08').label,'Try a small load increase')
})
test('review context preserves goal links, repeated carryovers, moves and skip reasons without inventing commentary',()=>{
 const s=state();s.rhythm.weeklyWins['2026-09-06']=[{id:'g',text:'Ship',done:false}]
 s.rhythm.intentions=[{id:'i',title:'Focus',date:'2026-10-01',duration:30,detail:'',done:true,goalId:'g',moves:[]}]
 s.history=[workout('2026-10-01',8,{exercises:[exercise({endedAt:'2026-10-01T20:00:00Z',skipReason:'time'})]})]
 const input=buildWeeklyReviewInput(s,'2026-09-27','2026-10-08')
 assert.equal(input.longitudinal.recentMomentum.length,4);assert.equal(input.longitudinal.goalSnapshots.length,5)
 assert.equal(input.longitudinal.goalLinks[0].intentions[0].completed,true);assert.equal(input.longitudinal.endedExercises[0].skipReason,'time')
 assert.equal(normalizeRhythm(JSON.parse(JSON.stringify(s.rhythm))).intentions[0].goalId,'g')
 assert.equal(s.rhythm.weeklyWins['2026-09-06'][0].done,false)
})
test('Momentum compares the same weekday cutoff and ignores warmups and skipped sessions',()=>{
 const s=state();s.history=[workout('2026-10-09'),workout('2026-10-06'),workout('2026-10-03'),workout('2026-09-29'),workout('2026-10-07',8,{status:'skipped'})]
 const signal=deriveMomentum(s,'2026-10-08');assert.equal(signal.direction,'level');assert.match(signal.comparison,/1 recorded workouts.*1 at the same point/)
})
test('adaptive moves account for fixed-commitment availability',()=>{
 const s=state();s.rhythm.intentions=[{id:'i',title:'Focus',date:'2026-10-07',duration:30,detail:'',done:false,moves:[]}]
 s.rhythm.meetings=[{id:'busy',title:'All-day work',date:'2026-10-09',start:480,end:1320}]
 const suggestion=planningSuggestions(s,'2026-10-08').find(x=>x.intentionId==='i');assert.equal(suggestion.to,undefined);assert.match(suggestion.detail,/no 30-minute opening/)
})
