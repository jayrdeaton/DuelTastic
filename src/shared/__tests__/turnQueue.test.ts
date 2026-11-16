import { isOppositeDirection } from '@tastic/grid'

import { NO_TURNS, queueTurn, takeTurn, type TurnQueue } from '@/shared/match/turnQueue'
import type { Direction } from '@/shared/match/types'

const DIRECTIONS: Direction[] = ['up', 'down', 'left', 'right']

// Swipes in order from a rider heading `heading` with nothing queued, as the rule sees them.
function swipe(heading: Direction, ...swipes: Direction[]): TurnQueue {
  return swipes.reduce((queue, d) => queueTurn(heading, queue, d) ?? queue, NO_TURNS)
}

describe('queueTurn (Trap, Turf and Snake)', () => {
  it('queues a quarter turn, and nothing for straight on or straight back', () => {
    expect(swipe('right', 'up')).toEqual({ pendingDirection: 'up', queuedDirection: null })
    expect(queueTurn('right', NO_TURNS, 'right')).toBeNull()
    expect(queueTurn('right', NO_TURNS, 'left')).toBeNull()
  })

  it('keeps a quick U-turn as two turns, the second after the first', () => {
    expect(swipe('right', 'up', 'left')).toEqual({ pendingDirection: 'up', queuedDirection: 'left' })
  })

  it('keeps a step to the side as two turns', () => {
    expect(swipe('right', 'up', 'right')).toEqual({ pendingDirection: 'up', queuedDirection: 'right' })
  })

  it('changes the last turn on a swipe back the other way', () => {
    expect(swipe('right', 'up', 'down')).toEqual({ pendingDirection: 'down', queuedDirection: null })
    expect(swipe('right', 'up', 'left', 'right')).toEqual({ pendingDirection: 'up', queuedDirection: 'right' })
  })

  it('drops a third turn and a repeat', () => {
    const queued = swipe('right', 'up', 'left')
    expect(queueTurn('right', queued, 'down')).toBeNull()
    expect(queueTurn('right', queued, 'up')).toBeNull()
    expect(queueTurn('right', queued, 'left')).toBeNull()
    expect(queueTurn('right', swipe('right', 'up'), 'up')).toBeNull()
  })

  it('only ever queues quarter turns, whatever three swipes come in', () => {
    for (const heading of DIRECTIONS) {
      for (const a of DIRECTIONS) {
        for (const b of DIRECTIONS) {
          for (const c of DIRECTIONS) {
            let way = heading
            let queue = swipe(heading, a, b, c)
            while (queue.pendingDirection !== null) {
              const next = queue.pendingDirection
              expect(next === way || isOppositeDirection(next, way)).toBe(false)
              way = next
              queue = takeTurn(queue)
            }
          }
        }
      }
    }
  })
})

describe('takeTurn', () => {
  it('moves the turn swiped second up to next', () => {
    expect(takeTurn({ pendingDirection: 'up', queuedDirection: 'left' })).toEqual({ pendingDirection: 'left', queuedDirection: null })
    expect(takeTurn({ pendingDirection: 'up', queuedDirection: null })).toEqual(NO_TURNS)
    expect(takeTurn(NO_TURNS)).toEqual(NO_TURNS)
  })
})
