import { readFileSync } from 'fs'
import { join } from 'path'

// LightCycles, Turf and Tag draw the same things the same way, from one piece each in
// src/shared/match/ and src/shared/BoardPowerups.tsx: a box or a gate is the same size and look in
// every game, an arena's walls are solid bars, effect rings sit the same distance off the head, and a
// crash is the same burst and wipe. Each board drew its own until 2026-11-04 (Tag's gates were a
// third the size of the others', its walls a string of beads, LightCycles' walls a ladder of cell
// outlines, Turf's crash a still ring), and this keeps them from drifting apart again.

const BOARDS = {
  lightcycles: join(__dirname, '..', 'games', 'lightcycles', 'components', 'GameBoard.tsx'),
  turf: join(__dirname, '..', 'games', 'turf', 'TurfBoard.tsx'),
  tag: join(__dirname, '..', 'games', 'tag', 'TagBoard.tsx')
}

const source = (game: keyof typeof BOARDS) => readFileSync(BOARDS[game], 'utf8')

describe("every board's shared pieces", () => {
  it.each(Object.keys(BOARDS) as (keyof typeof BOARDS)[])('%s draws its boxes, rings, gates, blocks, trail and head from the shared pieces', (game) => {
    const board = source(game)
    expect(board).toMatch(/<PickupGlyph\b/)
    expect(board).toMatch(/<EffectRings\b/)
    expect(board).toMatch(/<Gates\b/)
    expect(board).toMatch(/<ArenaBlocks\b/)
    expect(board).toMatch(/<RiderHead\b/)
    expect(board).toMatch(/\btrailPath\(/)
    // No board draws its own box, gate or block.
    expect(board).not.toMatch(/MysteryPickup|ObstacleRect|RoundedRect|addCircle/)
  })

  it.each(['lightcycles', 'turf'] as const)('%s crashes with the shared burst and wipe', (game) => {
    expect(source(game)).toMatch(/<RiderCrash\b/)
  })

  // Tag's bump and Turf's crash home leave a rider standing still for about a second, drawn the same
  // way in both (2026-11-04).
  it.each(['turf', 'tag'] as const)('%s draws a dazed rider with the shared stars', (game) => {
    expect(source(game)).toMatch(/<DazeStars\b/)
  })

  // The two games on the same fine cells draw the same size head (Turf's was half as big again).
  it.each(['lightcycles', 'turf'] as const)('%s sizes its head with the shared HEAD_RADIUS_CELLS', (game) => {
    expect(source(game)).toMatch(/cellPx \* HEAD_RADIUS_CELLS/)
  })
})
