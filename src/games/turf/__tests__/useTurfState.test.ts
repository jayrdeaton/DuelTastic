import { act, renderHook } from '@testing-library/react-native'

import { DEFAULT_TURF_OPTIONS } from '../constants'
import type { TurfOptions } from '../types'
import { useTurfState, type UseTurfStateParams } from '../useTurfState'

// A requestAnimationFrame that advances with Jest's fake timers, as in LightCycles' useGameState tests.
function installFakeRaf() {
  let nextId = 1
  const rafGlobal = globalThis as unknown as { requestAnimationFrame: (cb: (t: number) => void) => number; cancelAnimationFrame: (id: number) => void }
  rafGlobal.requestAnimationFrame = (cb: (t: number) => void) => {
    setTimeout(() => cb(Date.now()), 16)
    return nextId++
  }
  rafGlobal.cancelAnimationFrame = () => {}
}

const PARAMS: UseTurfStateParams = { width: 400, height: 800, cellPx: 8, intervalMs: 50, layout: 'faceToFace', p1OnRight: false, options: DEFAULT_TURF_OPTIONS, cpu: null, paused: false }

describe('useTurfState', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    installFakeRaf()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('waits for beginPlaying', async () => {
    const { result } = await renderHook(() => useTurfState(PARAMS))
    const start = result.current.state.players[1].head
    await act(async () => {
      jest.advanceTimersByTime(1000)
    })
    expect(result.current.state.phase).toBe('onboarding')
    expect(result.current.state.players[1].head).toEqual(start)
  })

  it('steps at its interval once playing', async () => {
    const { result } = await renderHook(() => useTurfState(PARAMS))
    const startY = result.current.state.players[1].head.y
    await act(async () => {
      result.current.beginPlaying()
    })
    await act(async () => {
      jest.advanceTimersByTime(500)
    })
    // About ten 50ms steps, give or take the frame the loop starts on.
    const moved = startY - result.current.state.players[1].head.y
    expect(moved).toBeGreaterThanOrEqual(8)
    expect(moved).toBeLessThanOrEqual(10)
  })

  it('stops the steps and the clock while paused', async () => {
    const { result, rerender } = await renderHook((props: UseTurfStateParams) => useTurfState(props), { initialProps: PARAMS })
    await act(async () => {
      result.current.beginPlaying()
    })
    await act(async () => {
      jest.advanceTimersByTime(200)
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

  it('ends the round on the clock', async () => {
    // 'home' so nobody's crash ends it first: both riders just keep going.
    const options: TurfOptions = { arena: 'open', crash: 'home', ownTrailDeadly: true, powerups: [], roundSeconds: 1 }
    const { result } = await renderHook(() => useTurfState({ ...PARAMS, options }))
    await act(async () => {
      result.current.beginPlaying()
    })
    await act(async () => {
      jest.advanceTimersByTime(1200)
    })
    expect(result.current.state.phase).toBe('roundOver')
    expect(result.current.state.outcome?.reason).toBe('time')
    expect(result.current.timeLeftMs).toBe(0)
  })

  it('lets the CPU steer seat 2', async () => {
    const { result } = await renderHook(() => useTurfState({ ...PARAMS, cpu: 'hard', options: { ...DEFAULT_TURF_OPTIONS, crash: 'home' } }))
    await act(async () => {
      result.current.beginPlaying()
    })
    await act(async () => {
      jest.advanceTimersByTime(4000)
    })
    // Riding straight down from its start, it would have long since claimed nothing; a CPU loops and
    // claims ground.
    expect(result.current.state.ground[2]).toBeGreaterThan(49)
  })

  it('turns up a pickup once playing with powerups on, and none with them off', async () => {
    const on = await renderHook(() => useTurfState({ ...PARAMS, options: { ...DEFAULT_TURF_OPTIONS, powerups: ['dash'] } }))
    const off = await renderHook(() => useTurfState(PARAMS))
    await act(async () => {
      on.result.current.beginPlaying()
      off.result.current.beginPlaying()
    })
    await act(async () => {
      jest.advanceTimersByTime(200)
    })
    expect(on.result.current.state.pickups).toHaveLength(1)
    expect(off.result.current.state.pickups).toEqual([])
  })

  it('leaves the round alone when a player with nothing held taps', async () => {
    const { result } = await renderHook(() => useTurfState(PARAMS))
    await act(async () => {
      result.current.beginPlaying()
    })
    const before = result.current.state
    await act(async () => {
      result.current.activate(1)
    })
    expect(result.current.state).toBe(before)
  })

  it('starts over on rematch', async () => {
    const { result } = await renderHook(() => useTurfState(PARAMS))
    const start = result.current.state
    await act(async () => {
      result.current.beginPlaying()
    })
    await act(async () => {
      jest.advanceTimersByTime(500)
    })
    await act(async () => {
      result.current.rematch()
    })
    expect(result.current.state.phase).toBe('onboarding')
    expect(result.current.state.players).toEqual(start.players)
    expect(result.current.timeLeftMs).toBe(DEFAULT_TURF_OPTIONS.roundSeconds * 1000)
  })
})
