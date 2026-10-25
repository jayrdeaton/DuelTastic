import { act, renderHook } from '@testing-library/react-native'

import { SPEED_RAMP_DECREMENT_MS, SPEED_RAMP_INTERVAL_MS, SPEED_TIER_INTERVAL_MS } from '@/games/lightcycles/constants/game'
import { useGameState } from '@/games/lightcycles/hooks/useGameState'
import { RoundSettings } from '@/games/lightcycles/types'

// Deterministic, fake-timer-compatible rAF - jest-expo's own RN environment may already define
// requestAnimationFrame through a scheduler that isn't guaranteed to advance with
// jest.advanceTimersByTime, so this pins it explicitly for these tests regardless of that.
function installFakeRaf() {
  let nextId = 1
  const rafGlobal = globalThis as unknown as { requestAnimationFrame: (cb: (t: number) => void) => number; cancelAnimationFrame: (id: number) => void }
  rafGlobal.requestAnimationFrame = (cb: (t: number) => void) => {
    const id = nextId++
    setTimeout(() => cb(Date.now()), 16)
    return id
  }
  rafGlobal.cancelAnimationFrame = (id: number) => {
    void id
  }
}

const SETTINGS: RoundSettings = { speedTier: 'fast', speedRampEnabled: false, gameMode: 'twoPlayer', cpuDifficulty: 'normal', gridSizeTier: 'medium', trailSpeedTier: 'off', controlScheme: { 1: 'wasd', 2: 'arrows' }, enabledPowerups: [], arenaVariant: 'open', extendIntoSafeArea: false, wrapEdges: false }
const CPU_SETTINGS: RoundSettings = { ...SETTINGS, gameMode: 'vsCpu', cpuDifficulty: 'hard' }
const COLORS = { 1: '#3B82F6', 2: '#EF4444' }
const ORIENTATION = 'faceToFace'
const P1_ON_RIGHT = true

