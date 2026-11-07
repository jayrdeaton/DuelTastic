import { type OrientationMode, useOrientationState } from '@tastic/core'
import { useAtComputer } from '@tastic/shell'

// How 2 Player's two seats split the screen: which halves TouchInputLayer's zones, the countdown's
// tinted zones, the walls and the power-up badges each seat owns. At a computer it's always side by
// side, snake 1 on the left, whatever the window's shape (the shell's useAtComputer: two people at one keyboard).
// On a phone or tablet, natively or in its browser, it's the window's shape: face to face in a tall
// window, snake 1 in the bottom half and snake 2 in the top half (a phone, always portrait), and side
// by side in a wide one (a landscape iPad). Snake sets sideBySideAtComputer and sideBySideWhenWide, so
// the loadout's 2 Player panels split the same way and each player keeps the same half from the
// loadout into the match.
export interface SeatSplit {
  orientationMode: OrientationMode
  p1OnRight: boolean
}

export function useSeatSplit(): SeatSplit {
  const { orientationMode, p1OnRight } = useOrientationState()
  const atComputer = useAtComputer()
  return atComputer ? { orientationMode: 'sideBySide', p1OnRight: false } : { orientationMode, p1OnRight }
}
