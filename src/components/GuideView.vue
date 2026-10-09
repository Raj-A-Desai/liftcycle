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
    <div class="guide-layout">
      <article v-if="review" class="guide-reflection"><div class="eyebrow">{{ review.weekStart===reviews[0]?.weekStart?'LATEST REFLECTION':'PREVIOUS REFLECTION' }} · {{ formatDate(review.weekStart,{month:'short',day:'numeric'}) }} – {{ formatDate(review.weekEnd,{month:'short',day:'numeric',year:'numeric'}) }}</div><section class="guide-takeaway"><h2>{{ review.weekStart===reviews[0]?.weekStart?"This week’s takeaway":"The week’s takeaway" }}</h2><p class="guide-message">{{ review.message }}</p><div class="guide-next"><span class="eyebrow">NEXT WEEK</span><h3>{{ review.nextWeekFocus }}</h3></div></section>
        <details class="reflection-details"><summary>The week in view</summary><p>{{ review.recap }}</p></details>
        <details v-if="review.wins.length" class="reflection-details"><summary>What worked</summary><ul><li v-for="win in review.wins" :key="win">{{ win }}</li></ul></details>
        <details v-if="review.friction.length" class="reflection-details"><summary>What got in the way</summary><ul><li v-for="item in review.friction" :key="item">{{ item }}</li></ul></details>
        <details class="reflection-details"><summary>Training & planning</summary><h3>Training</h3><p>{{ review.trainingSummary }}</p><h3>Planning</h3><p>{{ review.planningConsistency }}</p><p>Momentum · {{ review.momentum }}</p></details>
        <details v-if="review.patterns.length" class="reflection-details"><summary>Worth noticing</summary><ul><li v-for="pattern in review.patterns" :key="pattern">{{ pattern }}</li></ul></details>
        <details v-if="review.recommendations.length" class="reflection-details"><summary>Recommendations</summary><ul><li v-for="item in review.recommendations" :key="item">{{ item }}</li></ul></details>
        <small class="muted reflection-footnote">Generated {{ new Date(review.generatedAt).toLocaleDateString() }} · Guidance never changes your schedule automatically.</small>
      </article>
      <article v-else class="guide-empty"><div class="eyebrow">WEEKLY PERSPECTIVE</div><h2>Your first reflection belongs here.</h2><p>Import a completed-week reflection to see its takeaway and next focus. Automatic generation is not connected yet.</p><button class="primary" :disabled="store.syncStatus==='conflict'" @click="input?.click()">Import reflection</button></article>
      <aside class="guide-context"><section v-if="reviews.length>1" class="guide-index"><div class="eyebrow">PREVIOUS WEEKS</div><button v-if="review?.weekStart!==reviews[0]?.weekStart" @click="selected=''">Return to latest →</button><button v-for="r in reviews.filter(r=>r.weekStart!==reviews[0]?.weekStart)" :key="r.weekStart" :class="{selected:review?.weekStart===r.weekStart}" @click="selected=r.weekStart"><strong>{{ formatDate(r.weekStart,{month:'short',day:'numeric'}) }} – {{ formatDate(r.weekEnd,{month:'short',day:'numeric'}) }}</strong><small>{{ r.nextWeekFocus }}</small></button></section>
      <details class="guide-workflow quiet-section"><summary>Prepare a weekly reflection</summary><p>Export the saved observations for a structured review, then import the reflection.</p><label>Week beginning<select v-model="week"><option v-for="w in weeks" :key="w" :value="w">{{ formatDate(w,{month:'short',day:'numeric',year:'numeric'}) }}</option></select></label><button class="ghost" @click="exportWeek">Export review data</button><button class="ghost" :disabled="store.syncStatus==='conflict'" @click="input?.click()">Import reflection</button><small class="muted">Includes the completed week and recent history.</small></details></aside>
    </div>
  </section>
</template>
