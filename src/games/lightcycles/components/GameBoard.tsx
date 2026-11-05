import { Canvas, Line, Path, Skia, vec } from '@shopify/react-native-skia'
import { cellKey, cellToPixel } from '@tastic/grid'
import { useEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Easing, useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated'

import { MIN_TRAIL_LENGTH_BEFORE_TRIM, TRAIL_SEVER_EAT_MAX_MS, TRAIL_SEVER_EAT_MIN_MS, TRAIL_SEVER_EAT_MS_PER_CELL } from '@/games/lightcycles/constants/game'
import { GamePhase, GridCell, GridSize, OrientationMode, Player, PlayerEffects, PlayerState, Portal, PowerupPickup, SpeedEffect, Tunnel } from '@/games/lightcycles/types'
import { shouldTrimTrailAt, stepsFor } from '@/games/lightcycles/utils/gameEngine'
import { EffectRings, PickupGlyph } from '@/shared/BoardPowerups'
import { ArenaBlocks } from '@/shared/match/ArenaBlocks'
import { Gates } from '@/shared/match/Gates'
import { partialTrailPath, RiderCrash } from '@/shared/match/RiderCrash'
import { RiderHead } from '@/shared/match/RiderHead'
import { HEAD_RADIUS_CELLS } from '@/shared/match/riderSkin'
import { SplitWalls } from '@/shared/match/SplitWalls'
import { leadingTrailPath, trailPath } from '@/shared/match/trailPath'
import { TunnelRoad } from '@/shared/match/TunnelRoad'
import { GLIDE_OVERLAP_MS, useRiderGlide } from '@/shared/match/useRiderGlide'
import type { Effects, SpeedKind } from '@/shared/powerups'

export interface GameBoardProps {
  players: Record<Player, PlayerState>
  phase: GamePhase
  tickIntervalMs: number
  cellPx: number
  grid: GridSize
  orientationMode: OrientationMode
  // Only meaningful when orientationMode === 'sideBySide' - see useOrientationState and
  // TouchInputLayer.tsx's identical prop.
  p1OnRight: boolean
  // Ticks elapsed this round - see GameState's own comment. Drives PlayerTrail's tail creep
  // instead of trail.length, which a laggy trailSpeedTier can leave unchanged on a tick that both
  // grows and trims the trail, and 0 holds the head on its starting cell for a new round.
  tick: number
  pickups: PowerupPickup[]
  // The app theme's tertiary color - pickups render in this, distinct from either player's own
  // primary/secondary trail color, so a glyph never gets mistaken for either player's own head.
  pickupColor: string
  // Static per-round obstacle layout (see GameState's own comment) - drawn by ArenaBlocks.
  obstacles: GridCell[]
  // The app theme's outline color - distinct from primary/secondary/tertiary, so obstacle geometry
  // reads as inert board structure rather than being mistaken for either player's trail or a pickup.
  obstacleColor: string
  // Static per-round portal pairs (see GameState's own comment) - drawn by Gates. Reuses
  // obstacleColor rather than a dedicated prop: like obstacles, a portal is static per-round board
  // structure, not per-player state or a pickup, so the same "inert board structure" color reads
  // correctly for it too - shape (rings vs. solid blocks) is what tells them apart.
  portals: Portal[]
  // Static per-round tunnel corridor (see GameState's own comment) - rendered by Tunnels below, and
  // fed into PlayerTrail so it can highlight each player's own underground segments. Also reuses
  // obstacleColor, same reasoning as `portals` above.
  tunnels: Tunnel[]
  // The resolved TRAIL_SPEED_RATE number for the active trailSpeedTier (see constants/game.ts) -
  // lets PlayerTrail interpolate the tail's position continuously between trims instead of holding
  // still and then snapping a whole cell forward. Passed as the raw rate, not the tier, so this
  // component stays as decoupled from the tier enum as gameEngine.ts's own tickGame already is.
  trailSpeedRate: number
  // Per-round Settings.wrapEdges - see that field's own comment. Hides Walls below entirely:
  // the boundary outline promises "this edge is fatal," which stops being true once wrap is on.
  wrapEdges: boolean
}

function cellCenter(cell: GridCell, cellPx: number) {
  const { x, y } = cellToPixel(cell, cellPx)
  return { x: x + cellPx / 2, y: y + cellPx / 2 }
}

// Thin on purpose - this is a boundary marker, not a trail, and shouldn't compete with the
// trails/heads for visual weight. Flat rather than scaled with cellPx, like the head's ring
// (riderSkin.ts).
const WALL_STROKE_WIDTH = 1.5
const TRAIL_OPACITY = 1

// Every game's mystery box (BoardPowerups' PickupGlyph). The arena's blocks and gates are every
// game's too (ArenaBlocks, Gates).
function Powerups({ pickups, cellPx, color }: { pickups: PowerupPickup[]; cellPx: number; color: string }) {
  return (
    <>
      {pickups.map((pu) => (
        <PickupGlyph key={pu.id} pickup={pu} cellPx={cellPx} color={color} />
      ))}
    </>
  )
}

// The shared road (TunnelRoad), in the same WALL_STROKE_WIDTH stroke Walls use.
function Tunnels({ tunnels, cellPx, color }: { tunnels: Tunnel[]; cellPx: number; color: string }) {
  return (
    <>
      {tunnels.map((tunnel) => (
        <TunnelRoad key={cellKey(tunnel.cells[0])} tunnel={tunnel} cellPx={cellPx} color={color} strokeWidth={WALL_STROKE_WIDTH} />
      ))}
    </>
  )
}

function Walls({ grid, cellPx, orientationMode, p1OnRight, players, phase, wrapEdges }: { grid: GridSize; cellPx: number; orientationMode: OrientationMode; p1OnRight: boolean; players: Record<Player, PlayerState>; phase: GamePhase; wrapEdges: boolean }) {
  // Hidden during the onboarding countdown - the boundary marker is only meaningful once a round
  // is actually live, and it visually clutters the countdown's own player-zone overlay. Hidden for
  // the whole round under wrapEdges - see GameBoardProps' own comment on that prop.
  if (phase === 'onboarding' || wrapEdges) return null

  return <SplitWalls grid={grid} cellPx={cellPx} orientationMode={orientationMode} p1OnRight={p1OnRight} colors={{ 1: players[1].color, 2: players[2].color }} strokeWidth={WALL_STROKE_WIDTH} />
}

// How far the tail should have visually crept from trail[0] toward trail[1] as of `tick`, as a
// fraction in [0, 1] - reaching exactly 1 on the last tick before gameEngine.ts's own
// shouldTrimTrailAt actually fires the next trim, whatever tick that turns out to be, rather than
// assuming every trim cycle is the same length. `growthRate` isn't a clean "N ticks per trim"
// rate (see TRAIL_SPEED_RATE) - shouldTrimTrailAt's own comment notes it holds the average
// exactly, which it does by spacing individual trims unevenly (e.g. 'fast' fires three trims back
// to back, then skips a tick) - so a formula that assumed a fixed-length cycle (the previous
// version here just took the fractional part of `tick * (1 - growthRate)`) fell short of 1 by a
// wide margin on the short end of that unevenness: 'fast' could leave a whole 0.75 of a cell
// un-crept the instant a trim landed, since tailEdgeEnd (nextCenter, below) jumps to the fresh
// exact cell the moment the real trim happens regardless of how far this got. The visible result
// was the very tail tip appearing to hang a noticeable fraction of a cell *behind* trail[0]'s own
// current position right after every trim (most of a cell on 'fast'), snapping forward to catch
// up, then falling behind again next trim - reading as the tip being slightly detached from the
// rest of the trail rather than a clean continuation of it. Walking the *actual* schedule instead
// (both directions, via the exact same shouldTrimTrailAt the engine trims with, so this can never
// silently drift out of sync with it) fixes that: whatever tick the current cell became the tail
// (`segmentStart`, itself if this tick just trimmed) and whatever tick it next will
// (`nextTrimTick`), progress is this tick's position within *that* span - 1 on the tick right
// before nextTrimTick, however long or short the span actually is. `trailLength` mirrors
// gameEngine.ts's own MIN_TRAIL_LENGTH_BEFORE_TRIM gate on the trim itself - without it this
// would compute a nonzero creep purely from elapsed ticks even during the grace period where the
// trail isn't actually being trimmed yet, visually detaching the tail from trail[0] before any
// cell has really been removed.
function tailProgress(tick: number, growthRate: number, trailLength: number): number {
  if (growthRate >= 1 || trailLength <= MIN_TRAIL_LENGTH_BEFORE_TRIM) return 0
  let nextTrimTick = tick + 1
  while (!shouldTrimTrailAt(nextTrimTick, growthRate)) nextTrimTick++
  let segmentStart = tick
  while (segmentStart > 0 && !shouldTrimTrailAt(segmentStart, growthRate)) segmentStart--
  return (tick - segmentStart + 1) / (nextTrimTick - segmentStart)
}

// The underground portion of a player's own trail, as a separate Skia path rendered underneath the
// normal trail so both players can see at a glance which segments are "safe crossings" that don't
// block surface traffic (see gameEngine.ts's tickGame). Structurally identical to trailPath above,
// just filtered to tunnel-member runs instead of walking the whole trail - breaks to a fresh
// subpath at any non-member gap. Never needs trailPath's own isAdjacent branching: tunnel traversal
// is always a chain of geometrically adjacent steps (unlike a portal jump), so consecutive
// tunnel-member cells are always genuinely adjacent here too.
function tunnelHighlightPath(trail: PlayerState['trail'], tunnelCellSet: ReadonlySet<string>, cellPx: number) {
  const path = Skia.PathBuilder.Make()
  let drawing = false
  for (const cell of trail) {
    const isMember = tunnelCellSet.has(cellKey(cell))
    if (!isMember) {
      drawing = false
      continue
    }
    const { x, y } = cellCenter(cell, cellPx)
    if (drawing) path.lineTo(x, y)
    else {
      path.moveTo(x, y)
      drawing = true
    }
  }
  return path.detach()
}

// LightCycles' speed effects in the shared kinds, so its rings are every game's (BoardPowerups'
// EffectRings): Overdrive a boost, Stasis a freeze, Overclock a rush, Hack a reverse.
const SPEED_KINDS: Record<SpeedEffect['type'], SpeedKind> = { overdrive: 'boost', stasis: 'freeze', overclock: 'rush' }
function sharedEffects({ speed, control, shield }: PlayerEffects): Effects {
  return { speed: speed && { kind: SPEED_KINDS[speed.type], expiresAtTick: speed.expiresAtTick }, reverse: control, shield }
}

function PlayerTrail({ player, tickIntervalMs, cellPx, tick, trailSpeedRate, tunnelCellSet }: { player: PlayerState; tickIntervalMs: number; cellPx: number; tick: number; trailSpeedRate: number; tunnelCellSet: ReadonlySet<string> }) {
  // Nearly fill their own cell on purpose - combined with a small cellPx (see constants/game.ts's
  // GRID_CELL_PX), this makes the actual hit-detection boundary obvious at a glance: a trail or head
  // reads as occupying essentially the whole cell it's in, so a one-cell gap between two trails
  // looks (and is) a real, precise near-miss rather than a vague blob-to-blob distance.
  const trailWidth = cellPx * 0.85
  const headRadius = cellPx * HEAD_RADIUS_CELLS

  const trail = player.trail
  const head = cellCenter(trail[trail.length - 1], cellPx)
  const tail = cellCenter(trail[0], cellPx)
  // trail[1] doubles as two different things below: the fixed far end of the tail's own segment
  // (once the trail is long enough that it's a distinct cell from the head), and the "next" cell
  // the tail creeps toward between trims (see tailTarget below). Falls back to trail[0] itself -
  // same as trail[1] would equal once trimmed all the way down - when there's nothing else yet.
  const nextCell = trail.length > 1 ? trail[1] : trail[0]
  const nextCenter = cellCenter(nextCell, cellPx)
  // Continuously interpolated toward nextCenter (see tailProgress) rather than snapping straight to
  // `tail` - the fractional creep between trims, not just the trims themselves, is what needs to
  // animate for the tail to read as *following* rather than holding still and then hopping.
  const progress = tailProgress(tick, trailSpeedRate, trail.length)
  const tailTarget = { x: tail.x + (nextCenter.x - tail.x) * progress, y: tail.y + (nextCenter.y - tail.y) * progress }

  // The head glides from cell to cell at the rider's own pace, as in every game (useRiderGlide): the
  // rider's own time for the cells it rode (two a tick under Overdrive or Overclock), keyed on its own
  // steps, and round a corner rather than across it. A gate or a wrap round the edge is a jump, and a
  // new round (tick 0) holds it on its starting cell. It used to glide over the time since the last
  // tick, which lands on a frame: at the small grid size (about 2.5 frames a cell) a glide either
  // finished early and stood still or was cut short and sped up, as Turf's did (CLAUDE.md, "Smooth
  // riders in Turf and Tag").
  const msPerCell = tickIntervalMs / (stepsFor(player.effects) || 1)
  const { x: animX, y: animY } = useRiderGlide({ path: trail, cellPx, msPerCell, snap: tick === 0 })
  // The tail end creeps too: under a laggy trailSpeedTier (see gameEngine.ts's shouldTrimTrailAt) it
  // also advances, and snapping it forward a whole cell on every trim tick read as janky as the head
  // snapping did before it glided.
  const tailAnimX = useSharedValue(tail.x)
  const tailAnimY = useSharedValue(tail.y)
  // The chain of cells a Prune or Shield break-through just severed from the front, ordered from
  // the break point (nearest the surviving trail) to the old tail (farthest) - see the severed-eat
  // effect and severedPath below. Grid coordinates, not pixels, so cellPx changing (it never does
  // mid-round, but nothing here should assume that) wouldn't desync it. Plain objects rather than
  // GridCell[] directly only because a shared value's contents need to be worklet-safe/serializable.
  const severedCells = useSharedValue<{ x: number; y: number }[]>([])
  // 0 = the full severed chain still visible, 1 = fully eaten away - see severedPath, which draws
  // only the suffix of severedCells still "ahead of" this progress. Starts at 1 (nothing to show)
  // rather than 0, so an idle trail with no severed segment yet doesn't render one.
  const severedProgress = useSharedValue(1)

  useEffect(() => {
    if (tick === 0) {
      // First paint, or a fresh round via rematch - GameState.tick resets to 0 on every new round
      // (see createInitialGameState), which is what actually distinguishes this from a real tick:
      // rematch resets game *state* but doesn't remount this component. Jump straight to the
      // starting cell instead of creeping there from wherever the previous round ended.
      tailAnimX.value = tailTarget.x
      tailAnimY.value = tailTarget.y
      // A break's own eat-away can still be mid-flight the instant its round ends (see the
      // severed-eat effect's own comment on why that's fine to just let vanish) - clear it here so
      // a rematch's fresh trail doesn't inherit a stale, unrelated severed segment left over from
      // wherever the previous round's animation happened to stop.
      severedCells.value = []
      severedProgress.value = 1
      return
    }
    // Over the tick's own time plus the head's glide overlap (useRiderGlide), so the creep is still
    // under way when the next tick lands rather than stopping and setting off again. Targets
    // tailTarget (the fractional creep toward nextCenter - see tailProgress), not `tail` itself, so
    // this animates every tick under a non-static tier, not only the ones that trim a whole cell off.
    const duration = tickIntervalMs + GLIDE_OVERLAP_MS
    tailAnimX.value = withTiming(tailTarget.x, { duration, easing: Easing.linear })
    tailAnimY.value = withTiming(tailTarget.y, { duration, easing: Easing.linear })
    // Only an actual new tick should retrigger this - tickIntervalMs changing mid-creep (speed ramp)
    // should finish the current creep at its original pace, not restart it. Keyed on `tick` rather
    // than trail.length: under a laggy trailSpeedTier, a tick that both appends and trims the trail
    // leaves its length unchanged, which would otherwise silently skip it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick])

  // Detects a Prune/Shield-break severing more than one cell off the trail's front in one go, and
  // kicks off severedPath's eat-away for exactly that chain of cells. Compares against the trail
  // this component saw on its OWN last run (a plain ref is fine here - read and written only
  // inside this effect, never during render) rather than trail.length, which can't tell "1 cell
  // trimmed" from "40 cells severed" and wouldn't have the actual cut cells to animate through
  // anyway. Keyed on `trail` itself, not `tick`: a Prune activation (see useGameState.ts's
  // `activate`) trims the trail independent of the tick loop entirely, so gating this on `tick`
  // the way the glide effect above does would miss it until the next real tick happened to land.
  const prevTrailRef = useRef(trail)
  useEffect(() => {
    const prevTrail = prevTrailRef.current
    prevTrailRef.current = trail
    const newFront = trail[0]
    const cutIndex = prevTrail.findIndex((c) => c.x === newFront.x && c.y === newFront.y)
    // 0 = nothing cut. 1 = the routine single-cell growth-tier trim, already handled smoothly by
    // tailProgress/tailAnimX above - no jump to fix there. -1 = no relation at all to the previous
    // trail (a fresh round's spawn cell vs. the last round's final trail), which this same check
    // conveniently also skips correctly with no separate tick===0 case needed.
    if (cutIndex <= 1) return
    // Order: index 0 nearest the break (surviving trail), last index the old tail - the direction
    // severedPath actually eats through, matching where a player's eye is already looking (the
    // break just happened right there) rather than starting from the far, unwatched tail end.
    const removedCells = prevTrail.slice(0, cutIndex).reverse()
    const duration = Math.min(TRAIL_SEVER_EAT_MAX_MS, Math.max(TRAIL_SEVER_EAT_MIN_MS, removedCells.length * TRAIL_SEVER_EAT_MS_PER_CELL))
    // The surviving tail is now at `tail` (trail[0], post-break) - snapped instantly rather than
    // animated there, since the severed segment below is what now carries the "something just
    // happened" visual. Without this, the tick effect's own withTiming (see above - it runs first
    // within the same commit on a Shield break, which is tick-synchronized; this effect's plain
    // assignment overrides it, the last write in a commit winning) would glide tailAnimX/Y from
    // wherever it was toward the new, generally
    // non-adjacent `tail` in a straight pixel-space line - the exact diagonal this whole mechanism
    // exists to get rid of. Fresh fractional creep toward the new nextCenter (see tailTarget)
    // resumes correctly from here on subsequent ticks with no special-casing needed.
    //
    // react-hooks/immutability doesn't recognize Reanimated's SharedValue as the deliberate,
    // React-Compiler-exempt mutable escape hatch it is - every .value assignment in this file
    // (tailAnimX above included) has this identical shape, and this project
    // doesn't run the React Compiler itself (see eslint.config.cjs, where the rule is 'warn'-only
    // for exactly this reason: a heads-up for a future migration, not an enforced constraint now).
    /* eslint-disable react-hooks/immutability */
    severedCells.value = removedCells.map((c) => ({ x: c.x, y: c.y }))
    severedProgress.value = 0
    severedProgress.value = withTiming(1, { duration, easing: Easing.linear })
    tailAnimX.value = tail.x
    tailAnimY.value = tail.y
    /* eslint-enable react-hooks/immutability */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trail])

  // The severed chain's currently-visible suffix, as a Skia path - see partialTrailPath's own
  // comment for the interpolation technique. Renders nothing (Skia strokes an empty/1-point path as
  // nothing) once fully eaten, or when there's no severed segment at all - the idle default.
  const severedPath = useDerivedValue(() => partialTrailPath(severedCells.value, severedProgress.value, cellPx))

  // This player's own underground segments - see tunnelHighlightPath's own comment. A plain useMemo
  // (not a shared value/worklet) is enough: unlike the death/sever animations above, there's nothing
  // here that needs to animate frame-by-frame, only to update when the trail itself changes.
  const tunnelPath = useMemo(() => tunnelHighlightPath(trail, tunnelCellSet, cellPx), [trail, tunnelCellSet, cellPx])

  // `anchorCell` is where the head stood BEFORE its most recent move, as a GRID cell - matching
  // `trail`'s own element type, not `head`'s pixel one, since boundaryIndex below searches for it
  // WITHIN `trail`; comparing pixel coordinates against grid ones there would never match at all.
  // `prevHeadCell` is scratch state purely for detecting the transition; `anchorCell` is the actual
  // payload, captured from `prevHeadCell`'s OLD value in the SAME render-phase update that advances
  // `prevHeadCell` to the new head cell. This two-state split is required, not stylistic: React's
  // "adjusting state during render" pattern (see
  // https://react.dev/reference/react/useState#storing-information-from-previous-renders, the
  // `trend`-derived-from-`prevCount` example) immediately re-invokes this component once
  // `prevHeadCell` is updated, and `prevHeadCell` reads as the NEW head cell from that very
  // re-invocation onward - a single `prevHeadCell` state, read anywhere outside this `if`, would
  // desync by exactly one head-move, always resolving to the head's own index and quietly breaking
  // the animated bridge to it. A ref would have the identical problem this pattern exists to avoid,
  // plus reading it during render is unsafe (and lint-forbidden) under concurrent rendering; an
  // effect-based update would land one render late, after `trail` had already moved on to yet
  // another tick's data.
  const headCell = trail[trail.length - 1]
  const [prevHeadCell, setPrevHeadCell] = useState(headCell)
  const [anchorCell, setAnchorCell] = useState(headCell)
  if (headCell.x !== prevHeadCell.x || headCell.y !== prevHeadCell.y) {
    setAnchorCell(prevHeadCell)
    setPrevHeadCell(headCell)
  }
  // Index of anchorCell within the CURRENT trail array - the trail's front's fixed anchor
  // (settledPath below stops there; everything past it is this tick's own new movement, drawn by
  // leadPath up to wherever the gliding head has got). Re-looked-up fresh every render, rather than
  // cached as an index alongside anchorCell, so it stays correct even when the trail's FRONT also
  // shifted since anchorCell was captured - a Prune/Shield severing cells off the front (see the
  // severed-eat effect below) can land on any render, not just the ones where the head itself also
  // happens to move, and a cached index would silently point at whatever cell now sits at that
  // position instead of at anchorCell's actual, possibly-shifted one. Not found (anchorCell itself
  // got severed away, or a fresh round's spawn cell has no relation to the last round's final trail)
  // counts only the head's own cell as new movement, so settledPath still draws the rest.
  const foundIndex = trail.findIndex((c) => c.x === anchorCell.x && c.y === anchorCell.y)
  const boundaryIndex = foundIndex === -1 ? Math.max(0, trail.length - 2) : foundIndex

  // The trail's front is drawn live from the cell before anchorCell (leadStart): a head still
  // catching up to anchorCell when the next step lands (useRiderGlide's catch-up leg, up to a cell
  // after a stalled frame) is on that last run, and a settled trail drawn up to anchorCell would run
  // ahead of it.
  const leadStart = Math.max(0, boundaryIndex - 1)
  // Every settled cell except the first and the ones the front is drawn through (the tail's creep
  // and leadPath below draw those live, so both ends glide into place rather than snapping).
  const settledPath = useMemo(() => trailPath(trail.slice(1, leadStart + 1), cellPx), [trail, cellPx, leadStart])

  // The trail's front: from leadStart through anchorCell and this tick's new cells as far as the
  // gliding head has got, then on to the head (leadingTrailPath), so it follows the head round a
  // corner and through a boosted tick's two cells instead of cutting across them, and never runs
  // ahead of the head.
  const leadCells = useMemo(() => trail.slice(leadStart).map((c) => ({ x: c.x, y: c.y })), [trail, leadStart])
  const leadPath = useDerivedValue(() => leadingTrailPath(leadCells, animX.value, animY.value, cellPx))

  const tailEdgeStart = useDerivedValue(() => vec(tailAnimX.value, tailAnimY.value))
  // trail[1] (nextCell/nextCenter, computed above) IS the head itself once the trail's down to two
  // cells or less - early in a round, before the trail has grown past a couple of cells - so there's
  // nothing between the tail and the head to be a distinct fixed point. The segment's far end follows
  // the gliding head there (the same live position the head marker itself uses), or it would reach
  // the head's cell before the head had visually arrived, poking out ahead of it.
  const tailEdgeEnd = useDerivedValue(() => (trail.length > 2 ? vec(nextCenter.x, nextCenter.y) : vec(animX.value, animY.value)))

  // Where the crash (RiderCrash) bursts from - `player.crashCell` when set (populated even for an
  // out-of-bounds crash, whose true destination has no `trail` slot of its own - see PlayerState's
  // own comment) so the burst centers exactly on the real collision point rather than the last
  // valid on-grid cell short of it.
  const deathCenter = player.crashCell ? cellCenter(player.crashCell, cellPx) : head

  return (
    <>
      {player.alive ? (
        <>
          {/* Underneath everything else - see tunnelHighlightPath's own comment. */}
          <Path path={tunnelPath} style='stroke' strokeWidth={trailWidth * 1.6} strokeCap='round' strokeJoin='round' color={player.color} opacity={0.35} />
          <Path path={settledPath} style='stroke' strokeWidth={trailWidth} strokeCap='round' strokeJoin='round' color={player.color} opacity={TRAIL_OPACITY} />
          {/* The chain a Prune/Shield break just cut off `trail` entirely - no longer part of
          settledPath/tailEdgeEnd's own data at all, but still visibly eating itself away for a
          beat rather than just vanishing. See severedPath's own comment. */}
          <Path path={severedPath} style='stroke' strokeWidth={trailWidth} strokeCap='round' strokeJoin='round' color={player.color} opacity={TRAIL_OPACITY} />
          <Line p1={tailEdgeStart} p2={tailEdgeEnd} strokeWidth={trailWidth} strokeCap='round' color={player.color} opacity={TRAIL_OPACITY} />
          {/* Skipped while the tail's own segment already reaches the head (trail.length <= 2 - see
          tailEdgeEnd's comment): there's nothing for the front to add. */}
          {trail.length > 2 && <Path path={leadPath} style='stroke' strokeWidth={trailWidth} strokeCap='round' strokeJoin='round' color={player.color} opacity={TRAIL_OPACITY} />}
          {/* Over the trail, so its whole ring shows. */}
          <RiderHead x={animX} y={animY} radius={headRadius} color={player.color} />
          {/* Every game's effect rings, colored by what's driving the effect, so Overdrive and
          Overclock read differently despite sharing the same 2x multiplier. */}
          <EffectRings x={animX} y={animY} headRadius={headRadius} effects={sharedEffects(player.effects)} />
        </>
      ) : (
        // Round already decided for this player: every game's crash (RiderCrash), mounted the moment
        // `alive` flips false and gone with the next round's fresh rider. The head bursts apart,
        // then the trail wipes itself out from head to tail, leaving nothing behind.
        <>
          <Path path={tunnelPath} style='stroke' strokeWidth={trailWidth * 1.6} strokeCap='round' strokeJoin='round' color={player.color} opacity={0.35} />
          <RiderCrash x={deathCenter.x} y={deathCenter.y} trail={trail} cellPx={cellPx} headRadius={headRadius} trailWidth={trailWidth} color={player.color} />
        </>
      )}
    </>
  )
}

export function GameBoard({ players, phase, tickIntervalMs, cellPx, grid, orientationMode, p1OnRight, tick, pickups, pickupColor, obstacles, obstacleColor, portals, tunnels, trailSpeedRate, wrapEdges }: GameBoardProps) {
  // Computed once here (not inside PlayerTrail) so both players' own PlayerTrail instances share
  // the exact same Set rather than each rebuilding an identical one from the same static `tunnels`.
  const tunnelCellSet = useMemo(() => new Set(tunnels.flatMap((tunnel) => tunnel.cells.map(cellKey))), [tunnels])

  return (
    <View style={styles.container}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Walls grid={grid} cellPx={cellPx} orientationMode={orientationMode} p1OnRight={p1OnRight} players={players} phase={phase} wrapEdges={wrapEdges} />
        {/* Unlike Walls above, not hidden during onboarding - obstacle/portal/tunnel placement is
        gameplay information a player needs to see before the round starts, not just a boundary
        marker that clutters the countdown's own zone overlay. */}
        <ArenaBlocks cells={obstacles} cellPx={cellPx} color={obstacleColor} />
        <Gates portals={portals} cellPx={cellPx} color={obstacleColor} />
        <Tunnels tunnels={tunnels} cellPx={cellPx} color={obstacleColor} />
        <Powerups pickups={pickups} cellPx={cellPx} color={pickupColor} />
        <PlayerTrail player={players[1]} tickIntervalMs={tickIntervalMs} cellPx={cellPx} tick={tick} trailSpeedRate={trailSpeedRate} tunnelCellSet={tunnelCellSet} />
        <PlayerTrail player={players[2]} tickIntervalMs={tickIntervalMs} cellPx={cellPx} tick={tick} trailSpeedRate={trailSpeedRate} tunnelCellSet={tunnelCellSet} />
      </Canvas>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 }
})
