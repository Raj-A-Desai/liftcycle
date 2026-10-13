<script setup lang="ts">
import { computed } from 'vue'
import { useLiftStore } from '../store'
import type { LoggedExercise, Workout } from '../types'
import { previousSetReference } from '../setReference'
import { formatDate } from '../rhythm'
const props = defineProps<{ workout: Workout; exercise: LoggedExercise; index: number }>()
const store = useLiftStore()
const previous = computed(() => previousSetReference(store.state.history, props.workout, props.exercise, props.index))
</script>
<template>
  <span class="set-reference" :title="previous ? formatDate(previous.date,{month:'short',day:'numeric',year:'numeric'}) + ' · same setup' : 'No completed matching set recorded'">
    <span class="set-reference-label">Last</span>
    <template v-if="previous"><strong>{{ exercise.loadMode==='bodyweight' && previous.set.weight===0 ? 'BW' : `${previous.set.weight} ${workout.unit}` }} × {{ previous.set.reps }}</strong><span v-if="!previous.set.warmup && previous.set.rir != null"> · {{ previous.set.rir }} RIR</span><small>{{ formatDate(previous.date,{month:'short',day:'numeric'}) }}</small></template>
    <span v-else>—</span>
  </span>
</template>
