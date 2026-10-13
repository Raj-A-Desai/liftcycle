import type { LiftCycleState, Workout } from './types.ts'

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
const object = (v: any) => v !== null && typeof v === 'object' && !Array.isArray(v)
const keyed = (a: any[]) => a.every(v => object(v) && typeof v.id === 'string') && new Set(a.map(v=>v.id)).size === a.length

// Apply only changes since the shared snapshot, recursively down to individual sets.
// Concurrent edits to the same field use this device's pending value. A later sync
// receives that resolved value; unrelated changes from either device survive.
export function mergeValue(base: any, local: any, remote: any, knownBase = true): any {
  if (same(local, remote)) return local
  if (knownBase && same(local, base)) return remote
  if (knownBase && same(remote, base)) return local
  if (Array.isArray(local) && Array.isArray(remote) && keyed(local) && keyed(remote)) {
    const before = new Map((Array.isArray(base) ? base : []).map(v=>[v.id,v]))
    const ours = new Map(local.map(v=>[v.id,v])), theirs = new Map(remote.map(v=>[v.id,v]))
    return [...new Set([...remote.map(v=>v.id), ...local.map(v=>v.id)])].flatMap(id=> {
      const l=ours.get(id), r=theirs.get(id), b=before.get(id)
      if (l === undefined || r === undefined) {
        const surviving=l ?? r
        // Honor deletion of unchanged records; preserve edits if deletion raced an edit.
        return knownBase && b !== undefined && same(surviving,b) ? [] : [surviving]
      }
      return [mergeValue(b,l,r,knownBase)]
    })
  }
  if (object(local) && object(remote)) {
    const result: Record<string,any> = {}
    for (const key of new Set([...Object.keys(local),...Object.keys(remote)])) {
      const value=mergeValue(base?.[key],local[key],remote[key],knownBase)
      if (value !== undefined) result[key]=value
    }
    if (result.done === true && result.skipped === true) result.skipped = false
    return result
  }
  if (!knownBase) {
    // Legacy caches have no ancestor. Union records, retain completed checkmarks,
    // and prefer the cloud for ambiguous settings rather than upload a stale plan.
    if (typeof local === 'boolean' && typeof remote === 'boolean') return local || remote
    return remote ?? local
  }
  return local
}

const drafts = (s: LiftCycleState | null) => s ? [...(s.draft ? [s.draft] : []), ...(s.pausedDrafts ?? [])] : []
export function mergeCloudState(base: LiftCycleState | null, local: LiftCycleState, remote: LiftCycleState): LiftCycleState {
  const known=base !== null
  const merged=JSON.parse(JSON.stringify(mergeValue(base,local,remote,known))) as LiftCycleState
  const pending=JSON.parse(JSON.stringify(mergeValue(drafts(base),drafts(local),drafts(remote),known))) as Workout[]
  // Saving or skipping a session resolves its draft on every device. Merge any
  // concurrent set edits into the saved record before removing the duplicate draft.
  for (const w of pending) {
    const saved=merged.history.find(h=>h.id===w.id)
    if (saved) {
      const previous=base?.history.find(h=>h.id===w.id) ?? drafts(base).find(h=>h.id===w.id)
      const combined=mergeValue(previous,w,saved,known)
      Object.assign(saved,combined,{status:saved.status})
    }
  }
  const unfinished=pending.filter(w=>!merged.history.some(h=>h.id===w.id))
  const preferred=known && same(local.draft?.id,base?.draft?.id) ? remote.draft?.id : local.draft?.id
  merged.draft=unfinished.find(w=>w.id===preferred) ?? unfinished.find(w=>w.id===remote.draft?.id) ?? unfinished[0] ?? null
  merged.pausedDrafts=unfinished.filter(w=>w.id!==merged.draft?.id)
  return merged
}
