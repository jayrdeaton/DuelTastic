import { Platform } from 'react-native'

import { zoneSideFor } from '@/shared/match/playerZones'
import type { OrientationMode, Player } from '@/shared/match/types'
import type { SeatToastSpot } from '@/shared/SeatToasters'

/** Whether 2 Player's two seats sit side by side at the screen rather than face to face across the board. At a computer, or in a browser
 * window wider than tall, the players sit side by side at a landscape screen (Jay, 2026-10-20). On a device they're at the board's two ends
 * whatever the window's shape: the board is always face to face (see MatchScreen), and so are its touch zones, so a landscape iPad keeps them
 * there too. `windowMode` is the window's shape (useOrientationState). */
export function seatsSideBySide(windowMode: OrientationMode, desktopWeb: boolean, web = Platform.OS === 'web'): boolean {
  return desktopWeb || (web && windowMode === 'sideBySide')
}

/** Where each 2 Player seat's countdown, round card and unlock toasts go (OnboardingOverlay, RoundOverDialog, SeatToasters): the half of the
 * window that's theirs, turned the way they read it. Face to face that's their half of the board (zoneSideFor: player 1 the bottom, player 2
 * the top, where their touch zones are), player 2 turned across the table. Side by side (seatsSideBySide) it's the left and right halves,
 * player 1 on the left (WASD by default) and player 2 on the right (the arrow keys), both upright. */
export function seatToastSpots(sideBySide: boolean, boardOrientationMode: OrientationMode, p1OnRight: boolean): Record<Player, SeatToastSpot> {
  if (sideBySide) return { 1: { rotation: 0, zone: 'left' }, 2: { rotation: 0, zone: 'right' } }
  return {
    1: { rotation: 0, zone: zoneSideFor(1, boardOrientationMode, p1OnRight) },
    2: { rotation: 180, zone: zoneSideFor(2, boardOrientationMode, p1OnRight) }
  }
}
