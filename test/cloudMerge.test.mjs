import test from 'node:test'
import assert from 'node:assert/strict'
import { mergeCloudState, mergeValue } from '../src/cloudMerge.ts'
const copy=v=>JSON.parse(JSON.stringify(v))
const state=()=>({schemaVersion:3,unit:'lb',plan:{name:'PPL'},library:[],cycles:[],activeCycleId:null,history:[],draft:null,pausedDrafts:[],rhythm:{daily:{},weeklyWins:{}}})
const workout=(id)=>({id,date:'2026-10-13',name:'Push',notes:'',unit:'lb',status:'completed',exercises:[{id:'exercise',sets:[{id:'set1',done:false,weight:20,reps:8},{id:'set2',done:false,weight:20,reps:8}]}]})
test('separate device edits merge down to individual workout sets and daily fields',()=>{
 const base=state();base.draft=workout('push');const local=copy(base),remote=copy(base)
 local.draft.exercises[0].sets[0].done=true;remote.draft.exercises[0].sets[1].done=true
 local.rhythm.daily['2026-10-13']={walk:true};remote.rhythm.daily['2026-10-13']={read:true}
 const result=mergeCloudState(base,local,remote)
 assert.deepEqual(result.draft.exercises[0].sets.map(s=>s.done),[true,true])
 assert.deepEqual(result.rhythm.daily['2026-10-13'],{read:true,walk:true})
 assert.deepEqual(mergeCloudState(base,remote,local).draft,result.draft)
})
test('deletions remain deleted and later false checkmarks do not become sticky',()=>{
 assert.deepEqual(mergeValue([{id:'g',done:false}],[],[{id:'g',done:false}]),[])
 assert.deepEqual(mergeValue({done:true},{done:false},{done:true}),{done:false})
 assert.deepEqual(mergeValue([{id:'g',done:false}],[],[{id:'g',done:true}]),[{id:'g',done:true}])
})
test('older caches reconcile without erasing workouts or completed checkmarks',()=>{
 const local=state(),remote=state();local.history=[workout('local')];remote.history=[workout('remote')]
 local.rhythm.daily={today:{walk:true}};remote.rhythm.daily={today:{walk:false,read:true}}
 assert.equal(mergeCloudState(null,local,remote).history.length,2)
 assert.deepEqual(mergeCloudState(null,local,remote).rhythm.daily.today,{walk:true,read:true})
})
test('saving a workout elsewhere preserves concurrent set edits without resurrecting its draft',()=>{
 const base=state();base.draft=workout('push');const local=copy(base),remote=copy(base)
 local.draft.exercises[0].sets[0].done=true
 remote.history=[remote.draft];remote.history[0].exercises[0].sets[1].done=true;remote.draft=null
 const result=mergeCloudState(base,local,remote)
 assert.equal(result.draft,null);assert.equal(result.pausedDrafts.length,0)
 assert.deepEqual(result.history[0].exercises[0].sets.map(s=>s.done),[true,true])
 assert.equal(remote.history[0].exercises[0].sets[0].done,false)
})
test('draft changes between devices preserve both sessions and refresh without mutation',()=>{
 const base=state(),local=copy(base),remote=copy(base);local.draft=workout('push');remote.draft=workout('pull')
 const result=mergeCloudState(base,local,remote)
 assert.equal(result.draft.id,'push');assert.equal(result.pausedDrafts[0].id,'pull')
 assert.equal(base.draft,null);assert.equal(remote.pausedDrafts.length,0)
})


test('a recorded set wins over a concurrent skip without losing performed reps',()=>{
 const base={id:'set',done:false,skipped:false,reps:8},local={...base,done:true,reps:10},remote={...base,skipped:true}
 assert.deepEqual(mergeValue(base,local,remote),{id:'set',done:true,skipped:false,reps:10})
})
