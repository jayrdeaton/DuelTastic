import { zoneSideFor } from '@/shared/match/playerZones'
import type { OrientationMode, Player } from '@/shared/match/types'
import type { SeatToastSpot } from '@/shared/SeatToasters'

/** Where each 2 Player seat's countdown, round card and unlock toasts go (OnboardingOverlay, RoundOverDialog, SeatToasters): the half of the
 * window that's theirs, turned the way they read it. On a phone or tablet that's their half of the always face-to-face board (zoneSideFor:
 * player 1 the bottom, player 2 the top, where their touch zones are), player 2 turned across the table, whatever the window's shape. At a
 * computer (`sideBySide`, useAtComputer) it's the left and right halves, player 1 on the left (WASD by default) and player 2 on the right
 * (the arrow keys), both upright. */
export function seatToastSpots(sideBySide: boolean, boardOrientationMode: OrientationMode, p1OnRight: boolean): Record<Player, SeatToastSpot> {
  if (sideBySide) return { 1: { rotation: 0, zone: 'left' }, 2: { rotation: 0, zone: 'right' } }
  return {
    1: { rotation: 0, zone: zoneSideFor(1, boardOrientationMode, p1OnRight) },
    2: { rotation: 180, zone: zoneSideFor(2, boardOrientationMode, p1OnRight) }
  }
}
