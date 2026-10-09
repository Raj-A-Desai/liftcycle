<script setup lang="ts">
import { computed, ref } from 'vue'
import { useLiftStore } from '../store'
import { dateKey, formatDate, shiftDay, weekFor } from '../rhythm'
import { buildWeeklyReviewInput } from '../weeklyReview'
const store=useLiftStore()
const today=dateKey(),currentStart=weekFor(today)[0]!
const week=ref(shiftDay(currentStart,-7))
const weeks=Array.from({length:12},(_,i)=>shiftDay(currentStart,-7*(i+1)))
const reviews=computed(()=>(store.state.reviews || []).slice().sort((a,b)=>b.weekStart.localeCompare(a.weekStart)))
const selected=ref('')
const review=computed(()=>reviews.value.find(r=>r.weekStart===selected.value) || reviews.value[0])
const input=ref<HTMLInputElement|null>(null)
const error=ref(''),notice=ref('')
function exportWeek() {
  error.value=''
  try {
    const payload=buildWeeklyReviewInput(store.state,week.value)
    const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}))
    const a=document.createElement('a');a.href=url;a.download=`homebase-review-input-${week.value}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
    notice.value='Completed-week data exported for your review workflow.'
  }catch(e:any){error.value=e.message}
}
async function importReview(event:Event) {
  const file=(event.target as HTMLInputElement).files?.[0];if(!file)return
  error.value='';notice.value=''
  try {
    if(file.size>100000)throw new Error('Choose a review file smaller than 100 KB.')
    const raw=JSON.parse(await file.text())
    if(store.state.reviews?.some(r=>r.weekStart===raw.weekStart) && !confirm('Replace the existing reflection for this week?'))return
    const saved=store.saveReview(raw);selected.value=saved.weekStart
    await store.pushCloud()
    notice.value=store.syncStatus==='synced'?'Reflection saved and synced.':'Reflection saved on this device. Check the sync status before switching devices.'
  }catch(e:any){error.value=e.message}
  ;(event.target as HTMLInputElement).value=''
}
</script>
<template>
  <section class="guide-page"><div class="module-heading"><div><div class="eyebrow">REFLECT → ADJUST</div><h1>Your Guide</h1><p>A thoughtful record of what worked, what got in the way, and what comes next.</p></div><button class="ghost" :disabled="store.syncStatus==='conflict'" @click="input?.click()">Import reflection</button></div><input ref="input" hidden type="file" accept="application/json" @change="importReview" />
    <p v-if="notice" class="success-note" role="status">{{ notice }}</p><p v-if="error" class="error-note" role="alert">{{ error }}</p>
    <div class="guide-layout"><aside class="guide-index"><div class="eyebrow">WEEKLY REFLECTIONS</div><button v-for="r in reviews" :key="r.weekStart" :class="{selected:review?.weekStart===r.weekStart}" @click="selected=r.weekStart"><strong>{{ formatDate(r.weekStart,{month:'short',day:'numeric'}) }} – {{ formatDate(r.weekEnd,{month:'short',day:'numeric',year:'numeric'}) }}</strong><small>{{ r.momentum }} · {{ r.nextWeekFocus }}</small></button><p v-if="!reviews.length" class="muted">Your first reflection will appear here after you import a completed-week review.</p></aside>
      <article v-if="review" class="guide-reflection"><div class="eyebrow">{{ formatDate(review.weekStart,{month:'long',day:'numeric'}) }} – {{ formatDate(review.weekEnd,{month:'long',day:'numeric',year:'numeric'}) }}</div><h2>{{ review.nextWeekFocus }}</h2><p class="guide-message">{{ review.message }}</p><section class="quiet-section"><h3>The week in view</h3><p>{{ review.recap }}</p></section><div class="reflection-pair"><section class="quiet-section"><h3>What worked</h3><ul v-if="review.wins.length"><li v-for="win in review.wins" :key="win">{{ win }}</li></ul><p v-else class="muted">No specific wins recorded.</p></section><section class="quiet-section"><h3>What got in the way</h3><ul v-if="review.friction.length"><li v-for="item in review.friction" :key="item">{{ item }}</li></ul><p v-else class="muted">No specific friction recorded.</p></section></div><section class="quiet-section"><h3>Training</h3><p>{{ review.trainingSummary }}</p><h3>Planning</h3><p>{{ review.planningConsistency }}</p><span class="reflection-state">Momentum · {{ review.momentum }}</span></section><section v-if="review.patterns.length" class="quiet-section"><h3>Worth noticing</h3><ul><li v-for="pattern in review.patterns" :key="pattern">{{ pattern }}</li></ul></section><section class="quiet-section"><h3>Next week</h3><ul><li v-for="item in review.recommendations" :key="item">{{ item }}</li></ul></section><small class="muted">Generated {{ new Date(review.generatedAt).toLocaleDateString() }} · Guidance never changes your schedule automatically.</small></article>
      <article v-else class="guide-empty"><div class="eyebrow">A LITTLE PERSPECTIVE</div><h2>Give the week a place to land.</h2><p>Save a grounded recap of your training, priorities, and planning. Over time, these reflections become a useful record of how your rhythm changes.</p><p class="muted">Weekly reviews are ready for an external AI workflow. Automatic generation is not connected yet.</p></article>
      <aside class="guide-workflow quiet-section"><div class="eyebrow">REVIEW A COMPLETED WEEK</div><h2>Bring the week together</h2><p>Export the saved observations, generate a structured reflection, then import it here.</p><label>Week beginning<select v-model="week"><option v-for="w in weeks" :key="w" :value="w">{{ formatDate(w,{month:'short',day:'numeric',year:'numeric'}) }}</option></select></label><button class="ghost" @click="exportWeek">Export review data</button><small class="muted">Includes workout setup, previous sessions, goals and planning observations.</small></aside>
    </div>
  </section>
</template>
