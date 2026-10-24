<script setup lang="ts">
import { computed, ref, watch } from 'vue'

type BlockMode = 'superset' | 'circuit'
type LogEntry = { load: number; reps: number; rir: number | null; done: boolean }
const movementLibrary = [
  { id:'push-ups', name:'Push-ups', detail:'Chest · triceps', target:12 },
  { id:'squats', name:'Bodyweight squats', detail:'Quads · glutes', target:15 },
  { id:'mountain-climbers', name:'Mountain climbers', detail:'Core · conditioning', target:20 },
  { id:'reverse-lunges', name:'Reverse lunges', detail:'Legs · balance', target:10 },
  { id:'plank', name:'Plank shoulder taps', detail:'Core · shoulders', target:12 },
  { id:'calf-raises', name:'Calf raises', detail:'Calves', target:20 },
  { id:'incline-pushups', name:'Incline push-ups', detail:'Chest · triceps', target:12 },
  { id:'glute-bridges', name:'Glute bridges', detail:'Glutes', target:15 }
]
const mode = ref<BlockMode>('superset')
const name = ref('India bodyweight superset')
const selected = ref<string[]>(['push-ups','squats'])
const rounds = ref(3)
const restSeconds = ref(75)
const logs = ref<Record<number,LogEntry>>({})
const stepIndex = ref(0)
const resting = ref(false)
const complete = ref(false)
const letters = ['A','B','C','D','E']
const movement = (id: string) => movementLibrary.find(m => m.id === id)
const exercisesPerRound = computed(() => selected.value.length)
const totalSets = computed(() => rounds.value * exercisesPerRound.value)
const completedSets = computed(() => Object.values(logs.value).filter(x => x.done).length)
const currentRound = computed(() => Math.floor(stepIndex.value / Math.max(1, exercisesPerRound.value)) + 1)
const currentPosition = computed(() => stepIndex.value % Math.max(1, exercisesPerRound.value))
const currentMovement = computed(() => movement(selected.value[currentPosition.value] || ''))
const currentLog = computed(() => logs.value[stepIndex.value])
const nextMovement = computed(() => {
  const next = currentPosition.value + 1
  return next >= exercisesPerRound.value ? null : movement(selected.value[next] || '')
})
const completionPercent = computed(() => totalSets.value ? Math.round(100 * completedSets.value / totalSets.value) : 0)

function resetDemo() {
  const next: Record<number,LogEntry> = {}
  for (let r = 0; r < rounds.value; r++) {
    selected.value.forEach((id,j) => { next[r * selected.value.length + j] = { load:0, reps:movement(id)?.target ?? 10, rir:2, done:false } })
  }
  logs.value = next
  stepIndex.value = 0
  resting.value = false
  complete.value = false
}
function switchMode(next: BlockMode) {
  if (next === mode.value) return
  mode.value = next
  name.value = next === 'superset' ? 'India bodyweight superset' : 'India bodyweight circuit'
  selected.value = next === 'superset'
    ? ['push-ups','squats']
    : ['push-ups','squats','mountain-climbers']
  restSeconds.value = next === 'superset' ? 75 : 90
  resetDemo()
}
function selectMovement(index: number, id: string) {
  if (selected.value.some((x,i) => i !== index && x === id)) return
  selected.value = selected.value.map((v,i) => i === index ? id : v)
  resetDemo()
}
function addMovement() {
  if (mode.value !== 'circuit' || selected.value.length >= 5) return
  const available = movementLibrary.find(x => !selected.value.includes(x.id))
  if (available) { selected.value = [...selected.value, available.id]; resetDemo() }
}
function removeMovement(index: number) {
  if (mode.value !== 'circuit' || selected.value.length <= 3) return
  selected.value = selected.value.filter((_,i) => i !== index)
  resetDemo()
}
function setCurrent(field: 'reps' | 'load' | 'rir', value: string) {
  const record = logs.value[stepIndex.value]
  if (!record) return
  if (field === 'reps') record.reps = Math.max(0, Number(value) || 0)
  else if (field === 'load') record.load = Math.max(0, Number(value) || 0)
  else record.rir = value === '' ? null : Math.max(0, Number(value) || 0)
}
function logAndContinue() {
  const entry = logs.value[stepIndex.value]
  if (!entry) return
  entry.done = true
  if (stepIndex.value === totalSets.value-1) { complete.value=true;return }
  if ((stepIndex.value+1) % exercisesPerRound.value === 0) { resting.value=true;return }
  stepIndex.value++
}
function nextRound() {
  if (!resting.value) return
  resting.value=false
  stepIndex.value++
}
function goBack() {
  if (complete.value) complete.value=false
  else if (resting.value) resting.value=false
  else if (stepIndex.value > 0) stepIndex.value--
}
function jumpTo(round: number, position: number) {
  complete.value=false
  resting.value=false
  stepIndex.value=round * exercisesPerRound.value + position
}
watch(rounds,resetDemo)
resetDemo()
</script>

