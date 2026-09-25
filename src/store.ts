import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import type { LiftCycleState, Exercise, Workout, Cycle, PlanItem, LoggedExercise } from './types'
import { supabase } from './supabase'

const LOCAL_KEY = 'liftcycle-state-v3'
const DIRTY_KEY = `${LOCAL_KEY}:unsynced`
const EMPTY: LiftCycleState = {
  schemaVersion: 3,
  unit: 'lb',
  library: [],
  plan: {
    name: 'Push / Pull / Legs',
    startDate: `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`, 
    weeks: 6,
    days: ['', 'push', '', 'pull', '', 'legs', ''],
    splits: [
      { id: 'push', name: 'Push', items: [] },
      { id: 'pull', name: 'Pull', items: [] },
      { id: 'legs', name: 'Legs', items: [] },
    ],
  },
  cycles: [],
  activeCycleId: null,
  history: [],
  draft: null,
  settings: { weeklyWorkoutGoal: 3, defaultMuscleTarget: 3, muscleTargets: {} },
}

const deepCopy = <T>(v: T): T => JSON.parse(JSON.stringify(v))
const uuid = () => crypto.randomUUID()

export const useLiftStore = defineStore('liftcycle', () => {
  const state = ref<LiftCycleState>(deepCopy(EMPTY))
  const hydrated = ref(false)
  const userId = ref<string | null>(null)
  const userEmail = ref<string | null>(null)
  const syncStatus = ref<'local'|'syncing'|'synced'|'offline'|'error'|'conflict'>('local')
  const lastCloudUpdatedAt = ref<string | null>(null)
  const syncError = ref('')
  let syncTimer: number | undefined
  let unsubscribeRealtime: (() => void) | null = null
  let cloudReady = false
  let applyingCloud = false
  let pushing = false
  let pushRequested = false
  let localRevision = 0

  const activeCycle = computed(() => state.value.cycles.find(c => c.id === state.value.activeCycleId) ?? null)

  function normalize(raw: any): LiftCycleState {
    const merged = { ...deepCopy(EMPTY), ...raw }
    merged.schemaVersion = 3
    merged.library = Array.isArray(raw?.library) ? raw.library : []
    merged.cycles = Array.isArray(raw?.cycles) ? raw.cycles : []
    merged.history = Array.isArray(raw?.history) ? raw.history : []
    merged.plan = raw?.plan ? raw.plan : deepCopy(EMPTY.plan)
    merged.plan.splits ??= deepCopy(EMPTY.plan.splits)
    merged.plan.days ??= ['', 'push', '', 'pull', '', 'legs', '']
    merged.settings = { weeklyWorkoutGoal: Math.max(1, Number(raw?.settings?.weeklyWorkoutGoal ?? 3)), defaultMuscleTarget: Math.max(0, Number(raw?.settings?.defaultMuscleTarget ?? 3)), muscleTargets: raw?.settings?.muscleTargets || {} }
    // Older exports stored target RIR in plans/cycles. Ignore those targets while
    // retaining all RIR readings in completed workout history and drafts.
    for (const plan of [merged.plan, ...merged.cycles]) {
      for (const split of plan.splits ?? []) {
        for (const item of split.items ?? []) delete item.rir
      }
    }
    return merged
  }

  function hydrateLocal() {
    const raw = localStorage.getItem(LOCAL_KEY)
    if (raw) {
      try { state.value = normalize(JSON.parse(raw)) } catch { state.value = deepCopy(EMPTY) }
    }
    hydrated.value = true
  }

  function persistLocal() {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(state.value))
  }

  function applyCloud(data: any, updatedAt: string) {
    applyingCloud = true
    try { state.value = normalize(data) } finally { applyingCloud = false }
    persistLocal()
    localStorage.removeItem(DIRTY_KEY)
    lastCloudUpdatedAt.value = updatedAt
    syncError.value = ''
    syncStatus.value = 'synced'
  }

  // A conflicting remote snapshot must never silently erase an offline workout.
  function showConflict() {
    window.clearTimeout(syncTimer)
    syncStatus.value = 'conflict'
    syncError.value = 'Another device has changes. Choose which version to keep or export a backup first.'
  }

  async function setSession() {
    if (!supabase) return
    const { data, error } = await supabase.auth.getSession()
    if (error) { syncError.value = error.message; syncStatus.value = 'error'; return }
    userId.value = data.session?.user.id ?? null
    userEmail.value = data.session?.user.email ?? null
    if (userId.value) await pullCloudOrSeed()
    subscribeRealtime()
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') return
      const nextId = session?.user.id ?? null
      if (nextId === userId.value) return
      window.clearTimeout(syncTimer)
      unsubscribeRealtime?.()
      cloudReady = false
      userId.value = nextId
      userEmail.value = session?.user.email ?? null
      lastCloudUpdatedAt.value = null
      if (nextId) {
        // Run outside the auth callback to avoid Supabase auth locking/deadlocks.
        window.setTimeout(() => { void pullCloudOrSeed().then(subscribeRealtime) }, 0)
      } else {
        syncStatus.value = 'local'
        syncError.value = ''
      }
    })
    window.addEventListener('online', () => {
      if (!userId.value) return
      if (!cloudReady) void pullCloudOrSeed()
      else if (localStorage.getItem(DIRTY_KEY) && syncStatus.value !== 'conflict') void pushCloud()
    })
    window.addEventListener('offline', () => { if (userId.value) syncStatus.value = 'offline' })
  }

  async function pullCloudOrSeed() {
    if (!supabase || !userId.value) return
    const owner = userId.value
    cloudReady = false
    syncStatus.value = 'syncing'
    const { data, error } = await supabase.from('user_app_state')
      .select('state, updated_at').eq('user_id', owner).maybeSingle()
    if (owner !== userId.value) return
    if (error) {
      syncError.value = error.message
      syncStatus.value = navigator.onLine ? 'error' : 'offline'
      return
    }
    if (data?.state) {
      if (localStorage.getItem(DIRTY_KEY) && data.updated_at !== lastCloudUpdatedAt.value) {
        cloudReady = true
        showConflict()
        return
      }
      applyCloud(data.state, data.updated_at)
      cloudReady = true
      return
    }
    lastCloudUpdatedAt.value = null
    cloudReady = true
    await pushCloud()
  }

  async function pushCloud() {
    if (!supabase || !userId.value || !cloudReady || syncStatus.value === 'conflict') return
    if (!navigator.onLine) { syncStatus.value = 'offline'; return }
    if (pushing) { pushRequested = true; return }
    pushing = true
    syncStatus.value = 'syncing'
    const owner = userId.value
    const revision = localRevision
    const snapshot = JSON.parse(JSON.stringify(state.value))
    const now = new Date().toISOString()
    const fields = { state: snapshot, schema_version: snapshot.schemaVersion, client_updated_at: now }
    try {
      if (lastCloudUpdatedAt.value) {
        const { data, error } = await supabase.from('user_app_state').update(fields)
          .eq('user_id', owner).eq('updated_at', lastCloudUpdatedAt.value)
          .select('updated_at').maybeSingle()
        if (owner !== userId.value) return
        if (error) throw error
        if (!data) { showConflict(); return }
        lastCloudUpdatedAt.value = data.updated_at
      } else {
        const { data, error } = await supabase.from('user_app_state').insert({ user_id: owner, ...fields })
          .select('updated_at').single()
        if (owner !== userId.value) return
        if (error?.code === '23505') { showConflict(); return }
        if (error) throw error
        lastCloudUpdatedAt.value = data.updated_at
      }
      syncError.value = ''
      if (revision === localRevision) {
        localStorage.removeItem(DIRTY_KEY)
        syncStatus.value = 'synced'
      } else {
        pushRequested = true
      }
    } catch (error: any) {
      syncError.value = error?.message ?? 'Could not sync. Data remains saved locally.'
      syncStatus.value = navigator.onLine ? 'error' : 'offline'
    } finally {
      pushing = false
      if (pushRequested && syncStatus.value !== 'conflict') {
        pushRequested = false
        window.clearTimeout(syncTimer)
        syncTimer = window.setTimeout(() => void pushCloud(), 400)
      }
    }
  }

  // Explicitly replacing an existing cloud snapshot is only exposed as a user action.
  async function useThisDevice() {
    if (!supabase || !userId.value || !navigator.onLine) return
    window.clearTimeout(syncTimer)
    syncStatus.value = 'syncing'
    const owner = userId.value
    const revision = localRevision
    const now = new Date().toISOString()
    const { data, error } = await supabase.from('user_app_state').upsert({
      user_id: owner, state: JSON.parse(JSON.stringify(state.value)),
      schema_version: state.value.schemaVersion, client_updated_at: now,
    }, { onConflict: 'user_id' }).select('updated_at').single()
    if (owner !== userId.value) return
    if (error) { syncStatus.value = 'error'; syncError.value = error.message; return }
    lastCloudUpdatedAt.value = data.updated_at
    syncError.value = ''
    if (revision === localRevision) localStorage.removeItem(DIRTY_KEY)
    cloudReady = true
    syncStatus.value = 'synced'
    if (revision !== localRevision) queueCloudSync()
  }

  async function useCloudVersion() {
    if (!supabase || !userId.value) return
    syncStatus.value = 'syncing'
    const { data, error } = await supabase.from('user_app_state')
      .select('state, updated_at').eq('user_id', userId.value).single()
    if (error) { syncStatus.value = 'error'; syncError.value = error.message; return }
    applyCloud(data.state, data.updated_at)
    cloudReady = true
  }

  function queueCloudSync() {
    persistLocal()
    localStorage.setItem(DIRTY_KEY, '1')
    if (!userId.value || !supabase || !cloudReady || syncStatus.value === 'conflict') return
    window.clearTimeout(syncTimer)
    syncTimer = window.setTimeout(() => void pushCloud(), 650)
  }

  function subscribeRealtime() {
    unsubscribeRealtime?.(); unsubscribeRealtime = null
    if (!supabase || !userId.value) return
    const owner = userId.value
    const channel = supabase.channel(`liftcycle:${owner}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_app_state', filter: `user_id=eq.${owner}` }, payload => {
        if (owner !== userId.value || pushing) return
        const record = payload.new as { updated_at?: string; state?: LiftCycleState }
        if (!record?.state || !record.updated_at || record.updated_at === lastCloudUpdatedAt.value) return
        if (localStorage.getItem(DIRTY_KEY)) { showConflict(); return }
        applyCloud(record.state, record.updated_at)
      }).subscribe()
    unsubscribeRealtime = () => { void supabase.removeChannel(channel) }
  }

  watch(state, () => {
    if (!hydrated.value || applyingCloud) return
    localRevision++
    queueCloudSync()
  }, { deep: true, flush: 'sync' })

  function addExercise(ex: Omit<Exercise,'id'|'increment'|'defaultLoad'|'targetSets'>) {
    state.value.library.push({ ...ex, id: uuid(), increment: 0, defaultLoad: 0, targetSets: 0 })
  }

  function updateExercise(id: string, patch: Partial<Exercise>) {
    const ex = state.value.library.find(e => e.id === id); if (ex) Object.assign(ex, patch)
  }

  function deleteExercise(id: string) {
    state.value.library = state.value.library.filter(e => e.id !== id)
    state.value.plan.splits.forEach(s => s.items = s.items.filter(i => i.exerciseId !== id))
  }

  function addPlanItem(splitId: string, exerciseId: string) {
    const split = state.value.plan.splits.find(s => s.id === splitId)
    const ex = state.value.library.find(e => e.id === exerciseId)
    if (!split || !ex || split.items.some(i => i.exerciseId === exerciseId)) return
    split.items.push({ id: uuid(), exerciseId, sets: 2, reps: ex.repMin || 6, load: 0 })
  }

  // Publish an immutable plan version; completed sessions and previous plan editions survive.
  function updateActiveCycle() {
    const previous = activeCycle.value
    if (!previous) return
    const today = new Date()
    const localToday = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`
    const effectiveFrom = state.value.plan.startDate > localToday ? state.value.plan.startDate : localToday
    const version: Cycle = {
      ...deepCopy(state.value.plan),
      id: uuid(),
      appliedAt: new Date().toISOString(),
      previousCycleId: previous.id,
      effectiveFrom,
    }
    state.value.cycles.push(version)
    state.value.activeCycleId = version.id
  }

  function applyCycle() {
    const cycle: Cycle = { ...deepCopy(state.value.plan), id: uuid(), appliedAt: new Date().toISOString() }
    state.value.cycles.push(cycle)
    state.value.activeCycleId = cycle.id
  }

  function scheduledSplitForDate(date: string) {
    let cycle = activeCycle.value
    while (cycle?.previousCycleId && date < (cycle.effectiveFrom || cycle.startDate)) {
      cycle = state.value.cycles.find(c => c.id === cycle!.previousCycleId) ?? null
    }
    if (!cycle) return null
    const start = new Date(cycle.startDate + 'T12:00:00')
    const d = new Date(date + 'T12:00:00')
    const diff = Math.floor((d.getTime() - start.getTime()) / 86400000)
    if (diff < 0 || diff >= cycle.weeks * 7) return null
    const splitId = cycle.days[((diff % 7) + 7) % 7]
    if (!splitId) return null
    return cycle.splits.find(s => s.id === splitId) ?? null
  }

  function suggestion(exerciseId: string, equipment?: string) {
    const ex = state.value.library.find(e => e.id === exerciseId)
    if (!ex) return null
    const past = [...state.value.history].sort((a,b) => a.date.localeCompare(b.date)).flatMap(w => w.exercises).filter(e => e.exerciseId === exerciseId)
    const matching = equipment ? past.filter(e => e.equipment.trim().toLowerCase() === equipment.trim().toLowerCase()) : past
    const last = matching.at(-1)
    if (!last) return { label: 'Start conservatively', reps: ex.repMin || 6, load: 0 }
    const work = last.sets.filter(s => s.done && !s.warmup)
    if (!work.length) return null
    const minReps = Math.min(...work.map(s => s.reps))
    const maxReps = Math.max(...work.map(s => s.reps))
    const load = work.at(-1)?.weight ?? 0
    const ratings = work.map(s => s.rir).filter((rir): rir is number => typeof rir === 'number' && Number.isFinite(rir))
    // Never assume an unlogged RIR means the athlete had two reps in reserve.
    if (ratings.length !== work.length) return { label: 'Repeat load; log RIR to refine progression', reps: maxReps, load }
    const minRir = Math.min(...ratings)
    if (maxReps >= (ex.repMax || 12) && minRir >= 2) return { label: 'Add a small amount of load', reps: ex.repMin || 6, load: load > 0 ? load + (state.value.unit === 'lb' ? 5 : 2.5) : 0 }
    if (minReps >= (ex.repMin || 6) && minRir >= 2) return { label: 'Add reps', reps: Math.min((ex.repMax || 12), maxReps + 1), load }
    if (minRir <= 1) return { label: 'Hold steady', reps: Math.max(ex.repMin || 6, minReps), load }
    return { label: 'Repeat and reassess', reps: maxReps, load }
  }

  function startWorkout(date: string, splitId?: string) {
    const split = splitId
      ? (activeCycle.value?.splits.find(s => s.id === splitId) ?? state.value.plan.splits.find(s => s.id === splitId))
      : scheduledSplitForDate(date)
    const workout: Workout = {
      id: uuid(), date, name: split?.name ?? 'Workout', notes: '', unit: state.value.unit,
      cycleId: activeCycle.value?.id, cycleName: activeCycle.value?.name,
      scheduledId: activeCycle.value ? `${activeCycle.value.id}:${date}` : undefined,
      exercises: (split?.items ?? []).map(item => {
        const ex = state.value.library.find(e => e.id === item.exerciseId)!
        const equipment = item.equipment ?? ex.equipment
        const sug = suggestion(ex.id, equipment)
        const logged: LoggedExercise = {
          id: uuid(), exerciseId: ex.id, name: ex.name, equipment, variation: ex.variation,
          loadMode: ex.loadMode, loadBasis: ex.loadBasis, unilateral: ex.unilateral, credits: deepCopy(ex.credits),
          sets: Array.from({ length: item.sets || 2 }, () => ({ id: uuid(), weight: sug?.load ?? item.load ?? 0, reps: sug?.reps ?? item.reps ?? ex.repMin, rir: null, warmup: false, done: false }))
        }
        return logged
      })
    }
    state.value.draft = workout
    return workout
  }

  function saveDraft() {
    if (!state.value.draft) return
    const i = state.value.history.findIndex(w => w.id === state.value.draft!.id)
    if (i >= 0) state.value.history[i] = deepCopy(state.value.draft)
    else state.value.history.push(deepCopy(state.value.draft))
    state.value.draft = null
  }

  function editWorkout(id: string) {
    const w = state.value.history.find(w => w.id === id)
    if (w) state.value.draft = deepCopy(w)
  }

  function deleteWorkout(id: string) { state.value.history = state.value.history.filter(w => w.id !== id) }

  function muscleTotalsForWeek(anchor: Date) {
    const start = new Date(anchor); start.setHours(0,0,0,0); start.setDate(start.getDate() - start.getDay())
    const end = new Date(start); end.setDate(end.getDate() + 7)
    const totals: Record<string,{direct:number;partial:number}> = {}
    state.value.history.forEach(w => {
      const d = new Date(w.date + 'T12:00:00')
      if (d < start || d >= end) return
      w.exercises.forEach(ex => ex.sets.filter(s => s.done && !s.warmup).forEach(() => {
        Object.entries(ex.credits || {}).forEach(([muscle, credit]) => {
          totals[muscle] ??= { direct: 0, partial: 0 }
          if (credit >= 1) totals[muscle].direct += credit
          else totals[muscle].partial += credit
        })
      }))
    })
    return totals
  }

  async function importState(raw: any, push = true) {
    if (!raw || raw.schemaVersion !== 3 || !Array.isArray(raw.library) || !Array.isArray(raw.history) || !raw.plan) {
      throw new Error('Not a LiftCycle schema-v3 export')
    }
    state.value = normalize(raw)
    persistLocal()
    if (push && userId.value) await useThisDevice()
  }

  function exportState() {
    const blob = new Blob([JSON.stringify(state.value, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `liftcycle-${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(url)
  }

  async function signIn(email: string) {
    if (!supabase) throw new Error('Cloud sync is not configured')
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } })
    if (error) throw error
  }

  async function signOut() {
    if (localStorage.getItem(DIRTY_KEY)) throw new Error('You have unsynced workout changes. Sync or export a backup before signing out.')
    if (supabase) {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    }
    applyingCloud = true
    try { state.value = deepCopy(EMPTY) } finally { applyingCloud = false }
    localStorage.removeItem(LOCAL_KEY)
  }

  return { state, hydrated, userId, userEmail, syncStatus, syncError, activeCycle, hydrateLocal, setSession, pullCloudOrSeed, pushCloud, useThisDevice, useCloudVersion, updateActiveCycle,
    addExercise, updateExercise, deleteExercise, addPlanItem, applyCycle, scheduledSplitForDate, suggestion, startWorkout, saveDraft, editWorkout, deleteWorkout,
    muscleTotalsForWeek, importState, exportState, signIn, signOut }
})
