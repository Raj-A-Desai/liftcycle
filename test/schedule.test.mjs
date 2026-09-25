import test from 'node:test'
import assert from 'node:assert/strict'
import { splitForCalendarDate } from '../src/schedule.ts'

const cycle = { startDate: '2026-09-22', weeks: 6, days: ['pull','','push','','legs','',''] }

test('start date does not rotate Sunday–Saturday workout assignments', () => {
  assert.equal(splitForCalendarDate(cycle, '2026-09-22'), 'push')
  assert.equal(splitForCalendarDate(cycle, '2026-09-23'), null)
  assert.equal(splitForCalendarDate(cycle, '2026-09-24'), 'legs')
  assert.equal(splitForCalendarDate(cycle, '2026-09-26'), null)
  assert.equal(splitForCalendarDate(cycle, '2026-09-27'), 'pull')
  assert.equal(splitForCalendarDate(cycle, '2026-09-29'), 'push')
  assert.equal(splitForCalendarDate(cycle, '2026-10-01'), 'legs')
})

test('cycle boundaries honor start date and six-week length', () => {
  assert.equal(splitForCalendarDate(cycle, '2026-09-20'), null)
  assert.equal(splitForCalendarDate(cycle, '2026-11-02'), null)
})
