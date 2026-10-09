<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useLiftStore } from '../store'
import { dayEntries, weekSignals } from '../planning'
import { carryGoalsForward, dateKey, formatDate, formatHour, hourNow, isDone, weekFor } from '../rhythm'
import MomentumPanel from './MomentumPanel.vue'
import PlanAdjustments from './PlanAdjustments.vue'
import IntentionCapture from './IntentionCapture.vue'
const emit = defineEmits<{ rhythm:[date:string]; workout:[date:string,id?:string]; guide:[]; training:[] }>()
const store=useLiftStore()
const clock=ref(new Date())
let timer:ReturnType<typeof setInterval>
onMounted(()=>{timer=setInterval(()=>{clock.value=new Date()},30000)})
onBeforeUnmount(()=>clearInterval(timer))
const today=computed(()=>dateKey(clock.value))
const hour=computed(()=>hourNow(clock.value))
const greeting=computed(()=>hour.value<12?'Good morning.':hour.value<17?'Good afternoon.':'Good evening.')
const entries=computed(()=>dayEntries(store.state,today.value))
const visibleEntries=computed(()=>entries.value.filter(e=>e.untimed || e.allDay || e.endAt>hour.value || isDone(store.state.rhythm!,today.value,e)).filter(e=>!isDone(store.state.rhythm!,today.value,e)).slice(0,6))
const earlier=computed(()=>entries.value.filter(e=>!e.untimed && !e.allDay && e.endAt<=hour.value && !isDone(store.state.rhythm!,today.value,e)).length)
const week=computed(()=>weekSignals(store.state,today.value))
const training=computed(()=>entries.value.find(e=>e.kind==='workout'))
const guide=computed(()=>(store.state.reviews || []).filter(r=>r.weekEnd<today.value).sort((a,b)=>b.weekStart.localeCompare(a.weekStart))[0])
const capture=ref<InstanceType<typeof IntentionCapture>|null>(null)
function toggleGoal(id?:string,text?:string) {
  const week=weekFor(today.value)[0]!
  const goals=carryGoalsForward(store.state.rhythm!.weeklyWins,week)
  const goal=goals.find(g=>id ? g.id===id : g.text===text)
  if(goal)goal.done=!goal.done
  store.state.rhythm!.weeklyWins[week]=goals
}
function toggleEntry(id: string) {
  const entry=entries.value.find(e=>e.id===id);if(!entry)return
  if(entry.kind==='intention'){const i=store.state.rhythm!.intentions?.find(i=>i.id===id);if(i)i.done=!i.done}
  else (store.state.rhythm!.daily[today.value] ||= {})[['read','walk'].includes(id)?id:`task-${id}`]=!isDone(store.state.rhythm!,today.value,entry)
}
</script>
<template>
  <section class="today-page">
    <div class="module-heading"><div><div class="eyebrow">{{ formatDate(today,{weekday:'long',month:'long',day:'numeric'}) }}</div><h1>{{ greeting }}</h1><p>Make room for what matters.</p></div><button class="ghost" @click="capture?.open(today)">+ Quick capture</button></div>
    <div class="today-layout">
      <div class="today-primary">
        <section v-if="store.state.draft" class="session-invitation"><div><div class="eyebrow">PICK UP WHERE YOU LEFT OFF</div><h2>{{ store.state.draft.name }}</h2><p>{{ store.state.draft.date }} · Your workout is saved as you go.</p></div><button class="primary" @click="emit('workout',store.state.draft.date,store.state.draft.id)">Resume workout</button></section>
        <section class="quiet-section today-agenda"><div class="section-title-row"><div><div class="eyebrow">TODAY</div><h2>Your next few steps</h2></div><button class="text-btn" @click="emit('rhythm',today)">Open day →</button></div>
          <article v-for="entry in visibleEntries" :key="entry.id+'-'+entry.at" class="today-entry" :class="entry.intent"><div class="today-time">{{ entry.untimed?'Open':entry.allDay?'All day':formatHour(entry.at) }}<small>{{ entry.intent==='fixed'?'Fixed':'Flexible' }}</small></div><div class="today-entry-copy"><strong>{{ entry.title }}</strong><p>{{ entry.detail }}</p></div><button v-if="entry.kind==='task'||entry.kind==='intention'" class="rhythm-check" :aria-label="'Complete '+entry.title" @click="toggleEntry(entry.id)"></button><button v-else-if="entry.kind==='workout'" class="text-btn" @click="emit('workout',today,entry.workout?.id)">{{ entry.status==='skipped'?'Restore':'Open' }}</button></article>
          <p v-if="!visibleEntries.length" class="muted">The scheduled day is winding down. Leave room to rest, or choose one small intention.</p>
          <button v-if="earlier" class="text-btn muted" @click="emit('rhythm',today)">{{ earlier }} earlier items · review the full day</button>
        </section>
        <section class="quiet-section focus-section"><div class="section-title-row"><div><div class="eyebrow">FOCUS</div><h2>Your weekly priorities</h2></div><span class="muted">{{ week.goalsDone }} / {{ week.goals.length }}</span></div><div v-for="goal in week.goals.slice(0,5)" :key="goal.id||goal.text" class="home-goal" :class="{done:goal.done}"><button class="rhythm-check" :class="{checked:goal.done}" :aria-pressed="goal.done" :aria-label="(goal.done?'Reopen ':'Complete ')+goal.text" @click="toggleGoal(goal.id,goal.text)">{{ goal.done?'✓':'' }}</button><span>{{ goal.text }}</span></div><button v-if="!week.goals.length" class="text-btn" @click="emit('rhythm',today)">Choose this week’s priorities →</button></section>
      </div>
      <aside class="today-context"><section class="quiet-section training-preview"><div class="eyebrow">TRAINING</div><h2>{{ training?.workout?.name || store.scheduledSplitForDate(today)?.name || 'Room to recover' }}</h2><p>{{ training ? training.status==='completed'?'Today’s session is saved.':training.status==='skipped'?'Today’s session was skipped.':'One session, one exercise at a time.' : 'No workout scheduled today.' }}</p><button class="text-btn" @click="training?emit('workout',today,training.workout?.id):emit('training')">{{ training?.status==='completed'?'View session':training?'Open workout →':'View training week →' }}</button></section><MomentumPanel :anchor="today" />
        <section v-if="guide" class="quiet-section guide-preview"><div class="eyebrow">FROM YOUR GUIDE · {{ formatDate(guide.weekEnd,{month:'short',day:'numeric'}) }}</div><h2>{{ guide.nextWeekFocus }}</h2><p>{{ guide.message }}</p><button class="text-btn" @click="emit('guide')">Read reflection →</button></section>
        <section v-else class="quiet-section"><div class="eyebrow">REFLECT</div><h2>A place to look back</h2><p>Your weekly reflections will connect training, priorities and the shape of your week.</p><button class="text-btn" @click="emit('guide')">Open Guide →</button></section>
      </aside>
      <div class="today-adjust"><PlanAdjustments :today="today" /></div>
    </div><IntentionCapture ref="capture" />
  </section>
</template>
