import test from 'node:test'
import assert from 'node:assert/strict'
import { consistencyStats, muscleRows } from '../src/metrics.ts'

const makeWorkout = (id, date, credit = 1) => ({
  id, date, name: 'Push', notes: '', unit: 'lb',
  exercises: [{
    id: id + '-exercise', exerciseId: 'press', name: 'Push-up',
    equipment: 'Bodyweight', variation: '', loadMode: 'bodyweight',
    loadBasis: 'total', unilateral: false, credits: { Chest: credit, Triceps: 0.5 },
    sets: [
      { id: id + '-warmup', weight: 0, reps: 10, rir: null, warmup: true, done: true },
      { id: id + '-work', weight: 0, reps: 10, rir: 2, warmup: false, done: true }
    ]
  }]
})
test('muscle targets count fractional credits but exclude warmups', () => {
  const state = {
    library: [{ credits: { Chest: 1, Triceps: 0.5 } }],
    history: [makeWorkout('w1','2026-09-22'), makeWorkout('w2','2026-09-24',0.5)],
    settings: { defaultMuscleTarget: 3, weeklyWorkoutGoal: 3, muscleTargets: {} }
  }
  const rows = muscleRows(state, new Date('2026-09-25T12:00:00'))
  assert.equal(rows.find(r => r.muscle === 'Chest').total, 1.5)
  assert.equal(rows.find(r => r.muscle === 'Chest').target, 3)
  assert.equal(rows.find(r => r.muscle === 'Triceps').partial, 1)
})
test('consistency average excludes weeks before starting and excludes incomplete current week from goal score', () => {
  const history = [
    makeWorkout('a','2026-09-15'), makeWorkout('b','2026-09-16'),
    makeWorkout('c','2026-09-18'), makeWorkout('d','2026-09-22'),
    makeWorkout('e','2026-09-24')
  ]
  const stat = consistencyStats(history,new Date('2026-09-25T12:00:00'),3)
  assert.equal(stat.average,2.5)
  assert.equal(stat.goalWeeks,1)
  assert.equal(stat.completedWeeks,1)
  assert.equal(stat.currentWeekSessions,2)
})
test('no workouts yields a zero average without division by zero', () => {
  assert.equal(consistencyStats([],new Date('2026-09-25T12:00:00'),3).average,0)
})
