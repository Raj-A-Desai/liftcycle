export type MuscleCredits = Record<string, number>

export interface Exercise {
  id: string
  name: string
  equipment: string
  variation: string
  loadMode: 'external' | 'bodyweight' | 'weighted'
  loadBasis: 'total' | 'per-hand'
  unilateral: boolean
  repMin: number
  repMax: number
  targetSets: number
  increment: number
  defaultLoad: number
  notes: string
  credits: MuscleCredits
}

// Planned sets and reps are targets. RIR is recorded only when a set is performed.
export interface PlanItem { id: string; exerciseId: string; sets: number; reps: number; load: number }
export interface Split { id: string; name: string; items: PlanItem[] }
export interface Plan { name: string; startDate: string; weeks: number; days: string[]; splits: Split[] }
export interface Cycle extends Plan { id: string; appliedAt: string }
export interface LoggedSet { id: string; weight: number; reps: number; rir: number | null; warmup: boolean; done: boolean }
export interface LoggedExercise {
  id: string
  exerciseId: string
  name: string
  equipment: string
  variation: string
  loadMode: string
  loadBasis: string
  unilateral: boolean
  credits: MuscleCredits
  sets: LoggedSet[]
}
export interface Workout {
  id: string
  date: string
  name: string
  notes: string
  unit: string
  cycleId?: string
  cycleName?: string
  scheduledId?: string
  exercises: LoggedExercise[]
}
export interface LiftCycleState {
  schemaVersion: number
  unit: 'lb' | 'kg'
  library: Exercise[]
  plan: Plan
  cycles: Cycle[]
  activeCycleId: string | null
  history: Workout[]
  draft: Workout | null
}
