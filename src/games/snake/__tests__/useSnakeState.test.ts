import { act, renderHook } from '@testing-library/react-native'

import { SNAKE_SPEED_TIER_INTERVAL_MS } from '@/games/snake/constants/snake'
import { useSnakeState } from '@/games/snake/hooks/useSnakeState'
import { SnakeRoundSettings } from '@/games/snake/types'

const GRID = { cols: 30, rows: 30 }
const SETTINGS: SnakeRoundSettings = { wrapEdges: true, speedTier: 'normal', arenaVariant: 'open', enabledPowerups: [] }
const INTERVAL = SNAKE_SPEED_TIER_INTERVAL_MS.normal

// Regression coverage for F084/F085: the tick loop used to run whenever the round was 'playing',
// with no way to hold it, so the snakes kept moving behind an open dialog or a backgrounded app.
describe('useSnakeState paused', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  async function startRound(paused: boolean) {
    const rendered = await renderHook(({ paused: p }: { paused: boolean }) => useSnakeState(GRID, 'solo', SETTINGS, 'normal', undefined, 1, undefined, p), { initialProps: { paused } })
    await act(async () => {
      rendered.result.current.beginPlaying()
    })
    return rendered
  }

  async function advance(ms: number) {
    await act(async () => {
      jest.advanceTimersByTime(ms)
    })
  }

  it('ticks while playing and not paused', async () => {
    const { result } = await startRound(false)
    await advance(INTERVAL * 5)
    expect(result.current.state.tick).toBeGreaterThan(0)
  })

  it('holds the round still while paused, and resumes on unpause', async () => {
    const { result, rerender } = await startRound(true)
    await advance(INTERVAL * 5)
    expect(result.current.state.tick).toBe(0)

    await act(async () => {
      rerender({ paused: false })
    })
    await advance(INTERVAL * 5)
    expect(result.current.state.tick).toBeGreaterThan(0)
  })

  it('stops ticking when a pause lands mid-round', async () => {
    const { result, rerender } = await startRound(false)
    await advance(INTERVAL * 5)
    const tickAtPause = result.current.state.tick
    expect(tickAtPause).toBeGreaterThan(0)

    await act(async () => {
      rerender({ paused: true })
    })
    await advance(INTERVAL * 5)
    expect(result.current.state.tick).toBe(tickAtPause)
  })
})

describe('useSnakeState turns', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('takes a quick double swipe on the next two ticks without rendering for either', async () => {
    let renders = 0
    const { result } = await renderHook(() => {
      renders += 1
      return useSnakeState(GRID, 'solo', SETTINGS, 'normal', undefined, 1, undefined, false)
    })
    await act(async () => {
      result.current.beginPlaying()
    })
    const start = result.current.state.snakes[0].direction
    const across = start === 'up' || start === 'down' ? 'left' : 'up'
    const back = ({ up: 'down', down: 'up', left: 'right', right: 'left' } as const)[start]
    const rendersBefore = renders
    await act(async () => {
      result.current.turn(1, across)
      result.current.turn(1, back)
    })
    expect(renders).toBe(rendersBefore)
    await act(async () => {
      jest.advanceTimersByTime(INTERVAL * 4)
    })
    // A U-turn: only both swipes, one a tick, can leave it heading back the way it came.
    expect(result.current.state.snakes[0].alive).toBe(true)
    expect(result.current.state.snakes[0].direction).toBe(back)
  })
})
