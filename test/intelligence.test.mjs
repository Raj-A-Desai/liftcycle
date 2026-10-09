import test from 'node:test'
import assert from 'node:assert/strict'
import { exerciseHistory, progression, skipRemainingSets, undoSkipRemaining } from '../src/workoutIntelligence.ts'
const set = (id,patch={})=>({id,weight:50,reps:8,rir:2,warmup:false,done:false,skipped:false,...patch})
const ex = ()=>({id:'e',exerciseId:'pull',name:'Pullover',equipment:'Kettlebell',variation:'Flat',loadMode:'external',loadBasis:'total',unilateral:false,credits:{Back:1},sets:[]})
const w = (id,date,e,unit='lb')=>({id,date,name:'Pull',notes:'',unit,exercises:[e]})
test('bulk skip preserves completed sets/warmups and supports precise undo',()=>{
 const e=ex();e.sets=[set('warmup',{warmup:true}),set('done',{done:true}),set('existing',{skipped:true}),set('new')]
 const undo=skipRemainingSets(e,'2026-10-08T22:00:00Z')
 assert.equal(e.sets[0].skipped,false);assert.equal(e.sets[1].done,true);assert.equal(e.sets[3].skipped,true);assert.equal(e.sets[3].rir,null)
 assert.equal(skipRemainingSets(e),null)
 undoSkipRemaining(e,undo);assert.equal(e.sets[2].skipped,true);assert.equal(e.sets[3].skipped,false);assert.equal(e.sets[3].rir,2);assert.equal(e.endedAt,undefined)
})
test('undo never overwrites a subsequently completed or removed set',()=>{
 const e=ex();e.sets=[set('a'),set('b')];const undo=skipRemainingSets(e)
 e.sets[0].done=true;e.sets[0].skipped=false;e.sets.pop();undoSkipRemaining(e,undo);assert.equal(e.sets[0].done,true)
})
test('history retains skips/setup/notes and excludes current/future sessions',()=>{
 const e={...ex(),notes:'Slow eccentric',sets:[set('a',{done:true}),set('b',{skipped:true})]}
 const result=exerciseHistory([w('past','2026-10-01',e),w('current','2026-10-08',e),w('future','2026-10-09',e)],e,'2026-10-08','current')
 assert.equal(result.length,1);assert.equal(result[0].exercise.notes,'Slow eccentric');assert.equal(result[0].exercise.sets[1].skipped,true)
})
test('progression matches unit/equipment/variation and uses all working sets at rep ceiling',()=>{
 const e={...ex(),sets:[set('a',{done:true,reps:12}),set('b',{done:true,reps:8})]};const library={...e,id:'pull',repMin:6,repMax:12}
 const history=[w('past','2026-10-01',e),w('future','2026-10-10',{...e,sets:[set('x',{done:true,reps:30})]})]
 assert.equal(progression(library,history,e,'lb','2026-10-08').load,50)
 assert.equal(progression(library,history,e,'lb','2026-10-08').reps,9)
 assert.equal(progression(library,history,{...e,variation:'Incline'},'lb','2026-10-08').load,0)
 assert.equal(progression(library,history,e,'kg','2026-10-08').load,0)
})
