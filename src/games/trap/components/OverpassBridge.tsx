import { Line, Rect, vec } from '@shopify/react-native-skia'

import type { Overpass } from '@/games/trap/types'

// The Overpass arena's crossing (utils/overpass.ts), drawn from above as a bridge over a road: the
// road's two edges run under it the way riders go under, and the deck, with a railing along each
// side, carries the riders going across. The board layers it with zIndex (Skia sorts a level's
// groups by it): the road and every trail at 0, the deck at OVERPASS_DECK_Z, and what's on the deck
// (the trail pieces and heads riding over) at OVERPASS_OVER_Z, so a rider under the bridge shows
// dimmed through the deck and a rider on it rides over everything.
export const OVERPASS_DECK_Z = 1
export const OVERPASS_OVER_Z = 2

// How far the road's edges and the railings run on past the crossing, in cells: a short approach,
// so it reads as a bridge from either way in.
const APPROACH_CELLS = 1
// The deck is the board's own color, see-through enough that a rider under it still shows.
const DECK_OPACITY = 0.6
// The railings a little heavier than the road's edges, so the bridge reads as on top.
const RAILING_WIDTH = 2

export interface DeckRect {
  x: number
  y: number
  width: number
  height: number
}

// The crossing in px: the clip for what rides over it.
export function overpassRect({ left, top, right, bottom }: Overpass, cellPx: number): DeckRect {
  return { x: left * cellPx, y: top * cellPx, width: (right - left + 1) * cellPx, height: (bottom - top + 1) * cellPx }
}

// The edges of the level `axis` runs along: two lines down the crossing's sides, running on past it.
function edges(overpass: Overpass, cellPx: number, axis: 'h' | 'v') {
  const { x, y, width, height } = overpassRect(overpass, cellPx)
  const run = APPROACH_CELLS * cellPx
  return axis === 'h'
    ? [
        [vec(x - run, y), vec(x + width + run, y)],
        [vec(x - run, y + height), vec(x + width + run, y + height)]
      ]
    : [
        [vec(x, y - run), vec(x, y + height + run)],
        [vec(x + width, y - run), vec(x + width, y + height + run)]
      ]
}

// The road under the bridge, drawn with the board's other structure at the bottom.
export function OverpassRoad({ overpass, cellPx, color, strokeWidth }: { overpass: Overpass; cellPx: number; color: string; strokeWidth: number }) {
  const under = overpass.over === 'h' ? 'v' : 'h'
  return (
    <>
      {edges(overpass, cellPx, under).map(([p1, p2], i) => (
        <Line key={i} p1={p1} p2={p2} strokeWidth={strokeWidth} color={color} />
      ))}
    </>
  )
}

// The deck and its railings, over the road and every trail under it.
export function OverpassDeck({ overpass, cellPx, color, deckColor }: { overpass: Overpass; cellPx: number; color: string; deckColor: string }) {
  const rect = overpassRect(overpass, cellPx)
  return (
    <>
      <Rect x={rect.x} y={rect.y} width={rect.width} height={rect.height} color={deckColor} opacity={DECK_OPACITY} />
      {edges(overpass, cellPx, overpass.over).map(([p1, p2], i) => (
        <Line key={i} p1={p1} p2={p2} strokeWidth={RAILING_WIDTH} strokeCap='round' color={color} />
      ))}
    </>
  )
}
