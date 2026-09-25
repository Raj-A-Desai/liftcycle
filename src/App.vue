<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useLiftStore } from './store'
import { cloudConfigured } from './supabase'
import type { Exercise, PlanItem } from './types'
import { MUSCLE_GROUPS, consistencyStats, muscleRows } from './metrics'

const store = useLiftStore()
const tab = ref<'schedule'|'cycle'|'exercises'|'history'|'progress'>('schedule')
const showExerciseForm = ref(false)
const editingExerciseId = ref<string | null>(null)
const authEmail = ref('')
const authSent = ref(false)
const authError = ref('')
const toastError = ref('')
const weekAnchor = ref(new Date())
const selectedDate = ref(`${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`)
const importInput = ref<HTMLInputElement | null>(null)

const muscles = [...MUSCLE_GROUPS]
const equipmentOptions = ['Dumbbells','Barbell','Kettlebell','Cable','Machine','Bodyweight','Resistance band','EZ bar','Smith machine','Other']

const exerciseForm = reactive({
  name: '', equipment: '', variation: '', loadMode: 'external' as Exercise['loadMode'], loadBasis: 'total' as Exercise['loadBasis'],
  unilateral: false, repMin: 6, repMax: 12, notes: '', credits: {} as Record<string, number>
})

function resetExerciseForm() {
  Object.assign(exerciseForm, { name:'', equipment:'', variation:'', loadMode:'external', loadBasis:'total', unilateral:false, repMin:6, repMax:12, notes:'', credits:{} })
  editingExerciseId.value = null
}

function submitExercise() {
  if (!exerciseForm.name.trim()) return
  const payload = JSON.parse(JSON.stringify(exerciseForm))
  if (editingExerciseId.value) store.updateExercise(editingExerciseId.value, payload)
  else store.addExercise(payload)
  resetExerciseForm(); showExerciseForm.value = false
}

function editExercise(ex: Exercise) {
  editingExerciseId.value = ex.id
  Object.assign(exerciseForm, JSON.parse(JSON.stringify(ex)))
  showExerciseForm.value = true
}

function setCredit(muscle: string, value: number) {
  if (value <= 0) delete exerciseForm.credits[muscle]
  else exerciseForm.credits[muscle] = value
}

function cycleItemExercise(item: PlanItem) { return store.state.library.find(e => e.id === item.exerciseId) }

function weekDates(anchor = weekAnchor.value) {
  const d = new Date(anchor); d.setHours(12,0,0,0); d.setDate(d.getDate() - d.getDay())
  return Array.from({length:7}, (_,i) => { const x = new Date(d); x.setDate(x.getDate()+i); return x })
}
function iso(d: Date) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
function fmtDay(d: Date) { return d.toLocaleDateString(undefined,{weekday:'short',day:'numeric'}) }
function moveWeek(n: number) { const d = new Date(weekAnchor.value); d.setDate(d.getDate()+n*7); weekAnchor.value = d }

function workoutForDate(date: string) { return store.state.history.find(w => w.date === date) }
function scheduledName(date: string) { return store.scheduledSplitForDate(date)?.name ?? 'Rest' }

function startFor(date: string) {
  selectedDate.value = date
  const split = store.scheduledSplitForDate(date)
  store.startWorkout(date, split?.id)
}

function addSet(exIndex: number) {
  const ex = store.state.draft?.exercises[exIndex]; if (!ex) return
  const last = ex.sets.at(-1)
  ex.sets.push({ id: crypto.randomUUID(), weight: last?.weight ?? 0, reps: last?.reps ?? 8, rir: null, warmup: false, done: false })
}

