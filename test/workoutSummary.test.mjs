import test from 'node:test'
import assert from 'node:assert/strict'
import { actualExerciseSummary } from '../src/workoutSummary.ts'

const base = {
  id:'e1', exerciseId:'rdl', name:'Romanian Deadlift', equipment:'EZ bar', variation:'',
  loadMode:'external', loadBasis:'total', unilateral:false, credits:{}
}

test('weekly workout summary uses completed work sets and excludes warmups', () => {
  const ex = { ...base, sets:[
    {id:'1',weight:35,reps:8,rir:null,warmup:true,done:true},
    {id:'2',weight:65,reps:4,rir:null,warmup:true,done:true},
    {id:'3',weight:65,reps:8,rir:2.5,warmup:false,done:true},
    {id:'4',weight:65,reps:8,rir:2,warmup:false,done:true},
  ]}
  assert.deepEqual(actualExerciseSummary(ex,'lb'), { work:'2 × 8 · 65 lb', note:'RIR 2–2.5' })
})

test('different completed work sets are not collapsed into fake plan targets', () => {
  const ex = { ...base, sets:[
    {id:'1',weight:15,reps:10,rir:4,warmup:false,done:true},
    {id:'2',weight:20,reps:8,rir:3,warmup:false,done:true},
  ]}
  assert.equal(actualExerciseSummary(ex,'lb').work, '1 × 10 · 15 lb / 1 × 8 · 20 lb')
})
