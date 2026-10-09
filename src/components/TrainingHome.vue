<script setup lang="ts">
import { computed } from 'vue'
import { useLiftStore } from '../store'
import { dateKey, formatDate, shiftDay } from '../rhythm'
import { cycleOn, weekSignals } from '../planning'
import { actualExerciseSummary } from '../workoutSummary'
import { exerciseTrend } from '../workoutIntelligence'
const emit=defineEmits<{workout:[date:string,id?:string];manage:[];schedule:[];history:[]}>()
const store=useLiftStore(),today=dateKey()
const next=computed(()=>{
  if(store.state.draft)return {date:store.state.draft.date,name:store.state.draft.name,id:store.state.draft.id,resume:true}
  for(let n=0;n<28;n++){const date=shiftDay(today,n),split=store.scheduledSplitForDate(date);if(split&&!store.state.history.some(w=>w.date===date))return {date,name:split.name,id:undefined,resume:false}}
  return null
})
const week=computed(()=>weekSignals(store.state,today))
const cycle=computed(()=>cycleOn(store.state,next.value?.date || today))
const cycleWeek=computed(()=>cycle.value?Math.max(1,Math.floor((Date.parse((next.value?.date || today)+'T12:00:00Z')-Date.parse(cycle.value.startDate+'T12:00:00Z'))/604800000)+1):0)
const recent=computed(()=>store.state.history.filter(w=>w.date<=today&&w.status!=='skipped').sort((a,b)=>b.date.localeCompare(a.date))[0])
const lastSame=computed(()=>store.state.history.filter(w=>w.name===next.value?.name&&w.date<=(next.value?.date || today)&&w.id!==next.value?.id&&w.status!=='skipped').sort((a,b)=>b.date.localeCompare(a.date))[0])
const upcoming=computed(()=>Array.from({length:14},(_,i)=>shiftDay(today,i)).filter(date=>date!==next.value?.date&&!store.state.history.some(w=>w.date===date)&&store.scheduledSplitForDate(date)).slice(0,3))
const trends=computed(()=>(recent.value?.exercises || []).flatMap(e=>{const trend=exerciseTrend(store.state.history,e,recent.value!.unit,today);return trend?[{name:e.name,trend}]:[]}).slice(0,3))
function workSets(w:NonNullable<typeof recent.value>){return w.exercises.flatMap(e=>e.sets).filter(s=>s.done&&!s.warmup&&!s.skipped).length}
</script>
<template>
<section class="page train-page">
  <div class="section-head"><div><div class="eyebrow">TRAINING</div><h1>Your next session</h1></div></div>
  <div class="train-layout"><div class="train-primary">
    <section v-if="next" class="attention-area training-attention"><div class="eyebrow">{{ next.resume?'IN PROGRESS':next.date===today?'TODAY':'UP NEXT' }}</div><h2>{{ next.name }}</h2><p>{{ formatDate(next.date,{weekday:'long',month:'short',day:'numeric'}) }}<template v-if="cycle"> · Week {{ cycleWeek }} of {{ cycle.weeks }}</template></p><button class="primary" @click="emit('workout',next.date,next.id)">{{ next.resume?'Resume workout':'Start workout' }}</button></section>
    <section v-else class="attention-area"><div class="eyebrow">YOUR TRAINING</div><h2>{{ cycle?'Room to recover':'Choose your next session' }}</h2><p>{{ cycle?'No upcoming session in your current cycle.':'Set up your program to see the next workout here.' }}</p><button class="primary" @click="emit('manage')">{{ cycle?'Review program':'Set up program' }}</button></section>
    <section v-if="lastSame" class="quiet-section last-workout"><div class="eyebrow">LAST {{ lastSame.name.toUpperCase() }}</div><h2>{{ formatDate(lastSame.date,{weekday:'short',month:'short',day:'numeric'}) }}</h2><p>{{ lastSame.exercises.length }} exercises · {{ workSets(lastSame) }} working sets completed</p><details><summary>See last session</summary><div v-for="e in lastSame.exercises" :key="e.id" class="training-history-row"><strong>{{ e.name }}</strong><span>{{ actualExerciseSummary(e,lastSame.unit).work }}</span></div><button class="text-btn" @click="emit('workout',lastSame.date,lastSame.id)">View session →</button></details></section>
    <section v-if="recent && recent.id!==lastSame?.id" class="quiet-section"><div class="eyebrow">RECENT SESSION</div><h2>{{ recent.name }}</h2><p>{{ formatDate(recent.date,{month:'short',day:'numeric'}) }} · {{ workSets(recent) }} working sets</p><button class="text-btn" @click="emit('workout',recent.date,recent.id)">View session →</button></section>
  </div><aside class="train-context">
    <section class="quiet-section"><div class="eyebrow">THIS WEEK</div><h2>{{ week.workouts }} / {{ week.plannedWorkouts || store.state.settings?.weeklyWorkoutGoal || 3 }} sessions</h2><p>Completed workouts with recorded working sets.</p><button class="text-btn" @click="emit('schedule')">View training week →</button></section>
    <section v-if="upcoming.length" class="quiet-section"><div class="eyebrow">COMING UP</div><div v-for="date in upcoming" :key="date" class="training-history-row"><strong>{{ store.scheduledSplitForDate(date)?.name }}</strong><span>{{ formatDate(date,{weekday:'short',month:'short',day:'numeric'}) }}</span></div></section>
    <section v-if="trends.length" class="quiet-section"><div class="eyebrow">RECENT PROGRESSION</div><div v-for="t in trends" :key="t.name" class="training-trend"><strong>{{ t.name }}</strong><p>{{ t.trend }}</p></div><button class="text-btn" @click="emit('history')">Explore history →</button></section>
    <section v-if="cycle" class="quiet-section"><div class="eyebrow">CURRENT PROGRAM</div><h2>{{ cycle.name }}</h2><p>Week {{ cycleWeek }} of {{ cycle.weeks }}</p><button class="text-btn" @click="emit('manage')">Manage program →</button></section>
  </aside></div>
</section>
</template>
