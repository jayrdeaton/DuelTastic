import { safeBack } from '@tastic/shell'
import { act, renderHook } from '@testing-library/react-native'
import { usePreventRemove } from 'expo-router'
import { useEffect } from 'react'

import type { GamePhase, RoundOutcome } from '@/shared/match/types'
import { useMatchControls } from '@/shared/match/useMatchFlow'

// The router mock has no canGoBack, so the real safeBack can't run here.
jest.mock('@tastic/shell', () => ({ ...jest.requireActual('@tastic/shell'), safeBack: jest.fn() }))

const PLAYED: RoundOutcome[] = [{ type: 'draw' }]

interface RoundProps {
  phase: GamePhase
}

// A round screen's back wiring in miniature: the real useMatchControls, told the phase the way
// useMatchFlow tells it (in an effect, after the render that changed it), and nothing else that
// would render the screen again.
function useRound({ phase }: RoundProps) {
  const controls = useMatchControls(PLAYED)
  const { trackPhase } = controls
  useEffect(() => {
    trackPhase(phase)
  }, [phase, trackPhase])
  return controls
}

// Whether the native back gesture and hardware back are held for Quit Match?, as of the last render.
const backHeld = () => jest.mocked(usePreventRemove).mock.calls.at(-1)?.[0]

beforeEach(() => {
  jest.mocked(safeBack).mockClear()
  jest.mocked(usePreventRemove).mockClear()
})

describe('backing out around the end of a round', () => {
  it('leaves without asking once the round is over', async () => {
    const rendered = await renderHook(useRound, { initialProps: { phase: 'playing' as GamePhase } })
    expect(backHeld()).toBe(true)

    await rendered.rerender({ phase: 'roundOver' })
    expect(backHeld()).toBe(false)
    await act(async () => rendered.result.current.requestBack())
    expect(rendered.result.current.confirmVisible).toBe(false)
    expect(safeBack).toHaveBeenCalledTimes(1)
  })

  it('asks again once the next round starts', async () => {
    const rendered = await renderHook(useRound, { initialProps: { phase: 'roundOver' as GamePhase } })
    expect(backHeld()).toBe(false)

    await rendered.rerender({ phase: 'onboarding' })
    expect(backHeld()).toBe(true)
    await act(async () => rendered.result.current.requestBack())
    expect(rendered.result.current.confirmVisible).toBe(true)
    expect(safeBack).not.toHaveBeenCalled()
  })
})
