import type { SeatSplit } from '@/games/snake/hooks/useSeatSplit'
import type { SnakeId } from '@/games/snake/types'
import type { SeatToastSpot } from '@/shared/SeatToasters'

/** Where each 2 Player seat's unlock toasts go (SeatToasters): the half of the screen that's theirs, `split` being useSeatSplit's (the halves
 * TouchInputLayer and the countdown use, by the window's shape), turned the way they read it. Side by side, each player's stack stays on
 * their own half, both upright, so three toasts for one and one for the other are two stacks, one on each side (Jay, 2026-10-20). */
export function seatToastSpots(split: SeatSplit): Record<SnakeId, SeatToastSpot> {
  if (split.orientationMode === 'sideBySide') return split.p1OnRight ? { 1: { rotation: 0, zone: 'right' }, 2: { rotation: 0, zone: 'left' } } : { 1: { rotation: 0, zone: 'left' }, 2: { rotation: 0, zone: 'right' } }
  // Snake 1's half is the bottom, snake 2's the top: face to face, snake 2 turned across the table.
  return { 1: { rotation: 0, zone: 'bottom' }, 2: { rotation: 180, zone: 'top' } }
}
