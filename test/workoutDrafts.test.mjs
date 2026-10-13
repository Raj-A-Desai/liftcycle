import test from 'node:test'
import assert from 'node:assert/strict'
import { activateWorkoutDraft, findWorkoutDraft } from '../src/workoutDrafts.ts'
import { dayEntries } from '../src/planning.ts'
import { primaryAttention } from '../src/attention.ts'
import { emptyRhythm } from '../src/rhythm.ts'

const workout=(id,date,name,splitId)=>({id,date,name,splitId,notes:'Keep this note',unit:'lb',exercises:[]})
const state=()=>({schemaVersion:3,unit:'lb',library:[],plan:{},cycles:[{id:'cycle',name:'PPL',startDate:'2026-09-20',weeks:6,days:['pull','','push','','legs','',''],splits:[{id:'pull',name:'Pull',items:[]},{id:'push',name:'Push',items:[]}]}],activeCycleId:'cycle',history:[],draft:workout('old','2026-10-11','Pull'),rhythm:emptyRhythm()})

test('October 13 Push does not reuse missed October 11 Pull; switching preserves both drafts',()=>{
 const s=state(),old=s.draft,push={id:'push',name:'Push'}
 assert.equal(findWorkoutDraft(s,'2026-10-13',push),undefined)
 const current=workout('new','2026-10-13','Push','push')
 activateWorkoutDraft(s,current)
 assert.equal(s.draft,current);assert.deepEqual(s.pausedDrafts,[old]);assert.deepEqual(s.history,[])
 assert.equal(findWorkoutDraft(s,'2026-10-13',push),current)
 assert.equal(findWorkoutDraft(s,'2026-10-11',{id:'pull',name:'Pull'}),old)
 activateWorkoutDraft(s,old);activateWorkoutDraft(s,current)
 assert.deepEqual(s.pausedDrafts,[old]);assert.equal(s.pausedDrafts[0].notes,'Keep this note')
 const restored=JSON.parse(JSON.stringify(s))
 assert.equal(findWorkoutDraft(restored,'2026-10-11',{id:'pull',name:'Pull'}).id,'old')
})

test('same-day different splits remain distinct, while renamed sessions match their split ID',()=>{
 const s=state();s.draft=workout('a','2026-10-13','Custom name','pull')
 assert.equal(findWorkoutDraft(s,'2026-10-13',{id:'push',name:'Push'}),undefined)
 assert.equal(findWorkoutDraft(s,'2026-10-13',{id:'pull',name:'Pull'}).id,'a')
})

test('Today keeps current plans ahead of older drafts; paused sessions remain available on their dates',()=>{
 const s=state()
 assert.equal(primaryAttention(s,'2026-10-13',17).entry.title,'Push workout')
 const old=s.draft;activateWorkoutDraft(s,workout('new','2026-10-13','Push','push'))
 assert.equal(primaryAttention(s,'2026-10-13',17).workoutId,'new')
 assert.equal(dayEntries(s,'2026-10-11').find(e=>e.kind==='workout').workout.id,old.id)
})

test('skipping an older draft preserves current session and records a skipped workout',async()=>{
 const {resolveSkippedDraft}=await import('../src/workoutDrafts.ts')
 const s=state(),old=s.draft;activateWorkoutDraft(s,workout('new','2026-10-13','Push','push'))
 resolveSkippedDraft(s,old.id)
 assert.equal(s.draft.id,'new');assert.equal(s.pausedDrafts.length,0)
 assert.equal(s.history[0].status,'skipped');assert.equal(s.history[0].date,'2026-10-11')
})

test('ending a partially performed draft preserves logged work and skips only remaining work',async()=>{
 const {resolveSkippedDraft}=await import('../src/workoutDrafts.ts')
 const s=state();s.draft.exercises=[{sets:[{id:'done',done:true,warmup:false,reps:8,rir:2},{id:'remaining',done:false,warmup:false,rir:3},{id:'warmup',done:false,warmup:true}]}]
 resolveSkippedDraft(s,s.draft.id)
 assert.equal(s.draft,null);assert.equal(s.history[0].status,'completed')
 assert.equal(s.history[0].exercises[0].sets[0].reps,8)
 assert.equal(s.history[0].exercises[0].sets[1].skipped,true)
 assert.equal(s.history[0].exercises[0].sets[1].rir,null)
 assert.equal(s.history[0].exercises[0].sets[2].skipped,undefined)
})
