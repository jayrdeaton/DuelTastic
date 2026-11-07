import { StyleSheet, View } from 'react-native'
import { Icon } from 'react-native-paper'

import { POWERUP_ICONS } from '@/games/trap/constants/game'
import { OrientationMode, Player, PlayerState } from '@/games/trap/types'
import { DESKTOP_CHIP_BAND } from '@/shared/match/constants'

export interface PowerupHudProps {
  players: Record<Player, PlayerState>
  orientationMode: OrientationMode
  // Only meaningful when orientationMode === 'sideBySide' - see GameBoard.tsx's identical prop.
  p1OnRight: boolean
  // At a computer, where the back and settings chips stay up in the top corners through play: the top
  // badge drops below them.
  atComputer?: boolean
  // MatchScreen's safe-area insets: all zero unless the round plays under them (Full Screen), when each
  // badge moves in by them, clear of the Dynamic Island, notch and home indicator (it sat 12 into its
  // corner, under them, until 2026-11-07).
  insets?: { top: number; right: number; bottom: number; left: number }
}

const BADGE_SIZE = 30
// How far each badge sits in from its corner (plus the safe-area insets in Full Screen).
const CORNER_GAP = 12
const NO_INSETS = { top: 0, right: 0, bottom: 0, left: 0 }

// Both players' held item is always visible to both - there's no realistic way to hide it anyway
// on a single shared screen where each player's own zone is already fully visible to the other
// (same as a rival's held item being visible in Mario Kart). The item's TYPE is the only thing
// that's a mystery (see GameBoard.tsx's Powerups layer) - once held, it's revealed here. Kept
// deliberately understated (small, low-opacity, no per-player color) - this is a quiet reference,
// not something that should compete for attention with the board itself.
function HeldItemBadge({ heldPowerup }: { heldPowerup: PlayerState['heldPowerup'] }) {
  return <View style={styles.badge}>{heldPowerup && <Icon source={POWERUP_ICONS[heldPowerup]} size={16} color='rgba(255,255,255,0.85)' />}</View>
}

// First persistent in-play overlay this screen has ever had (see the play screen, where today nothing
// shows during phase === 'playing'). Corner picked per player from orientationMode/p1OnRight -
// same "is this player on the right" convention as GameBoard.tsx's wallPath and
// TouchInputLayer.tsx's zone split - so each badge always sits in that player's own zone rather
// than a side fixed regardless of which way the device was rotated. In faceToFace, column doesn't
// matter (each player's zone spans the full width), so player 1 stays bottom and player 2 stays
// top regardless of p1OnRight.
export function PowerupHud({ players, orientationMode, p1OnRight, atComputer = false, insets = NO_INSETS }: PowerupHudProps) {
  const p1OnRightSide = orientationMode === 'sideBySide' && p1OnRight
  const p2OnLeftSide = orientationMode === 'sideBySide' && !p1OnRight
  // Each corner's own offsets, pushed in by the insets on the two edges it touches.
  const bottomInset = { bottom: CORNER_GAP + insets.bottom }
  const topInset = atComputer ? null : { top: CORNER_GAP + insets.top }
  const p1Side = p1OnRightSide ? { right: CORNER_GAP + insets.right } : { left: CORNER_GAP + insets.left }
  const p2Side = p2OnLeftSide ? { left: CORNER_GAP + insets.left } : { right: CORNER_GAP + insets.right }
  return (
    <>
      <View pointerEvents='none' style={[p1OnRightSide ? styles.bottomRight : styles.bottomLeft, bottomInset, p1Side]}>
        <HeldItemBadge heldPowerup={players[1].heldPowerup} />
      </View>
      <View pointerEvents='none' style={[p2OnLeftSide ? styles.topLeft : styles.topRight, p2Side, topInset, atComputer && styles.belowChips]}>
        <HeldItemBadge heldPowerup={players[2].heldPowerup} />
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.28)',
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: BADGE_SIZE / 2,
    borderWidth: 1,
    height: BADGE_SIZE,
    justifyContent: 'center',
    opacity: 0.7,
    width: BADGE_SIZE
  },
  belowChips: { top: DESKTOP_CHIP_BAND },
  bottomLeft: { bottom: 12, left: 12, position: 'absolute' },
  bottomRight: { bottom: 12, position: 'absolute', right: 12 },
  topLeft: { left: 12, position: 'absolute', top: 12 },
  topRight: { position: 'absolute', right: 12, top: 12 }
})