function addExerciseToDraft(exerciseId: string) {
  const draft = store.state.draft; const ex = store.state.library.find(e => e.id === exerciseId); if (!draft || !ex) return
  if (draft.exercises.some(e => e.exerciseId === exerciseId)) return
  const sug = store.suggestion(ex.id, ex.equipment)
  draft.exercises.push({
    id: crypto.randomUUID(), exerciseId: ex.id, name: ex.name, equipment: ex.equipment, variation: ex.variation,
    loadMode: ex.loadMode, loadBasis: ex.loadBasis, unilateral: ex.unilateral, credits: JSON.parse(JSON.stringify(ex.credits)),
    sets: [{ id: crypto.randomUUID(), weight: sug?.load ?? 0, reps: sug?.reps ?? ex.repMin, rir: null, warmup:false, done:false }]
  })
}

async function sendMagicLink() {
  authError.value=''
  try { await store.signIn(authEmail.value); authSent.value = true }
  catch (e:any) { authError.value = e?.message ?? 'Could not send sign-in link.' }
}

async function importJson(ev: Event) {
  const file = (ev.target as HTMLInputElement).files?.[0]; if (!file) return
  try {
    const raw = JSON.parse(await file.text())
    if (store.userId && !window.confirm('Import this backup and replace the cloud data for your account? Export your current data first if needed.')) return
    await store.importState(raw, true)
  } catch (e:any) { alert(e?.message ?? 'Could not import that file.') }
  ;(ev.target as HTMLInputElement).value = ''
}

const progressRows = computed(() => muscleRows(store.state, weekAnchor.value))
const atTarget = computed(() => progressRows.value.filter(r => r.total >= r.target).length)
const consistency = computed(() => consistencyStats(store.state.history, new Date(), store.state.settings?.weeklyWorkoutGoal ?? 3))
function setMuscleTarget(muscle: string, value: number) {
  store.state.settings ??= { weeklyWorkoutGoal: 3, defaultMuscleTarget: 3, muscleTargets: {} }
  store.state.settings.muscleTargets[muscle] = Math.max(0.25, value || 3)
}
function updateGoal(value: number) {
  store.state.settings ??= { weeklyWorkoutGoal: 3, defaultMuscleTarget: 3, muscleTargets: {} }
  store.state.settings.weeklyWorkoutGoal = Math.max(1, Math.min(7, Math.round(value || 3)))
}
async function signOut() { try { await store.signOut() } catch (e:any) { toastError.value=e?.message ?? 'Could not sign out.' } }

const activeCycleLabel = computed(() => store.activeCycle ? `${store.activeCycle.name} · ${store.activeCycle.weeks} weeks` : 'No active cycle')

