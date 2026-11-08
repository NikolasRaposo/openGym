// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})) }))
vi.mock('../sheets.jsx', () => ({ exConfigSheet: vi.fn(), exercisePicker: vi.fn(), glyphPicker: vi.fn(), confirmSheet: vi.fn() }))
vi.mock('../components/Media.jsx', () => ({ Thumb: () => null }))
vi.mock('../components/BodyMap.jsx', () => ({ default: () => null }))

import RoutineEdit from './RoutineEdit.jsx'
import { DEF, useStore } from '../store/useStore.js'
import { exConfigSheet } from '../sheets.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
let root, host

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  const S = structuredClone(DEF)
  S.routines = [{ id: 'r1', name: 'Inferior', ex: [{
    id: '1762', sets: 2, mode: 'reps', reps: 12, weight: 0,
    warmupExercise: { id: '7561', reps: 6, side: true, rest: 90, note: 'Parcial com apoio firme' },
  }] }]
  useStore.setState({ S, user: null })
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  act(() => root.render(<MemoryRouter initialEntries={['/plan/r/r1']}><Routes><Route path="/plan/r/:id" element={<RoutineEdit />} /></Routes></MemoryRouter>))
})

afterEach(() => { act(() => root.unmount()); host.remove() })

describe('preparation on an edited routine slot', () => {
  it('keeps the separate warm-up exercise when saving new work reps', () => {
    act(() => host.querySelector('[data-routine-row] .item .tap-main').click())
    const save = exConfigSheet.mock.calls[0][2]
    act(() => save({ sets: 2, mode: 'reps', reps: 14, weight: 0 }))

    const slot = useStore.getState().S.routines[0].ex[0]
    expect(slot.reps).toBe(14)
    expect(slot.warmupExercise).toEqual({ id: '7561', reps: 6, side: true, rest: 90, note: 'Parcial com apoio firme' })
  })
})