<template>
  <section class="page block-review">
    <div class="block-review-top">
      <div>
        <div class="eyebrow">LIFTCYCLE · DESIGN CONCEPT</div>
        <h1>Supersets & circuits</h1>
        <p>Group exercises into a sequence, log one set of each, then repeat. Designed for both your mesocycle and impromptu workouts.</p>
      </div>
      <div class="concept-flag">INTERACTIVE PREVIEW <span>Not saved to your workouts</span></div>
    </div>

    <div class="block-review-grid">
      <section class="block-design-panel">
        <div class="block-section-heading"><div><span class="block-step">01</span><h2>Build a block</h2></div><span class="block-subtle">Try changing the setup</span></div>
        <div class="block-mode-picker" role="group" aria-label="Block type">
          <button type="button" :class="{selected:mode==='superset'}" :aria-pressed="mode==='superset'" @click="switchMode('superset')">
            <strong>Superset</strong><small>2 exercises · alternate</small>
          </button>
          <button type="button" :class="{selected:mode==='circuit'}" :aria-pressed="mode==='circuit'" @click="switchMode('circuit')">
            <strong>Circuit</strong><small>3–5 exercises · rotate</small>
          </button>
        </div>
        <label class="block-field">Block name<input v-model="name" placeholder="Name this block" /></label>
        <div class="block-config">
          <label class="block-field">Rounds
            <select v-model.number="rounds">
              <option v-for="n in 5" :key="n" :value="n">{{ n }}</option>
            </select>
          </label>
          <label class="block-field">Rest after each round
            <select v-model.number="restSeconds">
              <option :value="0">No planned rest</option>
              <option :value="30">30 seconds</option>
              <option :value="45">45 seconds</option>
              <option :value="60">60 seconds</option>
              <option :value="75">75 seconds</option>
              <option :value="90">90 seconds</option>
              <option :value="120">2 minutes</option>
              <option :value="180">3 minutes</option>
            </select>
          </label>
        </div>
        <div class="block-movements-heading"><h3>Movements</h3><span>{{ selected.length }} in rotation</span></div>
        <div class="block-movements">
          <div v-for="(id,index) in selected" :key="index" class="block-movement-row">
            <span class="block-movement-number">A{{ index+1 }}</span>
            <div>
              <label :for="'block-movement-'+index">Exercise {{ index+1 }}</label>
              <select :id="'block-movement-'+index" :value="id" @change="selectMovement(index,($event.target as HTMLSelectElement).value)">
                <option v-for="candidate in movementLibrary" :key="candidate.id" :value="candidate.id" :disabled="selected.includes(candidate.id) && candidate.id!==id">{{ candidate.name }}</option>
              </select>
            </div>
            <button v-if="mode==='circuit' && selected.length>3" type="button" class="block-remove" :aria-label="'Remove exercise '+(index+1)" @click="removeMovement(index)">×</button>
          </div>
        </div>
        <button v-if="mode==='circuit' && selected.length<5" type="button" class="block-add-movement" @click="addMovement">+ Add movement</button>
        <p class="block-helper">Each movement keeps its own weight, reps, and RIR. Warmups stay outside the round sequence.</p>
      </section>

      <section class="block-demo-panel">
        <div class="block-section-heading"><div><span class="block-step">02</span><h2>Log it as you go</h2></div><button type="button" class="block-reset" @click="resetDemo">Reset demo ↺</button></div>
        <div class="block-demo-head">
          <div><span class="block-demo-eyebrow">{{ mode==='superset'?'SUPERSET A':'CIRCUIT A' }}</span><h3>{{ name || 'Untitled block' }}</h3></div>
          <span class="block-demo-count">{{ completedSets }} / {{ totalSets }} sets</span>
        </div>
        <div class="block-progress-track"><span :style="{width:completionPercent+'%'}"></span></div>
        <div class="block-round-overview" aria-label="Round progress">
          <div v-for="r in rounds" :key="r" class="block-round-row">
            <span>Round {{ r }}</span>
            <div class="block-round-dots">
              <button v-for="(_,j) in selected" :key="j" type="button"
                :class="{done:logs[(r-1)*selected.length+j]?.done,current:!complete&&!resting&&stepIndex===(r-1)*selected.length+j}"
                :aria-label="'Round '+r+', exercise '+(j+1)+(logs[(r-1)*selected.length+j]?.done?' complete':' pending')"
                @click="jumpTo(r-1,j)">{{ letters[j] }}{{ j+1 }}</button>
            </div>
          </div>
        </div>
        <div v-if="complete" class="block-current block-finished">
          <span class="block-demo-eyebrow">ALL ROUNDS COMPLETED</span>
          <h3>Block complete</h3>
          <p>{{ completedSets }} sets logged across {{ selected.length }} exercises. In the finished feature, these results would appear under your regular workout history.</p>
          <button type="button" class="primary" @click="resetDemo">Try another run</button>
        </div>
        <div v-else-if="resting" class="block-current block-resting">
          <span class="block-demo-eyebrow">ROUND {{ currentRound }} COMPLETE</span>
          <div class="block-rest-icon">◷</div>
          <h3>{{ restSeconds ? 'Rest '+restSeconds+' seconds' : 'Ready for the next round?' }}</h3>
          <p>All {{ selected.length }} movements finished. Take your rest after the whole round, not between each movement.</p>
          <button type="button" class="primary" @click="nextRound">Start round {{ currentRound+1 }} →</button>
          <button type="button" class="block-text-action" @click="goBack">Back to last movement</button>
        </div>
        <div v-else class="block-current">
          <div class="block-current-heading"><span class="block-demo-eyebrow">ROUND {{ currentRound }} OF {{ rounds }}</span><span class="block-current-position">A{{ currentPosition+1 }}</span></div>
          <h3>{{ currentMovement?.name }}</h3>
          <p class="block-movement-detail">{{ currentMovement?.detail }} <span>· target {{ currentMovement?.target }} reps</span></p>
          <div class="block-log-fields">
            <label>Load <small>lb</small><input type="number" min="0" step="0.5" inputmode="decimal" :value="currentLog?.load??0" @input="setCurrent('load',($event.target as HTMLInputElement).value)" /></label>
            <label>Reps<input type="number" min="0" inputmode="numeric" :value="currentLog?.reps??0" @input="setCurrent('reps',($event.target as HTMLInputElement).value)" /></label>
            <label>RIR<input type="number" min="0" max="5" step="0.5" inputmode="decimal" :value="currentLog?.rir??''" @input="setCurrent('rir',($event.target as HTMLInputElement).value)" /></label>
          </div>
          <button type="button" class="primary block-log-next" @click="logAndContinue">{{ currentLog?.done?'Update & continue':'Log set & continue' }} <span>→</span></button>
          <div class="block-next-up">{{ nextMovement ? 'NEXT · A'+(currentPosition+2)+' '+nextMovement.name : currentRound===rounds ? 'LAST MOVEMENT · FINISH BLOCK' : 'NEXT · REST AFTER THIS ROUND' }}</div>
          <button v-if="stepIndex>0" type="button" class="block-text-action" @click="goBack">← Previous movement</button>
        </div>
      </section>
    </div>

    <div class="block-review-notes">
      <div><span class="block-step">03</span><h2>How it fits Homebase</h2></div>
      <div class="block-note-grid">
        <article><strong>In any workout</strong><p>Combine existing or new exercises in a freeform workout or your programmed PPL sessions.</p></article>
        <article><strong>Separate exercise history</strong><p>Track every movement's actual sets independently; the block simply controls order and round progress.</p></article>
        <article><strong>Non-destructive</strong><p>Leave ordinary sets alone. Ungroup exercises without deleting logs, and let a round finish early if needed.</p></article>
      </div>
      <p class="block-preview-disclaimer">This is a design-only prototype. Its sample exercises, numbers, and interactions do not modify your Homebase data. Rest is a cue, not an active timer in this preview.</p>
    </div>
  </section>
