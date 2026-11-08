import { describe, expect, it } from 'vitest'
import { buildSessionEntries } from './session-start.js'
import { buildCombinedEntries } from './session-merge.js'
import { buildCompletedWorkout } from './finish-workout.js'
import { readBackupFile } from './backup-media.js'
import { lastEntryFor, workoutVolume } from './history.js'
import { isWarmupRow } from './workout-model.js'
import { restSecFor, warmupRestSecFor } from './supersetFlow.js'

const state = routine => ({ unit: 'kg', exWeights: {}, routines: [routine], workouts: [], week: {}, dayPlan: {}, startFrom: 'plan' })
const routine = cfg => ({ id: 'R', name: 'R', prog: 'off', ex: [cfg] })
const work = extra => ({ id: '0025', mode: 'reps', sets: 2, reps: 8, weight: 60, prog: 'off', ...extra })

describe('native exercise used only to prepare a planned movement', () => {
  it('opens a distinct native entry with six warm-up reps and leaves the two work sets intact', () => {
    const r = routine(work({ warmupSets: 1, warmupExercise: { id: '0043', reps: 6, rest: 60, note: 'Agachamento livre' } }))
    const [prep, main] = buildSessionEntries(state(r), r)

    expect(prep.id).toBe('0043')
    expect(prep.noProg).toBe(true)
    expect(prep.target).toMatchObject({ mode: 'reps', sets: 1, reps: 6, weight: 0, restSec: 60, note: 'Agachamento livre' })
    expect(prep.sets).toEqual([{ w: 0, r: 6, done: false, phase: 'warmup', warmup: true }])
    const rest = restSecFor([prep, main], [0], 180)
    expect(warmupRestSecFor(prep, 0, rest, 0)).toBe(60)
    expect(main.id).toBe('0025')
    expect(main.sets).toHaveLength(2)
    expect(main.sets.every(row => !isWarmupRow(row))).toBe(true)
  })

  it('makes six reps per leg, with a single warm-up set split into left and right', () => {
    const r = routine(work({ warmupExercise: { id: '0499', reps: 6, side: true, rest: 90 } }))
    const [prep] = buildSessionEntries(state(r), r)

    expect(prep.target).toMatchObject({ reps: 12, side: true, restSec: 90 })
    expect(prep.sets).toHaveLength(1)
    expect(prep.sets[0]).toMatchObject({ r: 12, phase: 'warmup', warmup: true,
      sides: { L: { r: 6, w: 0, done: false }, R: { r: 6, w: 0, done: false } } })
  })

  it('does not add a second ramp from saved warm-ups or the slot legacy count', () => {
    const r = routine(work({ warmupSets: 2, warmupExercise: { id: '0043', reps: 6 } }))
    const st = state(r)
    st.startFrom = 'last'
    st.workouts = [{ id: 'old', d: '2026-10-01', routineIds: ['R'], entries: [{ id: '0025', rid: 'R',
      target: { sets: 2, reps: 8, weight: 60, mode: 'reps' },
      sets: [{ w: 20, r: 5, done: true, phase: 'warmup', edited: true }, { w: 60, r: 8, done: true }] }] }]

    const [prep, main] = buildSessionEntries(st, r)
    expect(prep.sets).toHaveLength(1)
    expect(main.sets.filter(isWarmupRow)).toHaveLength(0)
    expect(main.sets.filter(row => !isWarmupRow(row))).toHaveLength(2)
  })

  it('retains the completed preparation in history while excluding it from work volume and progression', () => {
    const r = routine(work({ warmupExercise: { id: '0043', reps: 6, rest: 60 } }))
    const entries = buildSessionEntries(state(r), r)
    entries[0].sets[0].done = true
    entries[1].sets.forEach(row => { row.done = true })
    const saved = buildCompletedWorkout({ id: 'a', d: '2026-11-08', routineId: 'R', entries }, { end: 123 })
    const prep = saved.entries.find(entry => entry.id === '0043')

    expect(prep).toBeDefined()
    expect(prep.noProg).toBe(true)
    expect(prep.sets).toMatchObject([{ phase: 'warmup', warmup: true, done: true }])
    expect(workoutVolume(saved)).toBe(960)
  })

  it('preserves the old routine shape when a preparatory native exercise is not configured', () => {
    const r = routine(work({ warmupSets: 1 }))
    const entries = buildSessionEntries(state(r), r)
    expect(entries).toHaveLength(1)
    expect(entries[0].sets.filter(isWarmupRow)).toHaveLength(1)
  })

  it('does not create an unknown exercise or reuse an id belonging to a work slot', () => {
    const unknown = routine(work({ warmupSets: 1, warmupExercise: { id: 'not-in-catalogue', reps: 6 } }))
    expect(buildSessionEntries(state(unknown), unknown)).toHaveLength(1)
    expect(buildSessionEntries(state(unknown), unknown)[0].sets.filter(isWarmupRow)).toHaveLength(1)

    const sameId = routine(work({ warmupExercise: { id: '0025', reps: 6 } }))
    expect(buildSessionEntries(state(sameId), sameId)).toHaveLength(1)
  })

  it('uses native supported single-leg squat before pistol work without masking its next-session history', () => {
    const r = routine(work({ id: '1762', side: true, reps: 12, warmupExercise: {
      id: '7561', reps: 6, side: true, rest: 90,
      note: 'Pistol parcial: perna à frente e apoio firme',
    } }))
    const [prep, main] = buildSessionEntries(state(r), r)
    expect([prep.id, main.id]).toEqual(['7561', '1762'])
    expect(prep.sets[0].sides.L.r).toBe(6)
    expect(prep.sets[0].sides.R.r).toBe(6)
    expect(main.sets).toHaveLength(2)

    prep.sets[0].sides.L.done = true
    prep.sets[0].sides.R.done = true
    prep.sets[0].done = true
    main.sets.forEach(row => {
      row.sides.L.done = true
      row.sides.R.done = true
      row.done = true
    })
    const saved = buildCompletedWorkout({ id: 'b', d: '2026-11-08', routineId: 'R', entries: [prep, main] }, { end: 123 })
    const next = { ...state(r), workouts: [saved] }
    expect(lastEntryFor(next, '1762', 'R')?.sets).toHaveLength(2)
    expect(lastEntryFor(next, '7561', 'R')).toBeNull()
    expect(workoutVolume({ entries: [saved.entries[0]] })).toBe(0)
    expect(workoutVolume(saved)).toBe(1440)
  })

  it('retains the preparatory prescription through the JSON backup reader', async () => {
    const preparation = { id: '7561', reps: 6, side: true, rest: 90, note: 'Apoio firme' }
    const r = routine(work({ id: '1762', side: true, warmupSets: 2, warmupExercise: preparation }))
    const backup = { ...state(r), workouts: [] }
    const read = await readBackupFile(new Blob([JSON.stringify(backup)], { type: 'application/json' }))

    expect(read.state.routines[0].ex[0].warmupExercise).toEqual(preparation)
    const [prep, main] = buildSessionEntries(read.state, read.state.routines[0])
    expect(prep.id).toBe('7561')
    expect(main.id).toBe('1762')
    expect(prep.sets).toHaveLength(1)
    expect(main.sets.filter(isWarmupRow)).toHaveLength(0)
  })

  it('falls back to the planned ramp when the prep id is work in another combined routine', () => {
    const upper = routine(work({ warmupSets: 1, warmupExercise: { id: '0043', reps: 6, rest: 60 } }))
    const lower = { id: 'L', name: 'L', prog: 'off', ex: [{ id: '0043', mode: 'reps', sets: 2, reps: 8, weight: 60, prog: 'off' }] }
    const st = { ...state(upper), routines: [upper, lower] }
    const combined = buildCombinedEntries(st, ['R', 'L'])

    expect(combined.entries.map(entry => entry.id)).toEqual(['0025', '0043'])
    expect(combined.entries[0].sets.filter(isWarmupRow)).toHaveLength(1)
    expect(combined.entries[1].sets.filter(isWarmupRow)).toHaveLength(0)
    combined.entries.forEach(entry => entry.sets.forEach(row => { row.done = true }))
    const saved = buildCompletedWorkout({ id: 'c', d: '2026-11-08', routineIds: ['R', 'L'], entries: combined.entries }, { end: 123 })
    expect(lastEntryFor({ ...st, workouts: [saved] }, '0043', 'L')?.sets).toHaveLength(2)
  })
})
