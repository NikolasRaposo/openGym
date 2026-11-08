import { describe, expect, it } from 'vitest'
import { buildPlanBundle, mergePlan, parsePlan } from './plan-share.js'

const prep = { id: '7561', reps: 6, side: true, rest: 90, note: 'Parcial com apoio firme' }
const plan = warmupExercise => ({ unit: 'kg', week: {}, customEx: [], routines: [{
  id: 'r', name: 'Inferior', ex: [{ id: '1762', sets: 2, mode: 'reps', reps: 12, weight: 0, warmupExercise }],
}] })

describe('separate native warm-up exercise in a shared plan', () => {
  it('survives export, parse, and merge with reps per side and rest intact', () => {
    const bundle = buildPlanBundle(plan(prep), 'Inferior')
    expect(bundle.routines[0].ex[0].warmupExercise).toEqual(prep)
    const parsed = parsePlan(JSON.stringify(bundle))
    expect(parsed.routines[0].ex[0].warmupExercise).toEqual(prep)
    const target = { unit: 'kg', routines: [], customEx: [], week: {} }
    mergePlan(target, parsed)
    expect(target.routines[0].ex[0].warmupExercise).toEqual(prep)
  })

  it('rejects unknown, custom, reused, and unbounded preparation fields on import', () => {
    const bundle = buildPlanBundle(plan(prep), 'Inferior')
    const parse = warmupExercise => parsePlan({ ...bundle, routines: [{ ...bundle.routines[0], ex: [
      { ...bundle.routines[0].ex[0], warmupExercise },
    ] }] }).routines[0].ex[0].warmupExercise

    expect(parse({ ...prep, id: 'unknown' })).toBeUndefined()
    expect(parsePlan({ ...bundle, customEx: [{ id: 'custom-1', n: 'Personal row', bp: 'back' }],
      routines: [{ ...bundle.routines[0], ex: [{ ...bundle.routines[0].ex[0], warmupExercise: { ...prep, id: 'custom-1' } }] }],
    }).routines[0].ex[0].warmupExercise).toBeUndefined()
    expect(parse({ ...prep, id: '1762' })).toBeUndefined()
    expect(parse({ ...prep, reps: 1001 })).toBeUndefined()
    expect(parse({ ...prep, reps: '6' })).toBeUndefined()
    expect(parse({ ...prep, rest: 10000, note: 'x'.repeat(600), extra: 'discard' })).toEqual({
      id: '7561', reps: 6, side: true, note: 'x'.repeat(500),
    })
  })
})