onMounted(async () => { store.hydrateLocal(); await store.setSession() })
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <div>
        <div class="brand">Lift<span>Cycle</span></div>
        <div class="tagline">Progressive overload, without the spreadsheet</div>
      </div>
      <div class="account-cluster">
        <div class="sync-pill" :class="store.syncStatus">
          <span class="dot"></span>
          {{ store.userId ? store.syncStatus : 'Local only' }}
        </div>
        <button v-if="store.userId" class="ghost small" @click="signOut()">Sign out</button>
      </div>
    </header>

    <section v-if="cloudConfigured && !store.userId" class="cloud-card">
      <div>
        <strong>Sync LiftCycle across your devices</strong>
        <p>Your workouts still save locally. Sign in once on each device to keep the same data everywhere.</p>
      </div>
      <div v-if="!authSent" class="auth-row">
        <input v-model="authEmail" type="email" placeholder="you@example.com" @keyup.enter="sendMagicLink" />
        <button class="primary" @click="sendMagicLink">Email me a sign-in link</button>
      </div>
      <div v-else class="success-note">Check your email and open the LiftCycle sign-in link.</div>
      <div v-if="authError" class="error-note">{{ authError }}</div>
    </section>

    <section v-if="store.syncStatus==='conflict'" class="cloud-card">
      <div><strong>Sync conflict</strong><p>This device and the cloud both have changes. Export JSON before replacing either version.</p></div>
      <div class="auth-row"><button class="ghost" @click="store.exportState()">Export backup</button><button class="ghost" @click="store.useCloudVersion()">Keep cloud version</button><button class="primary" @click="store.useThisDevice()">Keep this device</button></div>
    </section>
    <div v-if="store.syncError || toastError" class="error-note">{{ store.syncError || toastError }}</div>
    <nav class="tabs">
      <button v-for="t in ['schedule','cycle','exercises','history','progress']" :key="t" :class="{active:tab===t}" @click="tab=t as any">{{ t[0].toUpperCase()+t.slice(1) }}</button>
    </nav>

    <main>
      <section v-if="tab==='schedule'" class="page">
        <div class="section-head">
          <div>
            <div class="eyebrow">TRAIN ON YOUR SCHEDULE</div>
            <h1>Your week</h1>
            <p>Apply a cycle to place Push, Pull, and Legs on your calendar. Empty days can be filled later.</p>
          </div>
          <div class="head-actions">
            <button class="ghost" @click="moveWeek(-1)">←</button>
            <button class="ghost" @click="weekAnchor=new Date()">Today</button>
            <button class="ghost" @click="moveWeek(1)">→</button>
          </div>
        </div>

        <div class="cycle-banner"><span>{{ activeCycleLabel }}</span><button class="text-btn" @click="tab='cycle'">Edit cycle</button></div>

        <div class="week-grid">
          <article v-for="d in weekDates()" :key="iso(d)" class="day-card" :class="{today:iso(d)===new Date().toISOString().slice(0,10)}">
            <div class="day-label">{{ fmtDay(d) }}</div>
            <div class="scheduled">{{ scheduledName(iso(d)) }}</div>
            <template v-if="workoutForDate(iso(d))">
              <div class="completed-badge">✓ Logged</div>
              <button class="ghost full" @click="store.editWorkout(workoutForDate(iso(d))!.id); tab='history'">View / edit</button>
            </template>
            <template v-else-if="scheduledName(iso(d))!=='Rest'">
              <button class="primary full" @click="startFor(iso(d))">Log workout</button>
            </template>
            <div v-else class="rest">Rest</div>
          </article>
        </div>

        <div class="quick-log">
          <input v-model="selectedDate" type="date" />
          <select @change="($event.target as HTMLSelectElement).value && store.startWorkout(selectedDate, ($event.target as HTMLSelectElement).value)">
            <option value="">Log another workout…</option>
            <option v-for="s in store.state.plan.splits" :key="s.id" :value="s.id">{{ s.name }}</option>
          </select>
        </div>
      </section>

      <section v-else-if="tab==='cycle'" class="page">
        <div class="section-head">
          <div><div class="eyebrow">BUILD YOUR PLAN</div><h1>{{ store.state.plan.name }}</h1><p>Choose your days and exercises, then apply your cycle. Incomplete Pull or Legs days are allowed.</p></div>
          <div class="head-actions"><button v-if="store.activeCycle" class="ghost" @click="store.updateActiveCycle()">Publish future update</button><button class="primary" @click="store.applyCycle()">Apply new cycle</button></div>
        </div>
        <div class="safety-banner"><strong>Future-only updates</strong><span>Publish a new plan version for upcoming sessions. Previous versions and logged workouts stay unchanged.</span></div>
        <div class="settings-row">
          <label>Start date <input v-model="store.state.plan.startDate" type="date" /></label>
          <label>Weeks <input v-model.number="store.state.plan.weeks" type="number" min="1" max="20" /></label>
          <label>Name <input v-model="store.state.plan.name" /></label>
        </div>
        <div class="weekday-builder">
          <label v-for="(d,i) in ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']" :key="d"><span>{{ d }}</span><select v-model="store.state.plan.days[i]"><option value="">Rest</option><option v-for="s in store.state.plan.splits" :key="s.id" :value="s.id">{{ s.name }}</option></select></label>
        </div>
        <div class="split-grid">
          <article v-for="split in store.state.plan.splits" :key="split.id" class="panel">
            <div class="panel-head"><div><h2>{{ split.name }}</h2><span>{{ split.items.length }} exercises</span></div></div>
            <div v-if="!split.items.length" class="empty-small">No movements yet. You can still apply this cycle and fill this day later.</div>
            <div v-for="item in split.items" :key="item.id" class="plan-item">
              <div><strong>{{ cycleItemExercise(item)?.name }}</strong><small>{{ item.equipment || cycleItemExercise(item)?.equipment || 'Choose equipment while logging' }}</small></div>
              <div class="plan-controls"><label>sets<input v-model.number="item.sets" type="number" min="1" /></label><label>reps<input v-model.number="item.reps" type="number" min="1" /></label><label>Equipment (optional)<select v-model="item.equipment"><option value="">Choose while logging</option><option v-for="eq in equipmentOptions" :key="eq" :value="eq">{{ eq }}</option></select></label></div>
            </div>
            <select class="full-select" @change="store.addPlanItem(split.id, ($event.target as HTMLSelectElement).value); ($event.target as HTMLSelectElement).value=''">
              <option value="">+ Add exercise</option><option v-for="e in store.state.library.filter(e=>!split.items.some(i=>i.exerciseId===e.id))" :key="e.id" :value="e.id">{{ e.name }}</option>
            </select>
          </article>
        </div>
      </section>

      <section v-else-if="tab==='exercises'" class="page">
        <div class="section-head"><div><div class="eyebrow">YOUR MOVEMENT LIBRARY</div><h1>Exercises</h1><p>Define how each exercise contributes to muscle-group volume. Sets, reps and load belong in the workout log—not here.</p></div><button class="primary" @click="resetExerciseForm(); showExerciseForm=true">Create exercise</button></div>
        <div v-if="showExerciseForm" class="panel form-panel">
          <div class="form-grid"><label>Name<input v-model="exerciseForm.name" /></label><label>Preferred equipment (optional)<input v-model="exerciseForm.equipment" placeholder="Choose while logging" list="equipment-list" /></label><label>Variation<input v-model="exerciseForm.variation" placeholder="Flat bench, neutral grip…" /></label><label>Rep range<div class="inline"><input v-model.number="exerciseForm.repMin" type="number" min="1" /><span>–</span><input v-model.number="exerciseForm.repMax" type="number" min="1" /></div></label><label>Load mode<select v-model="exerciseForm.loadMode"><option value="external">External load</option><option value="bodyweight">Bodyweight</option><option value="weighted">Weighted bodyweight</option></select></label><label>Load basis<select v-model="exerciseForm.loadBasis"><option value="total">Total</option><option value="per-hand">Per hand</option></select></label></div>
          <datalist id="equipment-list"><option v-for="eq in equipmentOptions" :key="eq" :value="eq" /></datalist>
          <h3>Muscle set credits</h3><p class="muted">Use 1.0 for a direct set, 0.5 or 0.25 for partial contribution.</p>
          <div class="credit-grid"><label v-for="m in muscles" :key="m"><span>{{ m }}</span><select :value="exerciseForm.credits[m]||0" @change="setCredit(m, Number(($event.target as HTMLSelectElement).value))"><option :value="0">—</option><option :value="1">1.0</option><option :value="0.75">0.75</option><option :value="0.5">0.5</option><option :value="0.25">0.25</option></select></label></div>
          <label>Notes<textarea v-model="exerciseForm.notes" rows="2"></textarea></label>
          <div class="modal-actions"><button class="ghost" @click="showExerciseForm=false; resetExerciseForm()">Cancel</button><button class="primary" @click="submitExercise">{{ editingExerciseId ? 'Save changes' : 'Create exercise' }}</button></div>
        </div>
        <div class="exercise-list">
          <article v-for="ex in store.state.library" :key="ex.id" class="exercise-card">
            <div><h3>{{ ex.name }}</h3><p>{{ [ex.equipment,ex.variation].filter(Boolean).join(' · ') }}</p><div class="chips"><span v-for="(v,m) in ex.credits" :key="m">{{ m }} ×{{ v }}</span></div></div>
            <div class="row-actions"><button class="ghost small" @click="editExercise(ex)">Edit</button><button class="danger small" @click="store.deleteExercise(ex.id)">Delete</button></div>
          </article>
          <div v-if="!store.state.library.length" class="empty">No seeded library. Create only the exercises you actually use.</div>
        </div>
      </section>

      <section v-else-if="tab==='history'" class="page">
        <div class="section-head"><div><div class="eyebrow">YOUR TRAINING RECORD</div><h1>History</h1><p>Edit dates, sets, load, reps, RIR, warmups and missed entries whenever you need.</p></div></div>
        <div class="history-list">
          <article v-for="w in [...store.state.history].sort((a,b)=>b.date.localeCompare(a.date))" :key="w.id" class="history-card">
            <div><strong>{{ w.name }}</strong><span>{{ w.date }}</span></div><div>{{ w.exercises.reduce((n,e)=>n+e.sets.filter(s=>s.done&&!s.warmup).length,0) }} work sets</div><div class="row-actions"><button class="ghost small" @click="store.editWorkout(w.id)">Edit</button><button class="danger small" @click="store.deleteWorkout(w.id)">Delete</button></div>
          </article>
          <div v-if="!store.state.history.length" class="empty">Your completed sessions will appear here.</div>
        </div>
      </section>

      <section v-else class="page">
        <div class="section-head"><div><div class="eyebrow">WEEKLY MUSCLE SETS</div><h1>Progress</h1><p>Warmups are excluded. Direct and partial set credits are tracked separately.</p></div><div class="head-actions"><button class="ghost" @click="moveWeek(-1)">←</button><button class="ghost" @click="weekAnchor=new Date()">This week</button><button class="ghost" @click="moveWeek(1)">→</button></div></div>
        <div class="progress-hero">
          <article class="metric-card muscle-metric">
            <div class="metric-top"><span class="metric-icon">◎</span><span class="metric-tag">WEEKLY PROGRESS</span></div>
            <div class="metric-label">Muscles at target</div>
            <div class="metric-number">{{ atTarget }}<span> / {{ progressRows.length }}</span></div>
            <div class="metric-description">Your muscles with at least their planned weekly sets.</div>
            <div class="metric-track"><div :style="{width: progressRows.length ? Math.min(100,atTarget/progressRows.length*100)+'%' : '0%'}"></div></div>
          </article>
          <article class="metric-card consistency-metric">
            <div class="metric-top"><span class="metric-icon">↗</span><span class="metric-tag">LAST FOUR WEEKS</span></div>
            <div class="metric-label">Workout consistency</div>
            <div class="metric-number">{{ consistency.average.toFixed(1) }}<span> / week</span></div>
            <div class="metric-description">{{ consistency.goalWeeks }} / {{ consistency.completedWeeks }} completed weeks met your workout goal.</div>
            <div class="goal-setting"><label>Weekly goal<select :value="store.state.settings?.weeklyWorkoutGoal ?? 3" @change="updateGoal(Number(($event.target as HTMLSelectElement).value))"><option v-for="n in 7" :key="n" :value="n">{{ n }} {{ n===1?'workout':'workouts' }}</option></select></label></div>
          </article>
        </div>
        <div class="volume-head"><div><div class="eyebrow">WEEKLY VOLUME</div><h2>Muscle targets</h2><p>Direct + partial credits count; warmup sets are excluded.</p></div><span class="target-caption">Default {{ store.state.settings?.defaultMuscleTarget ?? 3 }} sets / week</span></div>
        <div class="muscle-grid">
          <article v-for="row in progressRows" :key="row.muscle" class="muscle-card" :class="{hit:row.total>=row.target}">
            <div class="muscle-card-top"><strong>{{ row.muscle }}</strong><span class="target-status">{{ row.total>=row.target ? '✓ Target met' : Number((row.target-row.total).toFixed(2))+' to go' }}</span></div>
            <div class="muscle-numbers"><span>{{ Number(row.total.toFixed(2)) }}</span><small>/ {{ row.target }} sets</small></div>
            <div class="muscle-track"><div :style="{width: Math.min(100,row.target ? row.total/row.target*100 : 100)+'%'}"></div></div>
            <div class="muscle-card-footer"><span>{{ Number(row.direct.toFixed(2)) }} direct · {{ Number(row.partial.toFixed(2)) }} partial</span><label>Goal<input type="number" min="0.25" max="30" step="0.25" :value="row.target" @change="setMuscleTarget(row.muscle,Number(($event.target as HTMLInputElement).value))" /></label></div>
          </article>
          <div v-if="!progressRows.length" class="empty">Create exercises with muscle credits to set your weekly targets.</div>
        </div>
      </section>
    </main>

    <section v-if="store.state.draft" class="workout-drawer">
      <div class="drawer-card">
        <div class="drawer-head"><div><div class="eyebrow">LOG WORKOUT</div><input class="workout-title" v-model="store.state.draft.name" /><input v-model="store.state.draft.date" type="date" /></div><button class="ghost" @click="store.state.draft=null">Close</button></div>
        <article v-for="(ex,ei) in store.state.draft.exercises" :key="ex.id" class="log-exercise">
          <div class="log-ex-head"><div><h3>{{ ex.name }}</h3><div class="session-variation"><label>Equipment<input v-model="ex.equipment" list="equipment-list" placeholder="Choose equipment" /></label><label>Variation<input v-model="ex.variation" placeholder="Grip, bench angle…" /></label></div></div><span v-if="store.suggestion(ex.exerciseId, ex.equipment)" class="suggestion">{{ store.suggestion(ex.exerciseId, ex.equipment)?.label }}</span></div>
          <div class="set-head"><span>#</span><span>Weight</span><span>Reps</span><span>RIR</span><span>Warmup</span><span>Done</span></div>
          <div v-for="(s,si) in ex.sets" :key="s.id" class="set-row" :class="{done:s.done}"><span>{{ si+1 }}</span><input v-model.number="s.weight" type="number" step="0.5" /><input v-model.number="s.reps" type="number" min="0" /><input :value="s.rir ?? ''" @input="s.rir = ($event.target as HTMLInputElement).value === '' ? null : Number(($event.target as HTMLInputElement).value)" type="number" min="0" max="5" step="0.5" placeholder="—" :disabled="s.warmup" /><input v-model="s.warmup" type="checkbox" @change="s.warmup && (s.rir=null)" /><input v-model="s.done" type="checkbox" /></div>
          <button class="text-btn" @click="addSet(ei)">+ Add set</button>
        </article>
        <select class="full-select" @change="addExerciseToDraft(($event.target as HTMLSelectElement).value); ($event.target as HTMLSelectElement).value=''">
          <option value="">+ Add exercise to workout</option><option v-for="e in store.state.library.filter(e=>!store.state.draft!.exercises.some(x=>x.exerciseId===e.id))" :key="e.id" :value="e.id">{{ e.name }}</option>
        </select>
        <textarea v-model="store.state.draft.notes" placeholder="Workout notes" rows="2"></textarea>
        <div class="drawer-actions"><button class="ghost" @click="store.state.draft=null">Discard changes</button><button class="primary" @click="store.saveDraft()">Save workout</button></div>
      </div>
    </section>

    <footer>
      <div><strong>Data</strong><span>{{ store.userId ? 'Cloud sync + local cache' : 'Saved in this browser' }}</span></div>
      <div class="footer-actions"><input ref="importInput" hidden type="file" accept="application/json" @change="importJson" /><button class="ghost small" @click="importInput?.click()">Import JSON</button><button class="ghost small" @click="store.exportState()">Export JSON</button></div>
    </footer>
  </div>
</template>
