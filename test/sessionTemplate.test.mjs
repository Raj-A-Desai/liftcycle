import test from 'node:test'
import assert from 'node:assert/strict'
import { sessionSets, previousWarmups, freshSet } from '../src/sessionTemplate.ts'
const set=(id,weight,reps,warmup=false)=>({id,weight,reps,warmup,done:true,skipped:false,rir:3})
const ex={id:'ex',exerciseId:'pullover',equipment:'Kettlebell',variation:'Flat bench',loadMode:'external',loadBasis:'total',unilateral:false,sets:[]}
const past={id:'past',date:'2026-09-29',unit:'lb',status:'completed',exercises:[{...ex,sets:[set('w1',25,8,true),set('w2',50,4,true),set('s1',50,7),set('s2',50,7),set('s3',50,7)]}]}
test('new session keeps previous warmups and at least previous working count with fresh tracking',()=>{
 const result=sessionSets([past],ex,'lb','2026-10-13',2,50,8)
 assert.deepEqual(result.map(s=>[s.weight,s.reps,s.warmup]),[[25,8,true],[50,4,true],[50,8,false],[50,8,false],[50,8,false]])
 assert.ok(result.every(s=>!s.done&&!s.skipped&&s.rir===null))
 assert.equal(new Set(result.map(s=>s.id)).size,5)
 assert.ok(result.every(s=>!past.exercises[0].sets.some(p=>p.id===s.id)))
})
test('warmup lookup uses matching setup/unit and supports drafts that missed earlier warmups',()=>{
 assert.equal(previousWarmups([past],ex,'kg','2026-10-13').length,0)
 assert.equal(previousWarmups([past],{...ex,equipment:'Cable'},'lb','2026-10-13').length,0)
 assert.equal(previousWarmups([past],ex,'lb','2026-09-01').length,0)
 assert.equal(previousWarmups([past],ex,'lb','2026-10-13','past').length,0)
 const recent={...past,id:'recent',date:'2026-10-01',exercises:[{...ex,sets:[set('work',50,7)]}]}
 assert.equal(previousWarmups([past,recent],ex,'lb','2026-10-13').length,2)
})
test('planned additional sets are retained and skipped warmups are not copied',()=>{
 const history=structuredClone(past);history.exercises[0].sets[0].skipped=true
 const result=sessionSets([history],ex,'lb','2026-10-13',4,50,8)
 assert.equal(result.filter(s=>!s.warmup).length,4)
 assert.equal(result.filter(s=>s.warmup).length,1)
 const manual=freshSet(25,8,true);assert.equal(manual.warmup,true);assert.equal(manual.rir,null);assert.equal(manual.done,false)
})