describe('useGameState', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    installFakeRaf()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('starts in onboarding and does not tick before beginPlaying is called', async () => {
    const { result } = await renderHook(() => useGameState(200, 200, SETTINGS, COLORS, ORIENTATION, P1_ON_RIGHT))
    expect(result.current.state.phase).toBe('onboarding')

    await act(async () => {
      jest.advanceTimersByTime(2000)
    })

    expect(result.current.state.phase).toBe('onboarding')
    expect(result.current.state.players[1].trail).toHaveLength(1)
  })

  it('advances both trails once playing', async () => {
    const { result } = await renderHook(() => useGameState(200, 200, SETTINGS, COLORS, ORIENTATION, P1_ON_RIGHT))

    await act(async () => {
      result.current.beginPlaying()
    })
    expect(result.current.state.phase).toBe('playing')

    await act(async () => {
      jest.advanceTimersByTime(1000)
    })

    expect(result.current.state.players[1].trail.length).toBeGreaterThan(1)
    expect(result.current.state.players[2].trail.length).toBeGreaterThan(1)
  })

  it('keeps a laggy trailSpeedTier shorter than the classic tier over the same run', async () => {
    // A much bigger board than the other tests here use - this one needs enough runway that
    // neither player reaches a wall (ending the round) before there's been time to both clear
    // MIN_TRAIL_LENGTH_BEFORE_TRIM's grace period (gameEngine.ts - below that length every tier
    // just grows like 'off') and show a real difference afterward.
    const { result: classic } = await renderHook(() => useGameState(2000, 2000, SETTINGS, COLORS, ORIENTATION, P1_ON_RIGHT))
    const { result: fast } = await renderHook(() => useGameState(2000, 2000, { ...SETTINGS, trailSpeedTier: 'fast' }, COLORS, ORIENTATION, P1_ON_RIGHT))

    await act(async () => {
      classic.current.beginPlaying()
      fast.current.beginPlaying()
    })

    await act(async () => {
      jest.advanceTimersByTime(3000)
    })

    expect(classic.current.state.phase).toBe('playing')
    expect(fast.current.state.phase).toBe('playing')
    expect(fast.current.state.players[1].trail.length).toBeLessThan(classic.current.state.players[1].trail.length)
  })

  it('threads settings.arenaVariant through createInitialGameState into state.obstacles', async () => {
    // 'small' cellPx against a real-phone-sized board clears both PILLAR/GAUNTLET arena minimums
    // (see arenas.test.ts) - 'medium' at the 200x200 board every other test here uses does not.
    const { result } = await renderHook(() => useGameState(390, 844, { ...SETTINGS, gridSizeTier: 'small', arenaVariant: 'pillars' }, COLORS, ORIENTATION, P1_ON_RIGHT))
    expect(result.current.state.obstacles.length).toBeGreaterThan(0)
  })

  it('threads settings.arenaVariant through createInitialGameState into state.portals', async () => {
    // Same clears-the-minimums reasoning as the obstacles case above - see arenas.test.ts's own
    // PORTAL_MIN_ALONG_LENGTH/PORTAL_MIN_CROSS_LENGTH thresholds.
    const { result } = await renderHook(() => useGameState(390, 844, { ...SETTINGS, gridSizeTier: 'small', arenaVariant: 'portals' }, COLORS, ORIENTATION, P1_ON_RIGHT))
    expect(result.current.state.portals.length).toBeGreaterThan(0)
  })

  it('threads settings.arenaVariant through createInitialGameState into state.tunnels', async () => {
    // Same clears-the-minimums reasoning as the obstacles/portals cases above - see arenas.test.ts's
    // own TUNNEL_MIN_ALONG_LENGTH/TUNNEL_MIN_CROSS_LENGTH thresholds.
    const { result } = await renderHook(() => useGameState(390, 844, { ...SETTINGS, gridSizeTier: 'small', arenaVariant: 'underpass' }, COLORS, ORIENTATION, P1_ON_RIGHT))
    expect(result.current.state.tunnels.length).toBeGreaterThan(0)
  })

  it('applies the CPU turn in the same tick it is consumed, when gameMode is vsCpu', async () => {
    const { result } = await renderHook(() => useGameState(200, 200, CPU_SETTINGS, COLORS, ORIENTATION, P1_ON_RIGHT))

    await act(async () => {
      result.current.beginPlaying()
    })

    await act(async () => {
      jest.advanceTimersByTime(1000)
    })

    // Player 2 is CPU-controlled here (see cpuAi.ts) - its trail advancing at all, with no human
    // input source wired up in this test, proves applyCpuTurn's chosen direction was folded into
    // the same setState as the tick that consumed it (see useGameState.ts), not left pending for
    // an extra render.
    expect(result.current.state.players[2].trail.length).toBeGreaterThan(1)
  })

  it('exposes a larger cellPx, and a proportionally larger tickIntervalMs, for a larger grid-size tier', async () => {
    const { result: small } = await renderHook(() => useGameState(200, 200, { ...SETTINGS, gridSizeTier: 'small' }, COLORS, ORIENTATION, P1_ON_RIGHT))
    const { result: large } = await renderHook(() => useGameState(200, 200, { ...SETTINGS, gridSizeTier: 'large' }, COLORS, ORIENTATION, P1_ON_RIGHT))

    expect(large.current.cellPx).toBeGreaterThan(small.current.cellPx)
    // On-screen px/sec pace stays constant across tiers: ms/tick scales with cellPx (see
    // scaleMsForCellPx), so a bigger cellPx should come with a proportionally bigger tickIntervalMs.
    expect(large.current.tickIntervalMs).toBeGreaterThan(small.current.tickIntervalMs)
    expect(small.current.tickIntervalMs / small.current.cellPx).toBeCloseTo(large.current.tickIntervalMs / large.current.cellPx)
  })

  it('exposes an activate callback - a no-op (via applyActivation, see gameEngine.test.ts) while nothing is held', async () => {
    const { result } = await renderHook(() => useGameState(200, 200, SETTINGS, COLORS, ORIENTATION, P1_ON_RIGHT))

    await act(async () => {
      result.current.beginPlaying()
    })
    const before = result.current.state
    await act(async () => {
      result.current.activate(1)
    })
    expect(result.current.state).toBe(before)
  })

  it('stops ticking once the round ends', async () => {
    // A 1x1-cell board (well under any grid-size tier's cellPx) forces an edge crash on the very
    // first tick.
    const { result } = await renderHook(() => useGameState(1, 1, SETTINGS, COLORS, ORIENTATION, P1_ON_RIGHT))

    await act(async () => {
      result.current.beginPlaying()
    })

    await act(async () => {
      jest.advanceTimersByTime(500)
    })

    expect(result.current.state.phase).toBe('roundOver')
    const trailLengthAtEnd = result.current.state.players[1].trail.length

    await act(async () => {
      jest.advanceTimersByTime(2000)
    })

    // No further ticks fire once the effect's own [state.phase] dependency tears the loop down.
    expect(result.current.state.players[1].trail.length).toBe(trailLengthAtEnd)
  })

  // F085: a Settings, Quit Match? or Paused dialog (see useMatchFlow's `paused`) halts the loop without
  // leaving 'playing', and closing it picks the round back up where it stopped.
  it('halts the tick loop while paused and resumes it afterward', async () => {
    const { result, rerender } = await renderHook(({ paused }: { paused: boolean }) => useGameState(2000, 2000, SETTINGS, COLORS, ORIENTATION, P1_ON_RIGHT, undefined, paused), { initialProps: { paused: false } })

    await act(async () => {
      result.current.beginPlaying()
    })
    await act(async () => {
      jest.advanceTimersByTime(500)
    })
    await rerender({ paused: true })
    const trailLengthAtPause = result.current.state.players[1].trail.length

    await act(async () => {
      jest.advanceTimersByTime(2000)
    })
    expect(result.current.state.phase).toBe('playing')
    expect(result.current.state.players[1].trail.length).toBe(trailLengthAtPause)

    await rerender({ paused: false })
    await act(async () => {
      jest.advanceTimersByTime(500)
    })
    expect(result.current.state.players[1].trail.length).toBeGreaterThan(trailLengthAtPause)
  })

  // The ramp's clock used to reset every time the loop effect started, which a pause now does mid-round.
  describe('speed ramp clock', () => {
    // Tall enough that neither cycle reaches a wall or the other before the ramp's first step.
    const RAMP_SETTINGS: RoundSettings = { ...SETTINGS, speedRampEnabled: true }
    const BASE_INTERVAL_MS = SPEED_TIER_INTERVAL_MS.fast
    const RAMPED_INTERVAL_MS = SPEED_TIER_INTERVAL_MS.fast - SPEED_RAMP_DECREMENT_MS

    async function rampedRound() {
      const rendered = await renderHook(({ paused }: { paused: boolean }) => useGameState(2000, 8000, RAMP_SETTINGS, COLORS, ORIENTATION, P1_ON_RIGHT, undefined, paused), { initialProps: { paused: false } })
      await act(async () => {
        rendered.result.current.beginPlaying()
      })
      await act(async () => {
        jest.advanceTimersByTime(SPEED_RAMP_INTERVAL_MS + 1000)
      })
      expect(rendered.result.current.state.phase).toBe('playing')
      expect(rendered.result.current.tickIntervalMs).toBe(RAMPED_INTERVAL_MS)
      return rendered
    }

    it('keeps the ramped speed across a pause instead of dropping back to the base speed', async () => {
      const { result, rerender } = await rampedRound()

      await rerender({ paused: true })
      await act(async () => {
        jest.advanceTimersByTime(2000)
      })
      await rerender({ paused: false })
      await act(async () => {
        jest.advanceTimersByTime(200)
      })

      expect(result.current.state.phase).toBe('playing')
      expect(result.current.tickIntervalMs).toBe(RAMPED_INTERVAL_MS)
    })

    it('starts the ramp over with the next round', async () => {
      const { result } = await rampedRound()

      await act(async () => {
        result.current.rematch()
      })
      expect(result.current.state.phase).toBe('onboarding')
      await act(async () => {
        result.current.beginPlaying()
      })
      await act(async () => {
        jest.advanceTimersByTime(200)
      })

      expect(result.current.tickIntervalMs).toBe(BASE_INTERVAL_MS)
    })
  })
})
