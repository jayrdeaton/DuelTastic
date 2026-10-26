import { computeGridSize, type Direction } from '@tastic/grid'
import { useCallback, useEffect, useRef, useState } from 'react'

import { TURF_MAX_CLOCK_STEP_MS } from './constants'
import { applyTurfCpu, type TurfCpuDifficulty, type TurfCpuPlan } from './cpu'
import { applyTurfActivation, applyTurfTurn, createTurfState, finishTurfOnTime, startTurf, tickTurf } from './engine'
import type { TurfLayout, TurfOptions, TurfSeat, TurfState } from './types'

export interface UseTurfStateParams {
  // The board's size in px, measured once when the round screen mounts.
  width: number
  height: number
  cellPx: number
  // Milliseconds per step, already scaled to cellPx.
  intervalMs: number
  layout: TurfLayout
  p1OnRight: boolean
  options: TurfOptions
  // Seat 2's CPU level, or null when seat 2 is a person.
  cpu: TurfCpuDifficulty | null
  // A dialog is up or the app is in the background: the steps and the clock both stop.
  paused: boolean
}

interface RoundState {
  round: TurfState
  // The CPU's current loop, kept next to the round so each step's update stays a plain function of
  // the previous state.
  plan: TurfCpuPlan | null
  // Round time played so far, for the clock.
  elapsedMs: number
}

// One Turf round on screen: the engine stepped on an animation-frame loop, the CPU's turn (and its
// powerup) decided right before each step it plays in, and the clock run alongside, ending the round
// when it's up.
export function useTurfState({ width, height, cellPx, intervalMs, layout, p1OnRight, options, cpu, paused }: UseTurfStateParams) {
  const fresh = useCallback((): RoundState => ({ round: createTurfState({ grid: computeGridSize(width, height, cellPx), layout, p1OnRight, arena: options.arena }), plan: null, elapsedMs: 0 }), [width, height, cellPx, layout, p1OnRight, options.arena])
  const [state, setState] = useState(fresh)

  const turn = useCallback((seat: TurfSeat, direction: Direction) => {
    setState((s) => ({ ...s, round: applyTurfTurn(s.round, seat, direction) }))
  }, [])

  // A person using their powerup (a tap or their powerup key).
  const activate = useCallback((seat: TurfSeat) => {
    setState((s) => ({ ...s, round: applyTurfActivation(s.round, seat) }))
  }, [])

  const beginPlaying = useCallback(() => {
    setState((s) => ({ ...s, round: startTurf(s.round) }))
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
      const dt = lastFrameRef.current === null ? 0 : Math.min(timestamp - lastFrameRef.current, TURF_MAX_CLOCK_STEP_MS)
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
            let { round, plan } = s
            if (shouldTick) {
              for (let i = 0; i < steps && round.phase === 'playing'; i++) {
                if (cpu) {
                  const decided = applyTurfCpu(round, 2, cpu, plan, options)
                  round = decided.state
                  plan = decided.plan
                }
                round = tickTurf(round, options)
              }
            }
            if (round.phase === 'playing' && nextElapsedMs >= roundMs) round = finishTurfOnTime(round)
            return { round, plan, elapsedMs: nextElapsedMs }
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
