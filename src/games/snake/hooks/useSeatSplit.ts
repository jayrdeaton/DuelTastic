import { type OrientationMode, useOrientationState } from '@tastic/core'

// How 2 Player's two seats split the screen: which halves TouchInputLayer's zones, the countdown's
// tinted zones, the walls and the power-up badges each seat owns. It's the window's shape on every
// platform (Snake sets sideBySideWhenWide, so the loadout's 2 Player panels split the same way and
// each player keeps the same half from the loadout into the match): face to face in a tall window,
// snake 1 in the bottom half and snake 2 in the top half (a phone, always portrait), and side by side
// in a wide one, snake 1 on the left (a landscape iPad, a desktop window).
export interface SeatSplit {
  orientationMode: OrientationMode
  p1OnRight: boolean
}

export function useSeatSplit(): SeatSplit {
  const { orientationMode, p1OnRight } = useOrientationState()
  return { orientationMode, p1OnRight }
}
