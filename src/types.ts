import type { RhythmState } from './rhythm'
import type { WeeklyReview } from './weeklyReview'
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
export interface PlanItem { id: string; exerciseId: string; sets: number; reps: number; load: number; equipment?: string }
export interface Split { id: string; name: string; items: PlanItem[] }
export interface Plan { name: string; startDate: string; weeks: number; days: string[]; splits: Split[] }
export interface Cycle extends Plan { id: string; appliedAt: string; effectiveFrom?: string; previousCycleId?: string }
export interface LoggedSet { id: string; weight: number; reps: number; rir: number | null; warmup: boolean; done: boolean; skipped?: boolean }
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
  notes?: string
  substitutedFrom?: string
  endedAt?: string
  sets: LoggedSet[]
}
export interface Workout {
  id: string
  date: string
  name: string
  notes: string
  unit: string
  status?: 'completed' | 'skipped'
  cycleId?: string
  cycleName?: string
  scheduledId?: string
  exercises: LoggedExercise[]
}
export interface LiftCycleState {
  rhythm?: RhythmState
  reviews?: WeeklyReview[]
  trainingMoves?: TrainingMove[]
  dismissedSuggestions?: string[]
  schemaVersion: number
  unit: 'lb' | 'kg'
  library: Exercise[]
  plan: Plan
  cycles: Cycle[]
  activeCycleId: string | null
  history: Workout[]
  draft: Workout | null
  settings?: { weeklyWorkoutGoal: number; defaultMuscleTarget: number; muscleTargets: Record<string, number> }
}

export interface TrainingMove { id: string; fromDate: string; date: string; splitId: string; cycleId: string; acceptedAt: string }
