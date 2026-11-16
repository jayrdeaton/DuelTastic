import { isOppositeDirection } from '@tastic/grid'

import type { Direction } from '@/shared/match/types'

// A rider's queued turns, two deep: the one its next step takes (pendingDirection) and one swiped
// after it (queuedDirection), taken on the step after that. One slot used to be all there was, so
// a quick up-then-left U-turn (two swipes inside one tick, common at 50 to 100ms a tick) lost the
// left: checked against the heading, it was a reversal.
export interface TurnQueue {
  pendingDirection: Direction | null
  queuedDirection: Direction | null
}

// Trap's, Turf's and Snake's rule, where a rider can't turn straight back into its own trail or
// body. Each turn is checked against the one before it (the heading, then pendingDirection), so
// every turn taken is a quarter turn off the way the rider is going at that moment. A swipe back
// the other way from the last queued turn changes that turn (up, then down, rides down), and a
// third turn is dropped. Null when the swipe changes nothing.
//
// A frozen rider's heading and queue stay as they are until it moves (each game's tick takes a
// turn only on a step), so turns queued across frozen ticks still chain from the real heading and
// can't add up to a reversal.
export function queueTurn(heading: Direction, { pendingDirection, queuedDirection }: TurnQueue, direction: Direction): TurnQueue | null {
  if (pendingDirection === null) {
    if (direction === heading || isOppositeDirection(direction, heading)) return null
    return { pendingDirection: direction, queuedDirection: null }
  }
  if (queuedDirection === null) {
    if (direction === pendingDirection) return null
    if (isOppositeDirection(direction, pendingDirection)) return { pendingDirection: direction, queuedDirection: null }
    return { pendingDirection, queuedDirection: direction }
  }
  if (isOppositeDirection(direction, queuedDirection)) return { pendingDirection, queuedDirection: direction }
  return null
}

// The queue after a step that took pendingDirection (or went straight on with nothing queued): the
// turn swiped after it is next.
export function takeTurn({ queuedDirection }: TurnQueue): TurnQueue {
  return { pendingDirection: queuedDirection, queuedDirection: null }
}

export const NO_TURNS: TurnQueue = { pendingDirection: null, queuedDirection: null }
