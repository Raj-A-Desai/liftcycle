<script setup lang="ts">
import { computed } from 'vue'
import { useLiftStore } from '../store'
import { deriveMomentum } from '../planning'
const props = defineProps<{ anchor: string }>()
const store = useLiftStore()
const signal = computed(()=>deriveMomentum(store.state,props.anchor))
</script>
<template>
  <section class="quiet-section momentum-panel">
    <div class="eyebrow">MOMENTUM</div><h2 class="momentum-state">{{ signal.label }}</h2>
    <p>{{ signal.message }}</p><p class="momentum-comparison">{{ signal.comparison }}</p>
    <dl class="signal-list"><div><dt>Training</dt><dd>{{ signal.workouts }}<span> / {{ signal.plannedWorkouts || store.state.settings?.weeklyWorkoutGoal || 3 }} workouts</span></dd></div><div v-if="signal.goals.length"><dt>Priorities</dt><dd>{{ signal.goalsDone }}<span> / {{ signal.goals.length }} complete</span></dd></div><div v-if="signal.observed"><dt>Recorded follow-through</dt><dd>{{ signal.followed }}<span> / {{ signal.observed }} items</span></dd></div></dl>
    <small v-if="signal.recordedDays" class="muted">{{ signal.recordedDays }} days with planning observations. Unrecorded routines remain unknown.</small>
  </section>
</template>
