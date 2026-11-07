// How a rider's head is drawn, shared by every game that draws its riders with RiderHead
// (Trap, Turf and Tag), so they all look alike. A skin is the ring around the head; each
// game still sizes the head itself for its own cells. One skin so far, the classic; another (Snake's,
// or one a player picks per game) is a second RiderSkin here, handed to RiderHead's `skin`.
export interface RiderSkin {
  // On the head's edge, in points: what makes a head read on the dark board.
  ringColor: string
  ringWidth: number
  // Just outside the ring, never over it, in points: what separates the ring from a light
  // background (a rider's own Turf ground, the light theme) or a light rider color like yellow.
  outlineColor: string
  outlineWidth: number
}

// Trap's original look: the rider's color, a white ring, and a thin black line outside the
// white. Flat widths rather than scaled with the cell, so the ring is the same at every grid size
// and in every game (a ring scaled to Turf's 5px cells left the white under 1pt).
export const CLASSIC_SKIN: RiderSkin = {
  ringColor: '#FFFFFF',
  ringWidth: 1.5,
  outlineColor: '#000000',
  outlineWidth: 1
}

// A head's radius as a share of its cell, in the games on the fine cells (Trap and Turf, 5 to
// 14px): nearly filling its own cell, so the head reads as exactly where it is. Tag sizes its own for
// its much bigger cells.
export const HEAD_RADIUS_CELLS = 0.475
