import { isInBounds } from '@tastic/grid'

import { Axis, GridCell, GridSize, Overpass } from '@/games/trap/types'

// The searches below walk the board by number rather than by string key: each cell's index is
// y * cols + x, and each index has three slots, one for each level a cell is kept under (`stepKey`
// in utils/overpass.ts): 0 off the Overpass's crossing ("x,y"), 1 riding across it ("x,y|h"), 2
// riding down it ("x,y|v"). They used to build a key, look it up in a Set and allocate a queue entry
// for every neighbor of every cell they reached: the CPU runs three or four of them a tick, about 85%
// of a tick's work in a vs CPU round, and on a slower phone's JS thread that was enough to hold the
// steps a frame or two late (useRiderGlide). Same results as the string version, which
// floodFill.test.ts keeps as the reference.
const LEVELS = 3
const H_LEVEL = 1
const V_LEVEL = 2

// The four neighbors in @tastic/grid's ALL_DIRECTIONS order (up, down, left, right), which decides
// which cells a capped search counts, and on the crossing only the two along the level's axis.
const DX = [0, 0, -1, 1]
const DY = [-1, 1, 0, 0]
const ALL_NEIGHBORS = [0, 1, 2, 3]
const ALONG_H = [2, 3]
const ALONG_V = [0, 1]

function levelFor(axis: Axis): number {
  return axis === 'h' ? H_LEVEL : V_LEVEL
}

// The slot `stepKey` would key a cell under, reached going along `axis`.
function slotOf(x: number, y: number, cols: number, axis: Axis, overpass: Overpass | null): number {
  const onCrossing = overpass !== null && x >= overpass.left && x <= overpass.right && y >= overpass.top && y <= overpass.bottom
  return (y * cols + x) * LEVELS + (onCrossing ? levelFor(axis) : 0)
}

// A stepKey ("x,y", "x,y|h" or "x,y|v") as its slot, read off the key's characters, or -1 for a key
// off the board or of any other shape (never one a search would look up).
function slotOfKey(key: string, cols: number, rows: number): number {
  let i = 0
  const readInt = (): number | null => {
    const negative = key.charCodeAt(i) === 45
    if (negative) i++
    const begin = i
    let value = 0
    for (let c = key.charCodeAt(i); c >= 48 && c <= 57; c = key.charCodeAt(++i)) value = value * 10 + (c - 48)
    return i === begin ? null : negative ? -value : value
  }
  const x = readInt()
  if (x === null || key.charCodeAt(i) !== 44) return -1
  i++
  const y = readInt()
  if (y === null || x < 0 || y < 0 || x >= cols || y >= rows) return -1
  let level = 0
  if (i < key.length) {
    if (key.charCodeAt(i) !== 124 || key.length !== i + 2) return -1
    const axis = key[i + 1]
    if (axis === 'h') level = H_LEVEL
    else if (axis === 'v') level = V_LEVEL
    else return -1
  }
  return (y * cols + x) * LEVELS + level
}

function slotsOf(keys: ReadonlySet<string>, grid: GridSize): Uint8Array {
  const slots = new Uint8Array(grid.cols * grid.rows * LEVELS)
  for (const key of keys) {
    const slot = slotOfKey(key, grid.cols, grid.rows)
    if (slot >= 0) slots[slot] = 1
  }
  return slots
}

// Each portal entrance's exit as a cell index, -1 for no portal, -2 for an exit off the board (which
// a search can't go through, as the string version stepped there and then found it out of bounds).
// Null when there are none, the usual case.
function portalExits(portals: ReadonlyMap<string, GridCell>, grid: GridSize): Int32Array | null {
  if (portals.size === 0) return null
  const exits = new Int32Array(grid.cols * grid.rows).fill(-1)
  for (const [key, exit] of portals) {
    const slot = slotOfKey(key, grid.cols, grid.rows)
    if (slot >= 0 && slot % LEVELS === 0) exits[slot / LEVELS] = isInBounds(exit, grid) ? exit.y * grid.cols + exit.x : -2
  }
  return exits
}

interface Search {
  start: GridCell
  grid: GridSize
  occupied: ReadonlySet<string>
  maxCount: number
  portals: ReadonlyMap<string, GridCell>
  wrapEdges: boolean
  overpass: Overpass | null
  startAxis: Axis
  // Stops at the first cell reached whose index is marked here, with its step distance.
  targets: Uint8Array | null
}

