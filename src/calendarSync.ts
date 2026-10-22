import type { useLiftStore } from './store'
import { supabase } from './supabase'
import type { CalendarEvent } from './rhythm'

type HomebaseStore = ReturnType<typeof useLiftStore>
export interface CalendarConnection { id: string; kind: 'personal' | 'vedflow'; email: string; lastSync: string | null }
export interface CalendarStatus { configured: boolean; connections: CalendarConnection[] }
interface CalendarSnapshot { snapshot: Record<string, CalendarEvent[]>; range: { from: string; to: string }; updatedAt: string }

let lastRefreshAt = 0
let lastUserId = ''
let pending: Promise<void> | null = null

export async function calendarRequest<T>(action: string, body?: object): Promise<T> {
  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session?.access_token) throw Error('Sign in to Homebase to connect calendars.')
  const response = await fetch('/api/calendar?action=' + encodeURIComponent(action), {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: 'Bearer ' + data.session.access_token,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const result = await response.json()
  if (!response.ok) throw Error(result.error || 'Google Calendar request failed.')
  return result as T
}

// Refreshes Google events when Homebase opens, becomes visible, or gets focus.
// Manual meetings and the original one-time Rhythm snapshot are never overwritten.
export async function refreshHomebaseCalendars(store: HomebaseStore, force = false): Promise<void> {
  if (!store.userId || store.syncStatus !== 'synced') return
  if (lastUserId !== store.userId) {
    lastUserId = store.userId
    lastRefreshAt = 0
  }
  if (pending) return pending
  if (!force && Date.now() - lastRefreshAt < 15 * 60_000) return
  const owner = store.userId
  pending = (async () => {
    const status = await calendarRequest<CalendarStatus>('status')
    if (!status.configured || !status.connections.length) {
      lastRefreshAt = Date.now()
      return
    }
    const result = await calendarRequest<CalendarSnapshot>('sync', {})
    // Auth and cloud state may have changed during the Google fetch.
    if (owner !== store.userId || !store.state.rhythm) return
    const previous = store.state.rhythm.calendarSnapshot || {}
    const merged: Record<string, CalendarEvent[]> = {}
    for (const [day, events] of Object.entries(previous)) {
      // Only the currently refreshed range is authoritative for Google events.
      const preserved = (day >= result.range.from && day <= result.range.to)
        ? events.filter(event => !event.id.startsWith('google:'))
        : events
      if (preserved.length) merged[day] = preserved
    }
    for (const [day, events] of Object.entries(result.snapshot))
      if (day >= result.range.from && day <= result.range.to)
        merged[day] = [...(merged[day] || []), ...events]
    store.state.rhythm.calendarSnapshot = merged
    store.state.rhythm.snapshotUpdatedAt = result.updatedAt
    lastRefreshAt = Date.now()
  })()
  try { await pending } finally { pending = null }
}

export function allowNextCalendarRefresh() { lastRefreshAt = 0 }
