import { useAutoPaperTheme } from '@rific/auto-paper'
import { Button } from '@rific/feedback-press'
import { getOpposingZoneRotation, ViewRotation } from '@tastic/core'
import { overlayActionStyles, OverlayBackdrop, OverlayCard, useOverlayCardColors } from '@tastic/hud'
import { StyleSheet, View } from 'react-native'
import { Icon, Text } from 'react-native-paper'

import { zoneSideFor } from '@/shared/match/playerZones'
import { GameMode, OrientationMode, Player, RoundOutcome } from '@/shared/match/types'
import type { SeatToastSpot } from '@/shared/SeatToasters'

export interface RoundOverDialogProps {
  orientationMode: OrientationMode
  // Only meaningful when orientationMode === 'sideBySide' - see GameBoard.tsx's identical prop.
  p1OnRight: boolean
  // Live physical-hold rotation (see @tastic/core's getFixedZoneRotation), applied to each
  // player's own CARD, not their zone - the zone rect must stay exactly the shape TouchInputLayer's
  // matching (unrotated) hit zone already is, or the two stop lining up. Note this is about the LIVE
  // hold, not the `orientationMode` prop above (which is the board's own always-'faceToFace'
  // structural layout and says nothing about how the device is actually being held right now) - see
  // this file's own use of getOpposingZoneRotation, which is what actually decides whether P2's card
  // gets an extra +180° on top of P1's (portrait: P2 sits across the device from P1, physically
  // upside-down relative to them) or not (landscape: P1 and P2 are held side by side, facing the
  // same way, so P2's card uses this rotation unmodified).
  rotation: ViewRotation
  // 2 Player: each seat's half and reading angle (MatchOverlays' seatSpots), the same spots its
  // unlock toasts use. On a phone that's this component's own split and turn; at a computer it's
  // the left and right halves, both upright, since the players sit side by side there.
  seatSpots?: Record<Player, SeatToastSpot>
  humanPlayers: Player[]
  gameMode: GameMode
  outcome: RoundOutcome
  colors: Record<Player, string>
  // Whether each human has already pressed Rematch this round-over - GameRound owns the actual
  // "both agreed" logic (it fires the real rematch once every human player's entry is true); this
  // component only reflects that state back per player and reports taps upward.
  rematchReady: Record<Player, boolean>
  onRequestRematch: (player: Player) => void
  onQuit: () => void
}

