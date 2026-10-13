import { newId } from './id'
import { mergeCloudState } from './cloudMerge'
import { sessionSets } from './sessionTemplate'
import { activateWorkoutDraft, completeWorkout, findWorkoutDraft, resolveSkippedDraft } from './workoutDrafts'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import type { LiftCycleState, Exercise, Workout, Cycle, PlanItem, LoggedExercise } from './types'
import { supabase } from './supabase'
import { emptyRhythm, normalizeRhythm, dateKey } from './rhythm'
import { plannedSplit } from './planning'
import { progression } from './workoutIntelligence'
import { saveWeeklyReview, validateWeeklyReview } from './weeklyReview'

const LOCAL_KEY = 'liftcycle-state-v3'
const DIRTY_KEY = `${LOCAL_KEY}:unsynced`
const BASE_KEY = `${LOCAL_KEY}:cloud-base`
const EMPTY: LiftCycleState = {
  schemaVersion: 3,
  rhythm: emptyRhythm(),
  reviews: [], trainingMoves: [], dismissedSuggestions: [],
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
  pausedDrafts: [],
  settings: { weeklyWorkoutGoal: 3, defaultMuscleTarget: 3, muscleTargets: {} },
}

const deepCopy = <T>(v: T): T => JSON.parse(JSON.stringify(v))
const uuid = () => newId()

