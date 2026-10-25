import type { GridSizeTier, KeyboardScheme } from '@/shared/match/types'

// The key that uses a held powerup, per scheme (desktop web), matched against KeyboardEvent.key.
// @tastic/input's KEY_SCHEMES only covers movement, so this 4th binding lives here: next to each
// scheme's own cluster (Q by WASD, Space for the arrows, U by IJKL) and distinct across all of them,
// so two players sharing one keyboard never collide. Numpad's is NumpadEnter, matched by code in
// keyControls.ts (a numpad key's .key flips with NumLock). The loadout's picker names each one.
// The same keys as Snake's keyboardControls.ts.
export const ACTIVATE_KEYS: Record<Exclude<KeyboardScheme, 'numpad'>, string> = { wasd: 'q', arrows: ' ', ijkl: 'u' }

// Grid cell edge length in px per tier - cols/rows are derived from the safe area at this
// resolution (see grid.ts). Matches the loadout's small/medium/large vehicle icons literally:
// 'small' means a SMALLER cell size, so the cycle's head/trail (which nearly fill their own cell -
// see GameBoard.tsx) render as a small, thin motorcycle-like line. 'large' means a larger cell
// size - a bigger, chunkier train-like body/trail, and fewer (bigger) cells covering the same
// physical board - less room to maneuver, and a coarser, lower-skill-ceiling near-miss margin.
// 'medium' is this app's original fixed CELL_SIZE.
export const GRID_CELL_PX: Record<GridSizeTier, number> = {
  small: 5,
  medium: 8,
  large: 14
}

export const DEFAULT_GRID_SIZE_TIER: GridSizeTier = 'medium'

// Caps the board's own width via @tastic/core's computeContentBounds (see MatchScreen.tsx) whenever
// extendIntoSafeArea is off - real phones/tablets in portrait (the match's permanently-locked
// orientation, see MatchScreen's own comment) stay well under this and see gutterWidth === 0; it
// only actually kicks in on a maximized desktop-web window, where nothing else stops the board
// from stretching into an unplayably wide, short rectangle.
export const MAX_BOARD_CONTENT_WIDTH = 1000

// Threshold (in CSS px) at or above which web counts as "desktop" rather than phone-shaped - the
// same 768 AirHockey, BoxHockey and Pong use. There, MatchScreen keeps the back/settings chips in the
// page's top corners for the whole match instead of hiding them while a round is live.
export const DESKTOP_WEB_MIN_WIDTH = 768

// How much of each side of the board MatchScreen keeps clear on desktop web, for the back and settings
// chips: they sit 8px in from the page's top corners (MatchOverlays) and are 38px across. Taken out of
// the gutter when the window has one (MAX_BOARD_CONTENT_WIDTH), so a wide window's board doesn't
// shrink for it.
export const DESKTOP_CHIP_BAND = 56

// Rescales a ms value tuned at GRID_CELL_PX.medium to the active cell size, preserving on-screen
// px/sec pace: ms/tick scales linearly with px/tick (== cellPx), so px/sec cancels out to a
// constant regardless of which grid-size tier is active.
export function scaleMsForCellPx(referenceMs: number, cellPx: number): number {
  return referenceMs * (cellPx / GRID_CELL_PX.medium)
}

// Onboarding zone overlay (see OnboardingOverlay.tsx): a "3, 2, 1, GO!" countdown, each digit
// held for ONBOARDING_COUNTDOWN_STEP_MS and "GO!" held for ONBOARDING_GO_HOLD_MS, then fades out
// over ONBOARDING_FADE_MS. The game loop itself doesn't start ticking until the fade completes,
// so the countdown IS the "get ready" beat.
export const ONBOARDING_COUNTDOWN_STEP_MS = 700
export const ONBOARDING_GO_HOLD_MS = 500

// A last beat once the death sequence (explosion + trail wipe, see GameBoard.tsx and
// deathAnimationDurationMs below) has already finished and the board's gone quiet - NOT the
// entire crash-to-dialog gap the way this used to be (see useMatchFlow, which now adds this on top of
// deathAnimationDurationMs's own totalMs rather than using it as the whole delay): the animation
// itself now covers most of "register what just happened," so this only needs to be a brief pause
// before it gets covered up, not a full second.
export const ROUND_OVER_DIALOG_HOLD_MS = 300
export const ONBOARDING_FADE_MS = 300
