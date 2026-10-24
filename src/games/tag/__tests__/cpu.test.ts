import type { Direction, GridCell } from '@tastic/grid'

import { applyTagCpu, chooseTagCpuMove, type TagCpuDifficulty } from '../cpu'
import { createTagState, startTag, tickTag } from '../engine'
import type { TagArena, TagSeat, TagState } from '../types'

// A small seeded random, so every run of these tests plays the same games.
function seeded(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// No wobble: only easy rolls, and 0.99 never lands under its chance.
const NO_WOBBLE = () => 0.99

interface Start {
  head: GridCell
  direction: Direction
}

function setup(p1: Start, p2: Start, { cols = 20, rows = 20, it = 2 as TagSeat, arena = 'open' as TagArena } = {}): TagState {
  return startTag(createTagState({ grid: { cols, rows }, layout: 'faceToFace', arena, it, starts: { 1: p1, 2: p2 } }))
}

describe('chooseTagCpuMove as It', () => {
  it('rides straight at the other rider', () => {
    const s = setup({ head: { x: 10, y: 15 }, direction: 'right' }, { head: { x: 4, y: 15 }, direction: 'up' })
    expect(chooseTagCpuMove(s, 2, 'normal', NO_WOBBLE)).toBe('right')
  })

  it('goes round a pillar rather than into it', () => {
    const s0 = setup({ head: { x: 0, y: 19 }, direction: 'up' }, { head: { x: 19, y: 0 }, direction: 'up' }, { arena: 'pillars' })
    const pillar = s0.pillars[0]
    // It right above the pillar, the other rider right below it.
    const s: TagState = { ...s0, players: { 1: { ...s0.players[1], head: { x: pillar.x, y: pillar.y + pillar.height } }, 2: { ...s0.players[2], head: { x: pillar.x, y: pillar.y - 1 }, direction: 'down' } } }
    expect(['left', 'right']).toContain(chooseTagCpuMove(s, 2, 'hard', NO_WOBBLE))
  })

  it('cuts the other rider off on hard, chasing where they are on easy', () => {
    // The other rider is crossing above, heading right: easy turns up at them, hard keeps on right to
    // meet them further along.
    const s = setup({ head: { x: 10, y: 5 }, direction: 'right' }, { head: { x: 10, y: 9 }, direction: 'right' })
    expect(chooseTagCpuMove(s, 2, 'easy', NO_WOBBLE)).toBe('up')
    expect(chooseTagCpuMove(s, 2, 'hard', NO_WOBBLE)).toBe('right')
  })
})

describe('chooseTagCpuMove running', () => {
  it('turns away from It', () => {
    const s = setup({ head: { x: 10, y: 10 }, direction: 'right' }, { head: { x: 15, y: 10 }, direction: 'left' }, { it: 2 })
    expect(chooseTagCpuMove(s, 1, 'hard', NO_WOBBLE)).not.toBe('right')
  })

  it('doesn’t run itself into a corner on normal and hard (easy does)', () => {
    // Up the left edge toward the top corner, It closing in along the second row.
    const s = setup({ head: { x: 0, y: 1 }, direction: 'up' }, { head: { x: 4, y: 1 }, direction: 'left' })
    expect(chooseTagCpuMove(s, 1, 'easy', NO_WOBBLE)).toBe('up')
    expect(chooseTagCpuMove(s, 1, 'normal', NO_WOBBLE)).toBe('down')
    expect(chooseTagCpuMove(s, 1, 'hard', NO_WOBBLE)).toBe('down')
  })
})

describe('applyTagCpu', () => {
  it('queues its heading', () => {
    const s = setup({ head: { x: 10, y: 15 }, direction: 'right' }, { head: { x: 4, y: 15 }, direction: 'up' })
    expect(applyTagCpu(s, 2, 'normal', NO_WOBBLE).players[2].pendingDirection).toBe('right')
  })

  it('does nothing before the round starts', () => {
    const s = createTagState({ grid: { cols: 20, rows: 20 }, layout: 'faceToFace' })
    expect(applyTagCpu(s, 2, 'hard')).toBe(s)
  })
})

// Ticks for `chaser` (always It) to catch `runner` from the start, averaged over seeded games on a
// phone-size board with pillars.
function chaseTicks(runner: TagCpuDifficulty, chaser: TagCpuDifficulty): number {
  let total = 0
  let caught = 0
  for (let seed = 1; seed <= 6; seed++) {
    const random = seeded(seed)
    const fresh = startTag(createTagState({ grid: { cols: 17, rows: 38 }, layout: 'faceToFace', arena: 'pillars', it: 2 }))
    let s = fresh
    let since = 0
    for (let i = 0; i < 600; i++) {
      s = tickTag(applyTagCpu(applyTagCpu(s, 1, runner, random), 2, chaser, random))
      since++
      if (s.events.tagged) {
        total += since
        caught++
        since = 0
        s = fresh
      }
    }
  }
  return total / caught
}

describe('the difficulty levels', () => {
  it('lets a hard runner last longer than an easy one, and a hard It catch sooner than an easy one', () => {
    expect(chaseTicks('hard', 'normal')).toBeGreaterThan(chaseTicks('easy', 'normal'))
    expect(chaseTicks('normal', 'hard')).toBeLessThan(chaseTicks('normal', 'easy'))
  })

  it('keeps the tags coming: a catch every few seconds, not never', () => {
    // About 9 ticks a second at the normal speed.
    expect(chaseTicks('hard', 'easy')).toBeLessThan(9 * 30)
    expect(chaseTicks('easy', 'hard')).toBeGreaterThan(9 * 2)
  })
})
