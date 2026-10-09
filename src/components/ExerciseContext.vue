<script setup lang="ts">
import { computed } from 'vue'
import type { LoggedExercise, Workout } from '../types'
import { useLiftStore } from '../store'
import { exerciseHistory, progression } from '../workoutIntelligence'
import { actualExerciseSummary } from '../workoutSummary'
import { formatDate } from '../rhythm'
const props=defineProps<{ exercise:LoggedExercise; workout:Workout }>()
const store=useLiftStore()
const sessions=computed(()=>exerciseHistory(store.state.history,props.exercise,props.workout.date,props.workout.id).slice(0,3))
const previous=computed(()=>sessions.value.find(s=>s.comparable && s.workout.unit===props.workout.unit) || sessions.value[0])
const suggestion=computed(()=>{const ex=store.state.library.find(e=>e.id===props.exercise.exerciseId);return ex ? progression(ex,store.state.history,props.exercise,props.workout.unit,props.workout.date,props.workout.id) : null})
function setLabel(weight:number,reps:number,unit:string) {return weight>0?`${weight} ${unit} × ${reps}`:`${reps} reps · bodyweight`}
</script>
<template>
  <div class="exercise-context">
    <div class="context-summary"><div class="last-performance"><span>Previous performance</span><template v-if="previous"><strong>{{ actualExerciseSummary(previous.exercise,previous.workout.unit).work }}</strong><small>{{ formatDate(previous.workout.date,{month:'short',day:'numeric'}) }} · {{ previous.exercise.equipment || 'Equipment not recorded' }}{{ previous.exercise.loadBasis==='per-hand'?' · per hand':'' }}{{ !previous.comparable?' · different setup':'' }}{{ previous.workout.unit!==workout.unit?' · different unit':'' }}</small></template><strong v-else>No earlier session recorded</strong></div><div v-if="suggestion" class="today-guidance"><span>Today’s suggestion</span><strong>{{ setLabel(suggestion.load,suggestion.reps,workout.unit) }}</strong><small>{{ suggestion.label }}</small></div></div>
    <details v-if="sessions.length" class="exercise-history-details"><summary>Setup & recent sessions <span>{{ sessions.length }}</span></summary><article v-for="session in sessions" :key="session.workout.id+'-'+session.exercise.id" class="past-session"><div class="section-title-row"><strong>{{ formatDate(session.workout.date,{month:'short',day:'numeric',year:'numeric'}) }}</strong><small class="muted">{{ session.comparable?'Same setup':'Different setup' }}</small></div><p>{{ [session.exercise.equipment,session.exercise.variation,session.exercise.loadBasis==='per-hand'?'per hand':''].filter(Boolean).join(' · ') || 'Setup not recorded' }}</p><p v-if="session.exercise.substitutedFrom">Substituted for {{ session.exercise.substitutedFrom }}</p><div v-for="set in session.exercise.sets" :key="set.id" class="past-set" :class="{warmup:set.warmup}"><span>{{ set.warmup?'Warmup':'Working' }}</span><strong>{{ setLabel(set.weight,set.reps,session.workout.unit) }}</strong><small>{{ set.skipped?'Skipped':!set.done?'Unfinished':set.warmup?'Completed':set.rir===null?'RIR not recorded':`RIR ${set.rir}` }}</small></div><p v-if="session.exercise.endedAt" class="muted">Remaining working sets intentionally ended.</p><p v-if="session.exercise.notes">Exercise note · {{ session.exercise.notes }}</p><p v-if="session.workout.notes">Session note · {{ session.workout.notes }}</p></article></details>
  </div>
</template>
