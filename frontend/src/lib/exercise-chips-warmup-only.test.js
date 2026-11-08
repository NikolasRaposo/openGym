import { describe, expect, it } from 'vitest'
import { entryProgress, exerciseChips } from './exercise-chips.js'

describe('warm-up-only exercise chips', () => {
  it('marks an entry done only after all of its warm-up sets are done', () => {
    const entry = { id: 'prep', sets: [
      { phase: 'warmup', r: 6, done: true },
      { phase: 'warmup', r: 6, done: false },
    ] }
    expect(entryProgress(entry)).toBe('partial')
    expect(exerciseChips([entry], 0)[0].state).toBe('partial')

    entry.sets[1].done = true
    expect(entryProgress(entry)).toBe('done')
    expect(exerciseChips([entry], 0)[0].state).toBe('done')
  })

  it('keeps empty entries pending and work entries governed by work sets', () => {
    expect(entryProgress({ sets: [] })).toBe('todo')
    expect(entryProgress({ sets: [{ phase: 'warmup', done: false }] })).toBe('todo')
    expect(entryProgress({ sets: [
      { phase: 'warmup', done: false },
      { phase: 'work', done: true },
    ] })).toBe('done')
  })
})
