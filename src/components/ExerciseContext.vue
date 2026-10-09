<script setup lang="ts">
import { computed } from 'vue'
import type { LoggedExercise, Workout } from '../types'
import { useLiftStore } from '../store'
import { exerciseHistory, progression, exerciseTrend } from '../workoutIntelligence'
import { actualExerciseSummary } from '../workoutSummary'
import { formatDate } from '../rhythm'
const props=defineProps<{ exercise:LoggedExercise; workout:Workout; historical?:boolean }>()
const store=useLiftStore()
const sessions=computed(()=>exerciseHistory(store.state.history,props.exercise,props.workout.date,props.workout.id))
const previous=computed(()=>sessions.value.find(s=>s.comparable && s.workout.unit===props.workout.unit && s.exercise.sets.some(x=>x.done&&!x.warmup&&!x.skipped)))
const suggestion=computed(()=>{const ex=store.state.library.find(e=>e.id===props.exercise.exerciseId);return ex && !props.historical ? progression(ex,store.state.history,props.exercise,props.workout.unit,props.workout.date,props.workout.id) : null})
const trend=computed(()=>exerciseTrend(store.state.history,props.exercise,props.workout.unit,props.workout.date,props.historical?undefined:props.workout.id))
function setLabel(weight:number,reps:number,unit:string) {return weight>0?`${weight} ${unit} × ${reps}`:`${reps} reps · bodyweight`}
</script>
<template>
  <div class="exercise-context">
    <div class="context-summary"><div class="last-performance"><span>Last comparable performance</span><template v-if="previous"><strong>{{ actualExerciseSummary(previous.exercise,previous.workout.unit).work }}</strong><small>{{ formatDate(previous.workout.date,{month:'short',day:'numeric'}) }} · {{ previous.exercise.equipment || 'Equipment not recorded' }}{{ previous.exercise.loadBasis==='per-hand'?' · per hand':'' }}{{ !previous.comparable?' · different setup':'' }}{{ previous.workout.unit!==workout.unit?' · different unit':'' }}</small></template><strong v-else>No comparable work sets recorded</strong></div><div v-if="suggestion" class="today-guidance"><span>Today’s suggestion</span><strong>{{ setLabel(suggestion.load,suggestion.reps,workout.unit) }}</strong><small>{{ suggestion.reason }}</small></div></div>
    <p v-if="trend" class="exercise-trend">{{ trend }}</p>
    <details v-if="sessions.length" class="exercise-history-details"><summary>Recent sessions <span>{{ Math.min(3,sessions.length) }}</span></summary><article v-for="session in sessions.slice(0,3)" :key="session.workout.id+'-'+session.exercise.id" class="past-session"><div class="section-title-row"><strong>{{ formatDate(session.workout.date,{month:'short',day:'numeric',year:'numeric'}) }}</strong><small class="muted">{{ session.comparable?'Same setup':'Different setup' }}</small></div><p>{{ [session.exercise.equipment,session.exercise.variation,session.exercise.loadBasis==='per-hand'?'per hand':''].filter(Boolean).join(' · ') || 'Setup not recorded' }}</p><p v-if="session.exercise.substitutedFrom">Substituted for {{ session.exercise.substitutedFrom }}</p><div v-for="set in session.exercise.sets" :key="set.id" class="past-set" :class="{warmup:set.warmup}"><span>{{ set.warmup?'Warmup':'Working' }}</span><strong>{{ setLabel(set.weight,set.reps,session.workout.unit) }}</strong><small>{{ set.skipped?'Skipped':!set.done?'Unfinished':set.warmup?'Completed':set.rir===null?'RIR not recorded':`RIR ${set.rir}` }}</small></div><p v-if="session.exercise.endedAt" class="muted">Remaining working sets intentionally ended.<template v-if="session.exercise.skipReason"> Reason: {{ session.exercise.skipReason }}</template></p><p v-if="session.exercise.notes">Exercise note · {{ session.exercise.notes }}</p><p v-if="session.workout.notes">Session note · {{ session.workout.notes }}</p></article></details>
  </div>
</template>
