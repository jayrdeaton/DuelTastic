import { computeGridSize, type Direction } from '@tastic/grid'
import { useCallback, useEffect, useRef, useState } from 'react'

import { TAG_MAX_CLOCK_STEP_MS } from './constants'
import { applyTagCpu, type TagCpuDifficulty } from './cpu'
import { applyTagActivation, applyTagTurn, createTagState, finishTagOnTime, startTag, tickTag } from './engine'
import type { TagEvents, TagLayout, TagOptions, TagSeat, TagState } from './types'

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

// One Tag round on screen: the engine played a little every frame by elapsed time (so its pace
// doesn't depend on the display's refresh rate, and each rider steps on its own clock), the CPU's
// turn (and its powerup) decided at the start of each tick, and the clock run alongside, ending the
// round when it's up.
export function useTagState({ width, height, cellPx, intervalMs, layout, p1OnRight, options, startingIt, cpu, paused }: UseTagStateParams) {
  const fresh = useCallback((): RoundState => ({ round: createTagState({ grid: computeGridSize(width, height, cellPx), layout, p1OnRight, arena: options.arena, it: startingIt }), elapsedMs: 0 }), [width, height, cellPx, layout, p1OnRight, options.arena, startingIt])
  const [state, setState] = useState(fresh)
  // The round as played: the frame loop moves the riders' strides on every frame, but React only
  // gets a new state when something on screen changes (a step, a tick, the clock's second).
  const liveRef = useRef(state)
  const commit = useCallback((next: RoundState) => {
    liveRef.current = next
    setState(next)
  }, [])
  const update = useCallback(
    (change: (round: TagState) => TagState) => {
      const live = liveRef.current
      const round = change(live.round)
      if (round !== live.round) commit({ ...live, round })
    },
    [commit]
  )

  const turn = useCallback((seat: TagSeat, direction: Direction) => update((round) => applyTagTurn(round, seat, direction)), [update])

  // A person using their powerup (a tap or their powerup key).
  const activate = useCallback((seat: TagSeat) => update((round) => applyTagActivation(round, seat)), [update])

  const beginPlaying = useCallback(() => update(startTag), [update])

  const rematch = useCallback(() => commit(fresh()), [commit, fresh])

  const phase = state.round.phase
  useEffect(() => {
    if (phase !== 'playing' || paused) return
    let active = true
    let frame: number | null = null
    let lastFrame: number | null = null
    const roundMs = options.roundSeconds * 1000

    const loop = (timestamp: number) => {
      if (!active) return
      const dt = lastFrame === null ? 0 : Math.min(timestamp - lastFrame, TAG_MAX_CLOCK_STEP_MS)
      lastFrame = timestamp
      if (dt > 0) {
        const live = liveRef.current
        const elapsedMs = Math.min(roundMs, live.elapsedMs + dt)
        let round = live.round
        const events: TagEvents = { tagged: null, blocked: [], collected: [] }
        let left = dt / intervalMs
        // A tick at a time, so the CPU decides at the start of each one.
        while (left > 0 && round.phase === 'playing') {
          if (cpu && round.sinceTick === 0) round = applyTagCpu(round, 2, cpu)
          const part = Math.min(left, 1 - round.sinceTick)
          round = tickTag(round, options.powerups, Math.random, part)
          left -= part
          if (round.events.tagged !== null) events.tagged = round.events.tagged
          for (const seat of round.events.blocked) if (!events.blocked.includes(seat)) events.blocked.push(seat)
          events.collected.push(...round.events.collected)
        }
        round = { ...round, events }
        if (round.phase === 'playing' && elapsedMs >= roundMs) round = finishTagOnTime(round, options.rule)
        const next = { round, elapsedMs }
        const was = live.round
        const shown = round.phase !== was.phase || round.tick !== was.tick || round.it !== was.it || round.pickups !== was.pickups || round.players[1].recent !== was.players[1].recent || round.players[2].recent !== was.players[2].recent || Math.ceil((roundMs - elapsedMs) / 1000) !== Math.ceil((roundMs - live.elapsedMs) / 1000)
        if (shown) commit(next)
        else liveRef.current = next
      }
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => {
      active = false
      if (frame !== null) cancelAnimationFrame(frame)
    }
  }, [phase, paused, intervalMs, options, cpu, commit])

  const timeLeftMs = Math.max(0, options.roundSeconds * 1000 - state.elapsedMs)
  return { state: state.round, turn, activate, beginPlaying, rematch, timeLeftMs }
}