export const useLiftStore = defineStore('liftcycle', () => {
  const state = ref<LiftCycleState>(deepCopy(EMPTY))
  const hydrated = ref(false)
  const userId = ref<string | null>(null)
  const userEmail = ref<string | null>(null)
  const syncStatus = ref<'local'|'syncing'|'synced'|'offline'|'error'>('local')
  const lastCloudUpdatedAt = ref<string | null>(null)
  const syncError = ref('')
  let syncTimer: number | undefined
  let unsubscribeRealtime: (() => void) | null = null
  let cloudReady = false
  let applyingCloud = false
  let pushing = false
  let pushRequested = false
  let localRevision = 0
  let cloudBase: LiftCycleState | null = null
  let pulling: Promise<void> | null = null
  let lifecycleAttached = false

  const activeCycle = computed(() => state.value.cycles.find(c => c.id === state.value.activeCycleId) ?? null)

  function normalize(raw: any): LiftCycleState {
    const merged = { ...deepCopy(EMPTY), ...raw }
    merged.schemaVersion = 3
    merged.rhythm = normalizeRhythm(raw?.rhythm)
    merged.reviews = Array.isArray(raw?.reviews) ? raw.reviews.filter((r: unknown)=>{try {validateWeeklyReview(r);return true} catch {return false}}) : []
    merged.trainingMoves = Array.isArray(raw?.trainingMoves) ? raw.trainingMoves : []
    merged.dismissedSuggestions = Array.isArray(raw?.dismissedSuggestions) ? raw.dismissedSuggestions : []
    merged.library = Array.isArray(raw?.library) ? raw.library : []
    merged.cycles = Array.isArray(raw?.cycles) ? raw.cycles : []
    merged.history = Array.isArray(raw?.history) ? raw.history : []
    merged.pausedDrafts = Array.isArray(raw?.pausedDrafts) ? raw.pausedDrafts : []
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
    for (const workout of [...merged.history, ...merged.pausedDrafts, ...(merged.draft ? [merged.draft] : [])]) {
      workout.status = workout.status === 'skipped' ? 'skipped' : 'completed'
      workout.exercises ??= []
      for (const exercise of workout.exercises) {
        exercise.sets ??= []
        for (const set of exercise.sets) {
          set.skipped = Boolean(set.skipped)
          if (set.skipped) { set.done = false; set.rir = null }
        }
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

  function rememberCloud(data: LiftCycleState, updatedAt: string) {
    cloudBase = deepCopy(data)
    lastCloudUpdatedAt.value = updatedAt
    localStorage.setItem(BASE_KEY, JSON.stringify({ owner: userId.value, state: cloudBase, updatedAt }))
  }

  function restoreCloudBase() {
    cloudBase = null
    lastCloudUpdatedAt.value = null
    try {
      const saved = JSON.parse(localStorage.getItem(BASE_KEY) || 'null')
      if (saved?.owner === userId.value) {
        cloudBase = normalize(saved.state)
        lastCloudUpdatedAt.value = saved.updatedAt
      }
    } catch { /* First sync also supports older caches without a baseline. */ }
  }

  function applyCloud(data: any, updatedAt: string) {
    const remote = normalize(data)
    const dirty = Boolean(localStorage.getItem(DIRTY_KEY))
    if (dirty && !cloudBase) {
      // Automatic local recovery copy for upgrading caches created before merge sync.
      localStorage.setItem(`${LOCAL_KEY}:before-auto-merge`, JSON.stringify(state.value))
    }
    const merged = dirty ? normalize(mergeCloudState(cloudBase, state.value, remote)) : remote
    applyingCloud = true
    try { state.value = merged } finally { applyingCloud = false }
    rememberCloud(remote, updatedAt)
    persistLocal()
    syncError.value = ''
    if (JSON.stringify(merged) === JSON.stringify(remote)) {
      localStorage.removeItem(DIRTY_KEY)
      syncStatus.value = 'synced'
    } else {
      localStorage.setItem(DIRTY_KEY, '1')
      syncStatus.value = 'syncing'
    }
  }

  async function setSession() {
    if (!supabase) return
    const { data, error } = await supabase.auth.getSession()
    if (error) { syncError.value = error.message; syncStatus.value = 'error'; return }
    userId.value = data.session?.user.id ?? null
    userEmail.value = data.session?.user.email ?? null
    restoreCloudBase()
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
      restoreCloudBase()
      if (nextId) {
        // Run outside the auth callback to avoid Supabase auth locking/deadlocks.
        window.setTimeout(() => { void pullCloudOrSeed().then(subscribeRealtime) }, 0)
      } else {
        syncStatus.value = 'local'
        syncError.value = ''
      }
    })
    if (!lifecycleAttached) {
      lifecycleAttached = true
      const refresh = () => { if (userId.value && navigator.onLine) void pullCloudOrSeed() }
      window.addEventListener('online', refresh)
      window.addEventListener('focus', refresh)
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refresh() })
      window.addEventListener('offline', () => { if (userId.value) syncStatus.value = 'offline' })
      window.setInterval(() => { if (document.visibilityState === 'visible') refresh() }, 30000)
    }
  }

  async function pullCloudOrSeed() {
    if (pulling) return pulling
    if (pushing) { pushRequested = true; return }
    pulling = readCloud()
    try { await pulling } finally { pulling = null }
  }

  async function readCloud() {
    if (!supabase || !userId.value) return
    if (!navigator.onLine) { syncStatus.value = 'offline'; return }
    const owner = userId.value
    const { data, error } = await supabase.from('user_app_state')
      .select('state, updated_at').eq('user_id', owner).maybeSingle()
    if (owner !== userId.value) return
    if (error) {
      syncError.value = error.message
      syncStatus.value = navigator.onLine ? 'error' : 'offline'
      return
    }
    cloudReady = true
    if (data?.state && (!lastCloudUpdatedAt.value || data.updated_at >= lastCloudUpdatedAt.value)) applyCloud(data.state, data.updated_at)
    else if (!data?.state) { cloudBase = null; lastCloudUpdatedAt.value = null; localStorage.setItem(DIRTY_KEY, '1') }
    if (localStorage.getItem(DIRTY_KEY)) await pushCloud()
  }

  async function pushCloud() {
    if (!supabase || !userId.value || !cloudReady || !localStorage.getItem(DIRTY_KEY)) return
    if (!navigator.onLine) { syncStatus.value = 'offline'; return }
    if (pushing) { pushRequested = true; return }
    pushing = true
    syncStatus.value = 'syncing'
    const owner = userId.value
    try {
      for (let attempt = 0; attempt < 4; attempt++) {
        const revision = localRevision
        const snapshot = deepCopy(state.value)
        const now = new Date().toISOString()
        const fields = { state: snapshot, schema_version: snapshot.schemaVersion, client_updated_at: now }
        if (lastCloudUpdatedAt.value) {
          const { data, error } = await supabase.from('user_app_state').update(fields)
            .eq('user_id', owner).eq('updated_at', lastCloudUpdatedAt.value)
            .select('updated_at').maybeSingle()
          if (owner !== userId.value) return
          if (error) throw error
          if (!data) {
            const latest = await supabase.from('user_app_state').select('state, updated_at').eq('user_id', owner).single()
            if (owner !== userId.value) return
            if (latest.error) throw latest.error
            applyCloud(latest.data.state, latest.data.updated_at)
            continue
          }
          rememberCloud(snapshot, data.updated_at)
        } else {
          const { data, error } = await supabase.from('user_app_state').insert({ user_id: owner, ...fields })
            .select('updated_at').single()
          if (owner !== userId.value) return
          if (error?.code === '23505') {
            const latest = await supabase.from('user_app_state').select('state, updated_at').eq('user_id', owner).single()
            if (owner !== userId.value) return
            if (latest.error) throw latest.error
            applyCloud(latest.data.state, latest.data.updated_at)
            continue
          }
          if (error) throw error
          rememberCloud(snapshot, data.updated_at)
        }
        syncError.value = ''
        if (revision === localRevision) {
          localStorage.removeItem(DIRTY_KEY)
          syncStatus.value = 'synced'
        } else {
          pushRequested = true
        }
        return
      }
      pushRequested = true
    } catch (error: any) {
      syncError.value = error?.message ?? 'Could not sync. Data remains saved locally.'
      syncStatus.value = navigator.onLine ? 'error' : 'offline'
    } finally {
      pushing = false
      if (pushRequested && owner === userId.value) {
        pushRequested = false
        window.clearTimeout(syncTimer)
        syncTimer = window.setTimeout(() => void pushCloud(), 400)
      }
    }
  }

  // Import/account actions use the same merge-safe path as normal device edits.
  async function useThisDevice() {
    await pullCloudOrSeed()
  }

  function queueCloudSync() {
    persistLocal()
    localStorage.setItem(DIRTY_KEY, '1')
    if (!userId.value || !supabase || !cloudReady) return
    window.clearTimeout(syncTimer)
    syncTimer = window.setTimeout(() => void pushCloud(), 650)
  }

  function subscribeRealtime() {
    unsubscribeRealtime?.(); unsubscribeRealtime = null
    const client = supabase
    if (!client || !userId.value) return
    const owner = userId.value
    const channel = client.channel(`liftcycle:${owner}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_app_state', filter: `user_id=eq.${owner}` }, payload => {
        if (owner !== userId.value || pushing) return
        const record = payload.new as { updated_at?: string; state?: LiftCycleState }
        if (!record?.state || !record.updated_at || record.updated_at === lastCloudUpdatedAt.value) return
        if (lastCloudUpdatedAt.value && record.updated_at < lastCloudUpdatedAt.value) return
        applyCloud(record.state, record.updated_at)
        if (localStorage.getItem(DIRTY_KEY)) queueCloudSync()
      }).subscribe(status => {
        if (status === 'SUBSCRIBED' && owner === userId.value) void pullCloudOrSeed()
      })
    unsubscribeRealtime = () => { void client.removeChannel(channel) }
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
    const today = new Date()
    const localToday = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`
    const previous = activeCycle.value
    const cycle: Cycle = {
      ...deepCopy(state.value.plan),
      id: uuid(),
      appliedAt: new Date().toISOString(),
      ...(previous ? { previousCycleId: previous.id, effectiveFrom: state.value.plan.startDate > localToday ? state.value.plan.startDate : localToday } : {})
    }
    state.value.cycles.push(cycle)
    state.value.activeCycleId = cycle.id
  }

  function cycleForDate(date: string): Cycle | null {
    let cycle: Cycle | null = activeCycle.value
    while (cycle?.previousCycleId && date < (cycle.effectiveFrom || cycle.startDate)) {
      cycle = state.value.cycles.find(c => c.id === cycle!.previousCycleId) ?? null
    }
    return cycle
  }

  function scheduledSplitForDate(date: string) { return plannedSplit(state.value,date) }

  function suggestion(exerciseId: string, equipment?: string, variation?: string, date = dateKey(), excludeId?: string) {
    const ex = state.value.library.find(e => e.id === exerciseId)
    if (!ex) return null
    return progression(ex, state.value.history, {equipment:equipment ?? ex.equipment,variation:variation ?? ex.variation,loadMode:ex.loadMode,loadBasis:ex.loadBasis,unilateral:ex.unilateral}, state.value.unit, date, excludeId)
  }

  function saveReview(raw: unknown) { return saveWeeklyReview(state.value,raw) }

  function startWorkout(date: string, splitId?: string) {
    const split = splitId
      ? (cycleForDate(date)?.splits.find(s => s.id === splitId) ?? state.value.plan.splits.find(s => s.id === splitId))
      : scheduledSplitForDate(date)
    const existing = findWorkoutDraft(state.value, date, split)
    if (existing) return activateWorkoutDraft(state.value, existing)
    const sessionCycle = cycleForDate(date)
    const workout: Workout = {
      id: uuid(), date, splitId: split?.id, name: split?.name ?? 'Workout', notes: '', unit: state.value.unit, status: 'completed',
      cycleId: sessionCycle?.id, cycleName: sessionCycle?.name,
      scheduledId: sessionCycle ? `${sessionCycle.id}:${date}` : undefined,
      exercises: (split?.items ?? []).map(item => {
        const ex = state.value.library.find(e => e.id === item.exerciseId)!
        const equipment = item.equipment ?? ex.equipment
        const sug = suggestion(ex.id, equipment, ex.variation, date)
        const logged: LoggedExercise = {
          id: uuid(), exerciseId: ex.id, name: ex.name, equipment, variation: ex.variation,
          loadMode: ex.loadMode, loadBasis: ex.loadBasis, unilateral: ex.unilateral, credits: deepCopy(ex.credits),
          sets: []
        }
        logged.sets = sessionSets(state.value.history, logged, state.value.unit, date, item.sets || 2, sug?.load ?? item.load ?? 0, sug?.reps ?? item.reps ?? ex.repMin)
        return logged
      })
    }
    return activateWorkoutDraft(state.value, workout)
  }

  function skipWorkoutDraft(id: string) {
    resolveSkippedDraft(state.value, id)
  }

  function skipScheduledWorkout(date: string) {
    const draft = [state.value.draft, ...(state.value.pausedDrafts ?? [])].find(w => w?.date === date)
    if (draft) { skipWorkoutDraft(draft.id); return }
    if (state.value.history.some(w => w.date === date)) return
    const split = scheduledSplitForDate(date)
    if (!split) return
    const cycle = cycleForDate(date)
    state.value.history.push({
      id: uuid(), date, name: split.name, notes: '', unit: state.value.unit, status: 'skipped',
      cycleId: cycle?.id, cycleName: cycle?.name,
      scheduledId: cycle ? `${cycle.id}:${date}` : undefined,
      exercises: [],
    })
  }

  function resumeSkippedWorkout(id: string) {
    const skipped = state.value.history.find(w => w.id === id && w.status === 'skipped')
    if (!skipped) return null
    const date = skipped.date
    state.value.history = state.value.history.filter(w => w.id !== id)
    return startWorkout(date)
  }

  function saveDraft() {
    if (!state.value.draft) return
    completeWorkout(state.value.draft)
    const i = state.value.history.findIndex(w => w.id === state.value.draft!.id)
    if (i >= 0) state.value.history[i] = deepCopy(state.value.draft)
    else state.value.history.push(deepCopy(state.value.draft))
    state.value.draft = null
  }

  function editWorkout(id: string) {
    const w = [state.value.draft, ...(state.value.pausedDrafts ?? []), ...state.value.history].find(w => w?.id === id)
    if (w) activateWorkoutDraft(state.value, deepCopy(w))
  }

  function deleteWorkout(id: string) { state.value.history = state.value.history.filter(w => w.id !== id) }

  function muscleTotalsForWeek(anchor: Date) {
    const start = new Date(anchor); start.setHours(0,0,0,0); start.setDate(start.getDate() - start.getDay())
    const end = new Date(start); end.setDate(end.getDate() + 7)
    const totals: Record<string,{direct:number;partial:number}> = {}
    state.value.history.forEach(w => {
      const d = new Date(w.date + 'T12:00:00')
      if (d < start || d >= end || w.status === 'skipped') return
      w.exercises.forEach(ex => ex.sets.filter(s => s.done && !s.warmup && !s.skipped).forEach(() => {
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
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
        shouldCreateUser: false,
      },
    })
    if (error) throw error
  }

  async function signInWithPassword(email: string, password: string) {
    if (!supabase) throw new Error('Cloud sync is not configured')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async function setPassword(password: string) {
    if (!supabase || !userId.value) throw new Error('Sign in before setting a password.')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw error
  }

  async function signOut() {
    if (localStorage.getItem(DIRTY_KEY)) throw new Error('You have unsynced Homebase changes. Sync or export a backup before signing out.')
    if (supabase) {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    }
    applyingCloud = true
    try { state.value = deepCopy(EMPTY) } finally { applyingCloud = false }
    localStorage.removeItem(BASE_KEY)
    cloudBase = null
    localStorage.removeItem(LOCAL_KEY)
    localStorage.removeItem('homebase-rhythm-before-import')
  }

  return { state, hydrated, userId, userEmail, syncStatus, syncError, activeCycle, hydrateLocal, setSession, pullCloudOrSeed, pushCloud, useThisDevice, updateActiveCycle,
    addExercise, updateExercise, deleteExercise, addPlanItem, applyCycle, scheduledSplitForDate, suggestion, startWorkout, skipWorkoutDraft, skipScheduledWorkout, resumeSkippedWorkout, saveDraft, editWorkout, deleteWorkout,
    muscleTotalsForWeek, saveReview, importState, exportState, signIn, signInWithPassword, setPassword, signOut }
})