// The breadth-first search both functions below run: the count of slots it queued, or with
// `targets`, the step distance to the first target it reaches (null when it reaches none).
function search({ start, grid, occupied, maxCount, portals, wrapEdges, overpass, startAxis, targets }: Search): { count: number; distance: number | null } {
  const { cols, rows } = grid
  if (!isInBounds(start, grid)) return { count: 0, distance: null }
  const blocked = slotsOf(occupied, grid)
  const startSlot = slotOf(start.x, start.y, cols, startAxis, overpass)
  if (blocked[startSlot]) return { count: 0, distance: null }
  if (targets && targets[start.y * cols + start.x]) return { count: 1, distance: 0 }

  const exits = portalExits(portals, grid)
  const total = cols * rows * LEVELS
  const visited = new Uint8Array(total)
  // A capped search queues at most three past its cap (the last cell it takes in can add four).
  const queue = new Int32Array(Math.max(1, Math.min(total, Math.ceil(maxCount) + 4)))
  const dist = targets ? new Int32Array(total) : null
  visited[startSlot] = 1
  queue[0] = startSlot
  let length = 1
  let head = 0
  while (head < length && length < maxCount) {
    const slot = queue[head]
    head++
    const index = (slot - (slot % LEVELS)) / LEVELS
    const x = index % cols
    const y = (index - x) / cols
    const level = slot % LEVELS
    // On the crossing a rider goes straight on, along the level it's on.
    const neighbors = level === 0 ? ALL_NEIGHBORS : level === H_LEVEL ? ALONG_H : ALONG_V
    for (const n of neighbors) {
      let nx = x + DX[n]
      let ny = y + DY[n]
      if (wrapEdges && (nx < 0 || ny < 0 || nx >= cols || ny >= rows)) {
        nx = ((nx % cols) + cols) % cols
        ny = ((ny % rows) + rows) % rows
      }
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue
      if (exits) {
        const exit = exits[ny * cols + nx]
        if (exit === -2) continue
        if (exit >= 0) {
          nx = exit % cols
          ny = (exit - nx) / cols
        }
      }
      const next = slotOf(nx, ny, cols, n >= 2 ? 'h' : 'v', overpass)
      if (visited[next] || blocked[next]) continue
      if (targets && dist && targets[ny * cols + nx]) return { count: length, distance: dist[slot] + 1 }
      visited[next] = 1
      if (dist) dist[next] = dist[slot] + 1
      queue[length++] = next
    }
  }
  return { count: length, distance: null }
}

// 4-directional BFS from `start`, counting cells reachable without crossing `occupied` or the
// grid edge - the "how much room is left to survive in" heuristic cpuAi.ts scores each candidate
// turn by. Index-walked queue (not Array#shift, which is O(n) per call and would make this
// O(cells²)) since this runs fresh for every candidate direction, every tick.
//
// `maxCount` stops the fill early once the queue reaches that many cells, bounding worst-case
// cost at O(maxCount) regardless of grid size - see CPU_FLOOD_FILL_CAP's own comment for why an
// exact count past that point is never actually needed. Defaults to unbounded for direct/test use.
// `portals` defaults to empty so every existing call site/test (predating portals) stays byte-
// identical - a neighbor landing on a portal cell is redirected to its paired exit before the
// visited/bounds/occupied checks run, the same "let + reassign before any check" shape tickGame's
// own movement resolution uses, so a portal reads to this search as a normal 1-step edge to
// wherever it actually leads, not a boundary (see gameEngine.ts's tickGame for why treating it as
// blocked instead would misjudge reachable space near one). `wrapEdges` defaults to false so every
// existing call site/test (predating wrap) stays byte-identical - when true, a neighbor that steps
// off the grid re-enters from the opposite edge (see grid.ts's wrapCell) instead of being treated as
// a boundary, mirroring gameEngine.ts's own tickGame. Applied before the portal check, same order
// tickGame uses, though it's moot in practice: a portal is never placed on an edge cell (see
// arenas.ts), so a raw off-grid `next` can never also be a portal entrance. Only an entrance on the
// board is read, which is every portal.
//
// On the Overpass (`overpass`, default none) a crossing cell counts once on each level: the search
// keys it by the level it got there on (utils/overpass.ts's stepKey, the same keys `occupied` holds
// its trails under) and only goes straight on from it, as a rider must. `startAxis` is the level
// `start` itself was reached on, for a start on the crossing.
export function countReachableCells(start: GridCell, grid: GridSize, occupied: ReadonlySet<string>, maxCount: number = Infinity, portals: ReadonlyMap<string, GridCell> = new Map(), wrapEdges: boolean = false, overpass: Overpass | null = null, startAxis: Axis = 'v'): number {
  return search({ start, grid, occupied, maxCount, portals, wrapEdges, overpass, startAxis, targets: null }).count
}

// Same 4-directional BFS shape as countReachableCells above, but stops early and returns the
// step-distance to the first cell in `targets` it reaches, or null if none is reachable within
// `maxCount` - used by cpuAi.ts to bias pickup-seeking without a second, differently-shaped search.
// `portals` follows the identical redirect-before-checks shape countReachableCells above uses,
// `wrapEdges` its identical wrap-before-portal-check shape, and `overpass`/`startAxis` its levels.
// A target is a cell (a powerup box, never on the crossing).
export function distanceToNearestTarget(start: GridCell, grid: GridSize, occupied: ReadonlySet<string>, targets: ReadonlySet<string>, maxCount: number = Infinity, portals: ReadonlyMap<string, GridCell> = new Map(), wrapEdges: boolean = false, overpass: Overpass | null = null, startAxis: Axis = 'v'): number | null {
  const marked = new Uint8Array(grid.cols * grid.rows)
  for (const key of targets) {
    const slot = slotOfKey(key, grid.cols, grid.rows)
    if (slot >= 0 && slot % LEVELS === 0) marked[slot / LEVELS] = 1
  }
  return search({ start, grid, occupied, maxCount, portals, wrapEdges, overpass, startAxis, targets: marked }).distance
}
