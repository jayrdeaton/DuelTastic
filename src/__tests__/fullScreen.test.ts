import { createTagState, startTag, tickTag } from '@/games/tag/engine'
import { DEFAULT_SETTINGS as TAG_DEFAULTS } from '@/games/tag/settings'
import { DEFAULT_SETTINGS as TRAP_DEFAULTS } from '@/games/trap/redux/settingsSlice'
import { createTurfState, startTurf, tickTurf } from '@/games/turf/engine'
import { DEFAULT_SETTINGS as TURF_DEFAULTS } from '@/games/turf/settings'
import { DEFAULT_TURF_RULES } from '@/games/turf/types'
import { safeAreaMask } from '@/shared/match/safeArea'
import { pickupFootprint } from '@/shared/powerups'

// Full Screen (Jay, 2026-11-07: Trap had it, Turf and Tag should too, as each game's own
// setting): the board plays under the device's safe areas, and nothing a player needs to see or
// reach goes under a cutout. safeAreaMask marks those cells from MatchScreen's insets; Turf's and
// Tag's powerup boxes keep their whole footprint off them.

// An iPhone-like notch and home indicator over a phone-shaped board of 8px cells.
const CELL_PX = 8
const INSETS = { top: 59, right: 0, bottom: 34, left: 0 }
const GRID = { cols: 49, rows: 100 }

describe('safeAreaMask', () => {
  it('marks every cell a cutout covers, rounded up to whole cells', () => {
    const mask = safeAreaMask(GRID, CELL_PX, INSETS)
    const rowMarked = (y: number) => mask[y * GRID.cols] === 1 && mask[y * GRID.cols + GRID.cols - 1] === 1
    // 59 / 8 = 7.4, so 8 rows at the top; 34 / 8 = 4.25, so 5 at the bottom.
    for (let y = 0; y < 8; y++) expect(rowMarked(y)).toBe(true)
    expect(rowMarked(8)).toBe(false)
    for (let y = GRID.rows - 5; y < GRID.rows; y++) expect(rowMarked(y)).toBe(true)
    expect(rowMarked(GRID.rows - 6)).toBe(false)
    expect(mask[50 * GRID.cols + 24]).toBe(0)
  })

  it('is empty when the board stops short of the safe areas', () => {
    expect(safeAreaMask(GRID, CELL_PX, { top: 0, right: 0, bottom: 0, left: 0 }).every((v) => v === 0)).toBe(true)
  })
})

describe('powerup boxes in Full Screen', () => {
  // A cutout reaching down past the middle of the board (60 rows of 8px), where a box fair to both
  // riders would otherwise go: every box has to land below it, whole footprint and all.
  const deep = safeAreaMask(GRID, CELL_PX, { top: 60 * CELL_PX, right: 0, bottom: 0, left: 0 })
  const clear = (cell: { x: number; y: number }) => pickupFootprint(cell, GRID).every((i) => deep[i] === 0)
  const starts = { 1: { head: { x: 24, y: 88 }, direction: 'up' as const }, 2: { head: { x: 24, y: 11 }, direction: 'down' as const } }

  it('never turn up under a cutout in Turf', () => {
    for (let seed = 0; seed < 40; seed++) {
      const r = (seed + 0.5) / 40
      const s = tickTurf(startTurf(createTurfState({ grid: GRID, layout: 'faceToFace', unsafe: deep, starts })), { ...DEFAULT_TURF_RULES, powerups: ['dash'] }, () => r)
      expect(s.pickups).toHaveLength(1)
      expect(clear(s.pickups[0].cell)).toBe(true)
    }
  })

  it('never turn up under a cutout in Tag', () => {
    for (let seed = 0; seed < 40; seed++) {
      const r = (seed + 0.5) / 40
      const s = tickTag(startTag(createTagState({ grid: GRID, layout: 'faceToFace', arena: 'open', unsafe: deep, starts })), ['dash'], () => r)
      expect(s.pickups).toHaveLength(1)
      expect(clear(s.pickups[0].cell)).toBe(true)
    }
  })
})

describe('the Full Screen setting', () => {
  it("is each of Trap's, Turf's and Tag's own, off by default", () => {
    expect(TRAP_DEFAULTS.extendIntoSafeArea).toBe(false)
    expect(TURF_DEFAULTS.extendIntoSafeArea).toBe(false)
    expect(TAG_DEFAULTS.extendIntoSafeArea).toBe(false)
  })
})
