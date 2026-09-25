import type { Cycle } from './types'

// The weekday plan is indexed Sun=0 through Sat=6. The cycle start only
// determines the eligible date range, never the weekday index.
export function splitForCalendarDate(cycle: Pick<Cycle, 'startDate' | 'weeks' | 'days'>, date: string): string | null {
  const start = new Date(cycle.startDate + 'T12:00:00')
  const day = new Date(date + 'T12:00:00')
  const diff = Math.round((Date.UTC(day.getFullYear(), day.getMonth(), day.getDate()) -
    Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) / 86400000)
  if (diff < 0 || diff >= cycle.weeks * 7) return null
  return cycle.days[day.getDay()] || null
}
