import { computeGridSize, type Direction } from '@tastic/grid'
import { useCallback, useEffect, useRef, useState } from 'react'

import { TAG_MAX_CLOCK_STEP_MS } from './constants'
import { applyTagCpu, type TagCpuDifficulty } from './cpu'
import { applyTagActivation, applyTagTurn, createTagState, finishTagOnTime, startTag, tickTag } from './engine'
import type { TagLayout, TagOptions, TagSeat, TagState } from './types'

export interface UseTagStateParams {
  // The board's size in px, measured once when the round screen mounts.
  width: number
  height: number
  cellPx: number
  // Milliseconds per step.
  intervalMs: number
  layout: TagLayout
  p1OnRight: boolean
  options: TagOptions
  // Who starts the next round as It (the round screen takes turns).
  startingIt: TagSeat
  // Seat 2's CPU level, or null when seat 2 is a person.
  cpu: TagCpuDifficulty | null
  // A dialog is up or the app is in the background: the steps and the clock both stop.
  paused: boolean
}

interface RoundState {
  round: TagState
  // Round time played so far, for the clock.
  elapsedMs: number
}

// One Tag round on screen: the engine stepped on an animation-frame loop by elapsed time (so its pace
// doesn't depend on the display's refresh rate), the CPU's turn (and its powerup) decided right
// before each step, and the clock run alongside, ending the round when it's up.
export function useTagState({ width, height, cellPx, intervalMs, layout, p1OnRight, options, startingIt, cpu, paused }: UseTagStateParams) {
  const fresh = useCallback((): RoundState => ({ round: createTagState({ grid: computeGridSize(width, height, cellPx), layout, p1OnRight, arena: options.arena, it: startingIt }), elapsedMs: 0 }), [width, height, cellPx, layout, p1OnRight, options.arena, startingIt])
  const [state, setState] = useState(fresh)

  const turn = useCallback((seat: TagSeat, direction: Direction) => {
    setState((s) => ({ ...s, round: applyTagTurn(s.round, seat, direction) }))
  }, [])

  // A person using their powerup (a tap or their powerup key).
  const activate = useCallback((seat: TagSeat) => {
    setState((s) => ({ ...s, round: applyTagActivation(s.round, seat) }))
  }, [])

  const beginPlaying = useCallback(() => {
    setState((s) => ({ ...s, round: startTag(s.round) }))
  }, [])

  const rematch = useCallback(() => setState(fresh()), [fresh])

  const phase = state.round.phase
  const lastFrameRef = useRef<number | null>(null)
  const sinceStepRef = useRef(0)
  const elapsedRef = useRef(0)
  useEffect(() => {
    elapsedRef.current = state.elapsedMs
  }, [state.elapsedMs])

  useEffect(() => {
    if (phase !== 'playing' || paused) return
    let active = true
    let frame: number | null = null
    lastFrameRef.current = null
    const roundMs = options.roundSeconds * 1000

    const loop = (timestamp: number) => {
      if (!active) return
      const dt = lastFrameRef.current === null ? 0 : Math.min(timestamp - lastFrameRef.current, TAG_MAX_CLOCK_STEP_MS)
      lastFrameRef.current = timestamp
      sinceStepRef.current += dt
      const steps = Math.floor(sinceStepRef.current / intervalMs)
      sinceStepRef.current -= steps * intervalMs
      if (dt > 0) {
        const prevElapsedMs = elapsedRef.current
        const nextElapsedMs = Math.min(roundMs, prevElapsedMs + dt)
        elapsedRef.current = nextElapsedMs
        const prevLeft = Math.ceil((roundMs - prevElapsedMs) / 1000)
        const nextLeft = Math.ceil((roundMs - nextElapsedMs) / 1000)
        const shouldTick = steps > 0
        const shouldUpdateClock = nextLeft !== prevLeft
        const shouldFinishOnTime = prevElapsedMs < roundMs && nextElapsedMs >= roundMs
        if (shouldTick || shouldUpdateClock || shouldFinishOnTime) {
          setState((s) => {
            let { round } = s
            if (shouldTick) {
              for (let i = 0; i < steps && round.phase === 'playing'; i++) {
                if (cpu) round = applyTagCpu(round, 2, cpu)
                round = tickTag(round, options.powerups)
              }
            }
            if (round.phase === 'playing' && nextElapsedMs >= roundMs) round = finishTagOnTime(round, options.rule)
            return { round, elapsedMs: nextElapsedMs }
          })
        }
      }
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => {
      active = false
      if (frame !== null) cancelAnimationFrame(frame)
    }
  }, [phase, paused, intervalMs, options, cpu])

  const timeLeftMs = Math.max(0, options.roundSeconds * 1000 - state.elapsedMs)
  return { state: state.round, turn, activate, beginPlaying, rematch, timeLeftMs }
}
