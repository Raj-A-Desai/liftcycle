import test from 'node:test'
import assert from 'node:assert/strict'
import { emptyRhythm, entriesFor, normalizeRhythm, isDone } from '../src/rhythm.ts'
import { acceptTrainingMove, undoTrainingMove, plannedSplit, deriveMomentum, planningSuggestions, moveIntention, undoIntentionMove } from '../src/planning.ts'
import { buildWeeklyReviewInput, saveWeeklyReview, validateWeeklyReview } from '../src/weeklyReview.ts'
const state = ()=>({schemaVersion:3,unit:'lb',library:[],plan:{},cycles:[{id:'cycle',name:'PPL',startDate:'2026-09-20',weeks:6,days:['','','pull','','pull','',''],splits:[{id:'pull',name:'Pull',items:[]}]}],activeCycleId:'cycle',history:[],draft:null,rhythm:emptyRhythm()})
const review = ()=>({version:1,weekStart:'2026-09-27',weekEnd:'2026-10-03',generatedAt:'2026-10-04T03:00:00Z',recap:'One session recorded.',wins:['Logged training'],friction:[],trainingSummary:'One workout.',planningConsistency:'Limited observations.',momentum:'Building',patterns:[],nextWeekFocus:'Keep the next session manageable.',message:'Choose one useful step.',recommendations:['Plan the next session']})
test('planner differentiates fixed/flexible and optional-time intentions without losing old data',()=>{
 const r=normalizeRhythm({daily:{'2026-10-08':{read:true}},meetings:[{id:'m',title:'Meeting',date:'2026-10-08',start:540,end:600}]})
 r.intentions=[{id:'i',title:'Read',date:'2026-10-08',duration:20,detail:'',done:true,moves:[]}]
 const entries=entriesFor(r,'2026-10-08',[])
 assert.equal(entries.find(e=>e.id==='m').intent,'fixed');assert.equal(entries.find(e=>e.id==='read').intent,'flexible');assert.equal(entries.find(e=>e.id==='i').untimed,true)
 assert.equal(isDone(r,'2026-10-08',entries.find(e=>e.id==='i')),true);assert.equal(r.daily['2026-10-08'].read,true)
})
test('training rescheduling is explicit, preserves skip history and can be undone',()=>{
 const s=state();s.history=[{id:'skip',date:'2026-10-06',name:'Pull',unit:'lb',notes:'',status:'skipped',exercises:[]}]
 const original=structuredClone(s.history)
 acceptTrainingMove(s,'2026-10-06','2026-10-10','move');assert.equal(plannedSplit(s,'2026-10-06'),null);assert.equal(plannedSplit(s,'2026-10-10').name,'Pull');assert.deepEqual(s.history,original)
 undoTrainingMove(s,'move');assert.equal(plannedSplit(s,'2026-10-06').name,'Pull')
 assert.throws(()=>acceptTrainingMove(s,'2026-10-06','2026-10-08','busy'))
})
test('intention movement keeps an audit trail and supports undo',()=>{
 const i={id:'i',date:'2026-10-07',done:false,moves:[]};moveIntention(i,'2026-10-09');assert.equal(i.moves[0].from,'2026-10-07');undoIntentionMove(i);assert.equal(i.date,'2026-10-07')
})
test('Momentum does not fabricate adherence or punish missing routine checkmarks',()=>{
 const s=state();assert.equal(deriveMomentum(s,'2026-10-08').label,'Resetting');assert.equal(deriveMomentum(s,'2026-10-08').observed,0)
 s.rhythm.daily['2026-10-08']={read:true};assert.equal(deriveMomentum(s,'2026-10-08').label,'Building');assert.equal(deriveMomentum(s,'2026-10-08').followed,1)
})
test('suggestions do not modify schedules and dismissals survive',()=>{
 const s=state(), before=JSON.stringify(s);const suggestions=planningSuggestions(s,'2026-10-08');assert.equal(JSON.stringify(s),before)
 s.dismissedSuggestions=suggestions.map(x=>x.id);assert.equal(planningSuggestions(s,'2026-10-08').length,0)
})
test('weekly review persistence is validated/idempotent and preserves state/history',()=>{
 const s=state(), before=structuredClone(s);saveWeeklyReview(s,review(),'2026-10-08');saveWeeklyReview(s,{...review(),recap:'Updated recap'},'2026-10-08')
 assert.equal(s.reviews.length,1);assert.equal(s.reviews[0].recap,'Updated recap');assert.deepEqual(s.history,before.history);assert.deepEqual(s.rhythm,before.rhythm)
 const reloaded=JSON.parse(JSON.stringify(s));assert.equal(validateWeeklyReview(reloaded.reviews[0],'2026-10-08').message,review().message)
 assert.throws(()=>saveWeeklyReview(s,{...review(),weekEnd:'2026-10-10'},'2026-10-08'));assert.throws(()=>validateWeeklyReview({...review(),wins:['']},'2026-10-08'))
})
test('review input uses completed weeks and distinguishes unknown plans from failure',()=>{
 const s=state();const input=buildWeeklyReviewInput(s,'2026-09-27','2026-10-08');assert.equal(input.days.length,7);assert.equal(input.days[0].hasPlanningObservations,false)
 assert.ok(input.days[0].entries.every(e=>e.observation==='unrecorded'));assert.throws(()=>buildWeeklyReviewInput(s,'2026-10-04','2026-10-08'))
})

test('moving skipped training does not double-count the weekly plan', async()=>{
 const { weekSignals } = await import('../src/planning.ts')
 const s=state();s.history=[{id:'skip',date:'2026-10-06',name:'Pull',unit:'lb',notes:'',status:'skipped',scheduledId:'cycle:2026-10-06',exercises:[]}]
 assert.equal(weekSignals(s,'2026-10-08').plannedWorkouts,2)
 acceptTrainingMove(s,'2026-10-06','2026-10-10','move')
 assert.equal(weekSignals(s,'2026-10-08').plannedWorkouts,2)
})
