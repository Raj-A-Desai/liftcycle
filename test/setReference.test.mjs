import test from 'node:test'
import assert from 'node:assert/strict'
import { previousSetReference } from '../src/setReference.ts'
const set=(id,warmup=false,patch={})=>({id,warmup,done:true,skipped:false,weight:50,reps:8,rir:2,...patch})
const exercise=sets=>({id:'e',exerciseId:'pullover',equipment:'Kettlebell',variation:'Flat',loadMode:'external',loadBasis:'total',unilateral:false,sets})
const workout=(id,date,ex)=>({id,date,name:'Push',unit:'lb',status:'completed',exercises:[ex]})
test('inline reference aligns warmup and working set positions independently',()=>{
 const past=workout('past','2026-10-01',exercise([set('w',true,{weight:25}),set('a'),set('b',false,{reps:9})]))
 const ex=exercise([set('new-a'),set('new-b')]),current=workout('current','2026-10-13',ex)
 assert.equal(previousSetReference([past],current,ex,0).set.id,'a')
 assert.equal(previousSetReference([past],current,ex,1).set.reps,9)
 ex.sets.unshift(set('new-w',true))
 assert.equal(previousSetReference([past],current,ex,0).set.weight,25)
 assert.equal(previousSetReference([past],current,ex,1).set.id,'a')
})
test('inline reference excludes current session, future, different units and setup',()=>{
 const ex=exercise([set('a')]),current=workout('current','2026-10-13',ex)
 const history=[current,workout('future','2026-10-14',ex),{...workout('kg','2026-10-12',ex),unit:'kg'},workout('other','2026-10-11',{...ex,equipment:'Cable'})]
 assert.equal(previousSetReference(history,current,ex,0),null)
})
test('missing, skipped and unfinished set slots are not replaced with later sets',()=>{
 const ex=exercise([set('a'),set('b'),set('c')]),current=workout('current','2026-10-13',ex)
 const past=workout('past','2026-10-01',exercise([set('a',false,{done:false,skipped:true}),set('b')]))
 assert.equal(previousSetReference([past],current,ex,0),null)
 assert.equal(previousSetReference([past],current,ex,1).set.id,'b')
 assert.equal(previousSetReference([past],current,ex,2),null)
})
