import { useBackgroundPause } from '@tastic/core'
import { act, renderHook } from '@testing-library/react-native'
import { AppState } from 'react-native'

import { DEFAULT_P1_COLOR, DEFAULT_P2_COLOR } from '@/constants/game'
import { useGameState } from '@/hooks/useGameState'
import { DEFAULT_SETTINGS } from '@/redux/settingsSlice'

import { emitAppState } from '../testUtils/appState'

const COLORS = { 1: DEFAULT_P1_COLOR, 2: DEFAULT_P2_COLOR }
// Room for a few seconds of straight-line play before either cycle reaches a wall.
const ROOMY_BOARD_PX = 2000
// Under any grid-size tier's cellPx, so both cycles crash into the edge on the first tick.
const CRASH_BOARD_PX = 1

interface RoundProps {
  boardPx: number
  settingsOpen: boolean
  confirmVisible: boolean
}

// GameRound's pause wiring in miniature: the same useBackgroundPause getter and `paused` fold,
// feeding the real useGameState.
function useRound({ boardPx, settingsOpen, confirmVisible }: RoundProps) {
  const { backgroundPaused, resume } = useBackgroundPause(() => state.phase !== 'roundOver' && !settingsOpen && !confirmVisible)
  const paused = settingsOpen || confirmVisible || backgroundPaused
  const game = useGameState(boardPx, boardPx, DEFAULT_SETTINGS, COLORS, 'faceToFace', true, undefined, paused)
  const { state } = game
  return { ...game, backgroundPaused, resume }
}

async function startRound(props: Partial<RoundProps> = {}) {
  const rendered = await renderHook(useRound, { initialProps: { boardPx: ROOMY_BOARD_PX, settingsOpen: false, confirmVisible: false, ...props } })
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

beforeEach(() => {
  jest.mocked(AppState.addEventListener).mockClear()
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

describe('pausing when the app leaves the foreground mid-match', () => {
  it('freezes both trails, keeps them frozen after the app comes back, and picks the round up on Resume', async () => {
    const { result } = await startRound()
    await advance(500)

    await act(async () => emitAppState('background'))
    expect(result.current.backgroundPaused).toBe(true)
    const trailLengths = () => [result.current.state.players[1].trail.length, result.current.state.players[2].trail.length]
    const trailLengthsAtPause = trailLengths()
    expect(Math.min(...trailLengthsAtPause)).toBeGreaterThan(1)
    await advance(2000)
    // Coming back doesn't lift the pause: the Paused dialog waits for Resume.
    await act(async () => emitAppState('active'))
    await advance(2000)
    expect(result.current.backgroundPaused).toBe(true)
    expect(result.current.state.phase).toBe('playing')
    expect(trailLengths()).toEqual(trailLengthsAtPause)

    await act(async () => result.current.resume())
    expect(result.current.backgroundPaused).toBe(false)
    await advance(500)
    expect(trailLengths()[0]).toBeGreaterThan(trailLengthsAtPause[0])
    expect(trailLengths()[1]).toBeGreaterThan(trailLengthsAtPause[1])
  })

  it('latches during the countdown too', async () => {
    const { result } = await renderHook(useRound, { initialProps: { boardPx: ROOMY_BOARD_PX, settingsOpen: false, confirmVisible: false } })
    expect(result.current.state.phase).toBe('onboarding')

    await act(async () => emitAppState('inactive'))
    expect(result.current.backgroundPaused).toBe(true)
  })

  it('does not latch once the round is over', async () => {
    const { result } = await startRound({ boardPx: CRASH_BOARD_PX })
    await advance(500)
    expect(result.current.state.phase).toBe('roundOver')

    await act(async () => emitAppState('background'))
    expect(result.current.backgroundPaused).toBe(false)
  })

  it('leaves the pause to Settings or Quit Match? while either is already open', async () => {
    const { result, rerender } = await startRound({ settingsOpen: true })
    await act(async () => emitAppState('background'))
    expect(result.current.backgroundPaused).toBe(false)

    await rerender({ boardPx: ROOMY_BOARD_PX, settingsOpen: false, confirmVisible: true })
    await act(async () => emitAppState('background'))
    expect(result.current.backgroundPaused).toBe(false)
  })
})