</template>

<style scoped>
.block-review { --block-accent:var(--brand-orange); padding-bottom:50px; }
.block-review-top { display:flex; justify-content:space-between; gap:25px; align-items:flex-end; margin-bottom:34px; }
.block-review-top h1 {font-size:clamp(32px,4vw,54px);margin:9px 0 12px;}
.block-review-top p {color:var(--text-muted);line-height:1.7;max-width:700px;margin:0;}
.concept-flag {color:var(--block-accent);font-size:11px;letter-spacing:.09em;font-weight:700;white-space:nowrap;text-align:right;}
.concept-flag span {display:block;color:var(--text-muted);font-size:11px;letter-spacing:0;font-weight:400;margin-top:6px;}
.block-review-grid {display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.07fr);gap:clamp(20px,3vw,54px);align-items:start;}
.block-design-panel,.block-demo-panel {border-top:1px solid var(--divider-subtle);padding:20px 0 26px;min-width:0;}
.block-section-heading {display:flex;justify-content:space-between;align-items:center;gap:20px;margin-bottom:23px;}
.block-section-heading>div{display:flex;align-items:center;gap:12px;}
.block-section-heading h2 {font-size:20px;margin:0;}
.block-step {font-size:12px;color:var(--block-accent);font-weight:650;}
.block-subtle,.block-helper {color:var(--text-muted);font-size:12px;line-height:1.6;}
.block-mode-picker {display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-bottom:22px;}
.block-mode-picker button {border:1px solid var(--divider-subtle);border-radius:14px;background:transparent;color:var(--text);min-height:86px;text-align:left;padding:16px;cursor:pointer;}
.block-mode-picker button.selected {background:var(--planner-selected);border-color:var(--block-accent);}
.block-mode-picker strong,.block-mode-picker small {display:block;}
.block-mode-picker strong {font-weight:600;font-size:16px;}
.block-mode-picker small {color:var(--text-muted);font-size:12px;margin-top:7px;line-height:1.4;}
.block-field {display:grid;gap:9px;color:var(--text-muted);font-size:12px;margin-bottom:20px;}
.block-field input,.block-field select,.block-movement-row select {width:100%;min-width:0;min-height:46px;border:1px solid var(--divider-subtle);border-radius:10px;background:var(--surface-low);color:var(--text);padding:9px 12px;font-size:15px;}
.block-config {display:grid;grid-template-columns:1fr 1fr;gap:15px;}
.block-movements-heading {display:flex;justify-content:space-between;gap:10px;align-items:baseline;margin-top:6px;margin-bottom:10px;}
.block-movements-heading h3 {font-size:15px;margin:0;}
.block-movements-heading span {color:var(--text-muted);font-size:12px;}
.block-movements {display:grid;gap:4px;}
.block-movement-row {display:grid;grid-template-columns:40px minmax(0,1fr) 30px;gap:12px;align-items:center;padding:10px 0;border-bottom:1px solid var(--divider-subtle);}
.block-movement-number {border-radius:10px;display:grid;place-items:center;background:var(--planner-selected);min-height:40px;color:var(--block-accent);font-weight:700;}
.block-movement-row label {font-size:11px;color:var(--text-muted);display:block;margin-bottom:6px;}
.block-remove,.block-add-movement,.block-reset,.block-text-action {border:0;background:transparent;color:var(--brand-lavender);cursor:pointer;}
.block-remove {font-size:24px;min-height:44px;}
.block-add-movement {font-size:14px;text-align:left;min-height:44px;}
.block-helper {margin-top:18px;}
.block-reset {font-size:13px;white-space:nowrap;}
.block-demo-head {display:flex;justify-content:space-between;gap:12px;align-items:center;}
.block-demo-eyebrow {color:var(--block-accent);font-size:11px;letter-spacing:.085em;font-weight:750;}
.block-demo-head h3 {font-size:21px;margin:7px 0 0;}
.block-demo-count {font-size:12px;color:var(--text-muted);white-space:nowrap;}
.block-progress-track {height:5px;background:var(--surface-hover);border-radius:8px;overflow:hidden;margin:19px 0;}
.block-progress-track span {display:block;height:100%;background:var(--block-accent);border-radius:8px;transition:width .3s ease;}
.block-round-overview {display:grid;gap:9px;margin-bottom:25px;}
.block-round-row {display:grid;grid-template-columns:74px minmax(0,1fr);align-items:center;gap:9px;}
.block-round-row>span {color:var(--text-muted);font-size:12px;}
.block-round-dots {display:flex;flex-wrap:wrap;gap:7px;}
.block-round-dots button {border:1px solid var(--divider-subtle);border-radius:8px;background:var(--surface-low);color:var(--text-muted);min-width:47px;min-height:35px;padding:4px 8px;font-size:12px;cursor:pointer;}
.block-round-dots button.done {background:var(--planner-selected);color:var(--brand-lavender);border-color:var(--brand-lavender);}
.block-round-dots button.current {outline:2px solid var(--block-accent);outline-offset:1px;color:var(--text);}
.block-current {background:color-mix(in srgb,var(--planner-selected) 42%,var(--surface-low));border:1px solid var(--divider-subtle);border-radius:18px;padding:25px;}
.block-current-heading {display:flex;align-items:center;justify-content:space-between;}
.block-current-position {font-size:13px;color:var(--block-accent);}
.block-current h3 {font-size:clamp(24px,3vw,34px);margin:12px 0;}
.block-movement-detail {font-size:13px;color:var(--text-muted);}
.block-movement-detail span {color:var(--brand-lavender);}
.block-log-fields {display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:25px 0;}
.block-log-fields label {font-size:12px;color:var(--text-muted);display:grid;gap:8px;}
.block-log-fields small {display:inline;font-size:10px;}
.block-log-fields input {width:100%;min-width:0;min-height:54px;border:1px solid var(--divider-subtle);border-radius:10px;background:var(--surface-low);color:var(--text);font-size:20px;padding:10px;}
.block-log-next {width:100%;min-height:49px;display:flex;align-items:center;justify-content:space-between;gap:10px;}
.block-next-up {color:var(--text-muted);font-size:11px;letter-spacing:.04em;margin:16px 0;text-transform:uppercase;}
.block-text-action {display:block;min-height:38px;font-size:13px;padding:6px 0;text-align:left;}
.block-resting,.block-finished {text-align:center;min-height:280px;}
.block-rest-icon {font-size:42px;color:var(--block-accent);margin:12px;}
.block-resting p,.block-finished p {color:var(--text-muted);line-height:1.6;font-size:13px;}
.block-resting .primary,.block-finished .primary {margin:20px auto 8px;}
.block-resting .block-text-action {margin:0 auto;}
.block-review-notes {border-top:1px solid var(--divider-subtle);margin-top:30px;padding-top:25px;}
.block-review-notes>div:first-child {display:flex;align-items:center;gap:12px;}
.block-review-notes h2 {font-size:20px;margin:0;}
.block-note-grid {display:grid;grid-template-columns:repeat(3,1fr);gap:28px;margin-top:23px;}
.block-note-grid strong {font-size:14px;}
.block-note-grid p {font-size:12px;line-height:1.7;color:var(--text-muted);}
.block-preview-disclaimer {border-top:1px solid var(--divider-subtle);margin-top:20px;padding-top:16px;color:var(--text-muted);font-size:12px;line-height:1.6;}
@media(max-width:1000px) {.block-review-grid {grid-template-columns:1fr;gap:24px;}.block-review-top {align-items:flex-start;}}
@media(max-width:600px) {
 .block-review-top {display:block;margin-bottom:18px;}
 .concept-flag {margin-top:15px;text-align:left;}
 .block-design-panel,.block-demo-panel {padding-top:15px;}
 .block-section-heading {margin-bottom:16px;}
 .block-section-heading h2 {font-size:18px;}
 .block-mode-picker button {padding:13px;min-height:76px;}
 .block-mode-picker strong {font-size:14px;}
 .block-config {gap:9px;}
 .block-movement-row {gap:9px;grid-template-columns:38px minmax(0,1fr) 28px;}
 .block-current {padding:18px;}
 .block-log-fields {gap:8px;}
 .block-log-fields input {font-size:16px;padding:8px;}
 .block-note-grid {grid-template-columns:1fr;gap:9px;}
}
@media(prefers-reduced-motion:reduce) {.block-progress-track span {transition:none;}}
</style>
