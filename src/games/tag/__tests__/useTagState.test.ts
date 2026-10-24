import { act, renderHook } from '@testing-library/react-native'

import { DEFAULT_TAG_OPTIONS } from '../constants'
import { useTagState, type UseTagStateParams } from '../useTagState'

// A requestAnimationFrame that advances with Jest's fake timers, as in Turf's hook tests.
function installFakeRaf() {
  let nextId = 1
  const rafGlobal = globalThis as unknown as { requestAnimationFrame: (cb: (t: number) => void) => number; cancelAnimationFrame: (id: number) => void }
  rafGlobal.requestAnimationFrame = (cb: (t: number) => void) => {
    setTimeout(() => cb(Date.now()), 16)
    return nextId++
  }
  rafGlobal.cancelAnimationFrame = () => {}
}

const PARAMS: UseTagStateParams = { width: 374, height: 836, cellPx: 22, intervalMs: 50, layout: 'faceToFace', p1OnRight: false, options: DEFAULT_TAG_OPTIONS, startingIt: 2, cpu: null, paused: false }

describe('useTagState', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    installFakeRaf()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('waits for beginPlaying', async () => {
    const { result } = await renderHook(() => useTagState(PARAMS))
    const start = result.current.state.players[1].head
    await act(async () => {
      jest.advanceTimersByTime(1000)
    })
    expect(result.current.state.phase).toBe('onboarding')
    expect(result.current.state.players[1].head).toEqual(start)
  })

  it('steps at its interval once playing', async () => {
    const { result } = await renderHook(() => useTagState(PARAMS))
    const startY = result.current.state.players[1].head.y
    await act(async () => {
      result.current.beginPlaying()
    })
    await act(async () => {
      jest.advanceTimersByTime(300)
    })
    // About six 50ms steps, give or take the frame the loop starts on.
    const moved = startY - result.current.state.players[1].head.y
    expect(moved).toBeGreaterThanOrEqual(4)
    expect(moved).toBeLessThanOrEqual(6)
  })

  it('stops the steps and the clock while paused', async () => {
    const { result, rerender } = await renderHook((props: UseTagStateParams) => useTagState(props), { initialProps: PARAMS })
    await act(async () => {
      result.current.beginPlaying()
    })
    await act(async () => {
      jest.advanceTimersByTime(100)
    })
    await rerender({ ...PARAMS, paused: true })
    const head = result.current.state.players[1].head
    const timeLeft = result.current.timeLeftMs
    await act(async () => {
      jest.advanceTimersByTime(1000)
    })
    expect(result.current.state.players[1].head).toEqual(head)
    expect(result.current.timeLeftMs).toBe(timeLeft)
  })

  it('ends the round on the clock, against whoever is It on Hot Potato', async () => {
    const { result } = await renderHook(() => useTagState({ ...PARAMS, width: 900, options: { ...DEFAULT_TAG_OPTIONS, arena: 'open', roundSeconds: 0.2 }, layout: 'sideBySide' }))
    await act(async () => {
      result.current.beginPlaying()
    })
    await act(async () => {
      jest.advanceTimersByTime(400)
    })
    expect(result.current.state.phase).toBe('roundOver')
    expect(result.current.state.outcome).toEqual({ type: 'win', winner: 1 })
    expect(result.current.timeLeftMs).toBe(0)
  })

  it('lets the CPU steer seat 2', async () => {
    const { result } = await renderHook(() => useTagState({ ...PARAMS, cpu: 'hard' }))
    await act(async () => {
      result.current.beginPlaying()
    })
    await act(async () => {
      jest.advanceTimersByTime(3000)
    })
    // Seat 1 rides straight up into the edge; the CPU, It, comes and tags it.
    expect(result.current.state.tags).toBeGreaterThan(0)
  })

  it('turns up a box once playing with powerups on, and uses a held one on a tap', async () => {
    const { result } = await renderHook(() => useTagState({ ...PARAMS, options: { ...DEFAULT_TAG_OPTIONS, powerups: ['tangle'] } }))
    await act(async () => {
      result.current.beginPlaying()
    })
    await act(async () => {
      jest.advanceTimersByTime(100)
    })
    expect(result.current.state.pickups).toHaveLength(1)
    const before = result.current.state
    await act(async () => {
      result.current.activate(1)
    })
    // Nothing held yet: nothing happens.
    expect(result.current.state).toBe(before)
  })

  it('starts over on rematch, with whoever the round screen says is It', async () => {
    const { result, rerender } = await renderHook((props: UseTagStateParams) => useTagState(props), { initialProps: PARAMS })
    await act(async () => {
      result.current.beginPlaying()
    })
    await act(async () => {
      jest.advanceTimersByTime(500)
    })
    await rerender({ ...PARAMS, startingIt: 1 })
    await act(async () => {
      result.current.rematch()
    })
    expect(result.current.state.phase).toBe('onboarding')
    expect(result.current.state.it).toBe(1)
    expect(result.current.state.tick).toBe(0)
    expect(result.current.timeLeftMs).toBe(DEFAULT_TAG_OPTIONS.roundSeconds * 1000)
  })
})
