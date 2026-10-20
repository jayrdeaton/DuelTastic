import { getFixedZoneRotation, getOpposingZoneRotation, type OrientationState } from '@tastic/core'
import { Platform } from 'react-native'

import type { SeatToastSpot } from '@/components/SeatToasters'
import type { OrientationMode, Player } from '@/types'
import { zoneSideFor } from '@/utils/playerZones'

/** Where each 2 Player seat's countdown, round card and unlock toasts go (OnboardingOverlay, RoundOverDialog, SeatToasters): the half of the
 * screen that's theirs, turned the way they read it from the live hold (`orientation`). On a phone that's their half of the always
 * face-to-face board (zoneSideFor: player 1 the bottom, player 2 the top, where their touch zones are): face to face, player 2 turned across
 * the table; in a landscape hold, both turned the same quarter (side by side). At a computer, or in a browser window wider than tall, the
 * players sit side by side at a landscape screen (Jay, 2026-10-20), so it's the left and right halves, player 1 on the left (WASD by
 * default) and player 2 on the right (the arrow keys), both upright. */
export function seatToastSpots(orientation: Pick<OrientationState, 'orientationMode' | 'p1OnRight' | 'upsideDown'>, desktopWeb: boolean, boardOrientationMode: OrientationMode, p1OnRight: boolean, web = Platform.OS === 'web'): Record<Player, SeatToastSpot> {
  if (desktopWeb || (web && orientation.orientationMode === 'sideBySide')) return { 1: { rotation: 0, zone: zoneSideFor(1, 'sideBySide', orientation.p1OnRight) }, 2: { rotation: 0, zone: zoneSideFor(2, 'sideBySide', orientation.p1OnRight) } }
  const rotation = getFixedZoneRotation(orientation.orientationMode, orientation.p1OnRight, orientation.upsideDown)
  return {
    1: { rotation, zone: zoneSideFor(1, boardOrientationMode, p1OnRight) },
    2: { rotation: getOpposingZoneRotation(rotation), zone: zoneSideFor(2, boardOrientationMode, p1OnRight) }
  }
}