// vsCpu gets the original single, centered dialog (only one human to address, and the CPU always
// "agrees" to a rematch instantly - see GameRound's readiness effect, which needs just player 1).
// Two-player mode instead splits into each player's own zone - same top/bottom (face-to-face,
// P2's zone rotated 180° so it reads right-side-up from their side of the device) or left/right
// (side-by-side, ordered by p1OnRight) split OnboardingOverlay already uses for its countdown -
// so "YOU WIN!"/"YOU LOSE!" and each player's own Rematch/Quit always face the player they're for.
export default function RoundOverDialog({ orientationMode, p1OnRight, rotation, seatSpots, humanPlayers, gameMode, outcome, colors, rematchReady, onRequestRematch, onQuit }: RoundOverDialogProps) {
  const { colors: themeColors } = useAutoPaperTheme()
  // Quit's outlined label is fg, the card's own text color, not Paper's default (the theme's
  // primary), so neither seat's card shows another seat's color (Jay, 2026-10-20).
  const { fg, fgMuted } = useOverlayCardColors()
  const onColors: Record<Player, string> = { 1: themeColors.onPrimary, 2: themeColors.onSecondary }
  // Quit is outlined, the fleet's secondary action (ConfirmDialog's Cancel), so it never reads as a
  // second filled button beside Play Again, which fills with colors[player]: two filled buttons in one
  // color on player 2's card read as "too much of one color" (Jay). It used to be a fixed gray fill,
  // which stopped matching once the card took the theme's tinted surface.

  // Text/icon/color as seen from `player`'s own perspective - the only one of the three (win/lose/
  // draw) that's symmetric between the two players is the draw case.
  const perspective = (player: Player) => {
    if (outcome.type === 'draw') return { text: 'DRAW', icon: 'handshake-outline', color: fgMuted }
    if (outcome.winner === player) return { text: 'YOU WIN!', icon: 'trophy', color: colors[player] }
    // This player lost - vsCpu keeps its existing "CPU WINS!" copy (matching the CPU's own robot
    // icon elsewhere) rather than a generic "YOU LOSE!", which would misname who actually won.
    if (gameMode === 'vsCpu') return { text: 'CPU WINS!', icon: 'robot', color: fgMuted }
    return { text: 'YOU LOSE!', icon: 'emoticon-sad-outline', color: fgMuted }
  }

  if (humanPlayers.length === 1) {
    const player = humanPlayers[0]
    const { text, icon, color } = perspective(player)
    const ready = rematchReady[player]
    return (
      <OverlayBackdrop style={styles.backdrop}>
        <OverlayCard style={[styles.singleCard, rotation % 360 !== 0 && { transform: [{ rotate: `${rotation}deg` }] }]}>
          <Icon source={icon} size={64} color={color} />
          <Text variant='headlineLarge' style={[styles.overlayTitle, { color }]}>
            {text}
          </Text>
          {/* hud's action row, as in ConfirmDialog: Quit (outlined) on the left, Play Again (filled) on the
          right, side by side, as on the 2 Player cards below (Jay, 2026-10-20). */}
          <View style={overlayActionStyles.actions}>
            <Button mode='outlined' onPress={onQuit} style={overlayActionStyles.actionButton} textColor={fg}>
              Quit
            </Button>
            <Button mode='contained' disabled={ready} onPress={() => onRequestRematch(player)} style={overlayActionStyles.actionButton} buttonColor={colors[player]} textColor={onColors[player]}>
              {ready ? 'Waiting…' : 'Play Again'}
            </Button>
          </View>
        </OverlayCard>
      </OverlayBackdrop>
    )
  }

  // Matches OnboardingOverlay's identical split exactly (both via zoneSideFor), so a player's zone
  // never swaps sides between the countdown and this dialog.
  const zoneStyles = { top: styles.zoneTop, bottom: styles.zoneBottom, left: styles.zoneLeft, right: styles.zoneRight }
  const p1Zone = zoneStyles[seatSpots ? seatSpots[1].zone : zoneSideFor(1, orientationMode, p1OnRight)]
  const p2Zone = zoneStyles[seatSpots ? seatSpots[2].zone : zoneSideFor(2, orientationMode, p1OnRight)]

  const renderCard = (player: Player) => {
    const { text, icon, color } = perspective(player)
    const ready = rematchReady[player]
    // getOpposingZoneRotation, not the board's own always-'faceToFace' orientationMode above (that's
    // structural - isFaceToFace is always true here, so it can never stand in for an actual live
    // landscape hold) - see that function's own doc for why P2's card only gets the +180 baseline
    // flip in portrait, not landscape.
    const cardRotation = seatSpots ? seatSpots[player].rotation : player === 2 ? getOpposingZoneRotation(rotation) : rotation
    // The same card as the solo dialog above, so each seat's card is as big and as easy to hit as
    // vsCpu's. It used to be a compact version (28pt icon, 130x28 buttons), far too small (Jay,
    // 2026-10-16). Worst case it's under 302pt tall (its size when it also carried a one-line unlock
    // badge, since moved to toasts): under half of an iPhone SE's 667pt screen, held upright or
    // sideways (rotated, its height runs along the 375pt width). Unlocks are toasts in each seat's
    // half (SeatToasters).
    return (
      <OverlayCard style={[styles.seatCard, cardRotation % 360 !== 0 && { transform: [{ rotate: `${cardRotation}deg` }] }]}>
        <Icon source={icon} size={64} color={color} />
        <Text variant='headlineLarge' style={[styles.overlayTitle, { color }]}>
          {text}
        </Text>
        {/* hud's action row, as in ConfirmDialog: Quit (outlined) on the left and Play Again (filled in
        this player's color) on the right, side by side, wrapping to a stack only on a card too narrow
        for both. Side by side keeps the card short, leaving room in the half for this player's unlock
        toasts (Jay, 2026-10-20). Play Again still waits for both players (Waiting… until the other
        presses theirs). */}
        <View style={overlayActionStyles.actions}>
          <Button mode='outlined' onPress={onQuit} style={overlayActionStyles.actionButton} textColor={fg}>
            Quit
          </Button>
          <Button mode='contained' disabled={ready} onPress={() => onRequestRematch(player)} style={overlayActionStyles.actionButton} buttonColor={colors[player]} textColor={onColors[player]}>
            {ready ? 'Waiting…' : 'Play Again'}
          </Button>
        </View>
      </OverlayCard>
    )
  }

  return (
    <OverlayBackdrop>
      <View style={[styles.zone, p1Zone, { borderColor: colors[1], backgroundColor: `${colors[1]}22` }]} testID='round-over-1'>
        {renderCard(1)}
      </View>
      <View style={[styles.zone, p2Zone, { borderColor: colors[2], backgroundColor: `${colors[2]}22` }]} testID='round-over-2'>
        {renderCard(2)}
      </View>
    </OverlayBackdrop>
  )
}

const styles = StyleSheet.create({
  // The single card, as ConfirmDialog's: room from the screen's edges, and the card's full width
  // allowance (OverlayCard's maxWidth, 360) so its action row has room to sit side by side.
  backdrop: { paddingHorizontal: 24 },
  // headlineLarge/headlineSmall's own line-height leaves slack under the glyphs that the flex `gap`
  // above stacks on top of - this claws it back, same fix MatchOverlays' own dialogs already use.
  overlayTitle: { fontWeight: 'bold', marginBottom: -8 },
  // A player's own card in their half: the full width allowance (OverlayCard's maxWidth, 360), as
  // ConfirmDialog's card takes, so the action row has room to sit side by side; sized to its content
  // the card would be as narrow as one button and the row would wrap.
  seatCard: { width: '100%' },
  singleCard: { width: '100%' },
  zone: {
    alignItems: 'center',
    borderStyle: 'dashed',
    borderWidth: 3,
    justifyContent: 'center',
    // A per-player zone is exactly half the screen. The card fits half of a 667pt screen (see
    // renderCard), but this is the backstop for anything shorter: clipping at this zone's own edge
    // reads as a minor crop, instead of the two zones' cards spilling into and visibly overlapping
    // each other right at the shared seam.
    overflow: 'hidden',
    // Keeps a full-width card off the half's dashed edge.
    paddingHorizontal: 16,
    position: 'absolute'
  },
  zoneBottom: { bottom: 0, left: 0, right: 0, top: '50%' },
  zoneLeft: { bottom: 0, left: 0, right: '50%', top: 0 },
  zoneRight: { bottom: 0, left: '50%', right: 0, top: 0 },
  zoneTop: { bottom: '50%', left: 0, right: 0, top: 0 }
})
