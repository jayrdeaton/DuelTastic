import { useAutoPaperTheme } from '@rific/auto-paper'
import { IconButton } from '@rific/feedback-press'
import { getFixedZoneRotation, getViewRotation, useOrientationState } from '@tastic/core'
import { ConfirmDialog } from '@tastic/hud'
import { safeBack, SettingsDialog } from '@tastic/shell'
import { needsSharedNeutralZone } from '@tastic/split-screen'
import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import MatchOverDialog from '@/shared/match/MatchOverDialog'
import OnboardingOverlay from '@/shared/match/OnboardingOverlay'
import RoundHistoryPips from '@/shared/match/RoundHistoryPips'
import RoundOverDialog from '@/shared/match/RoundOverDialog'
import { seatToastSpots } from '@/shared/match/seatToastSpots'
import { GameMode, GamePhase, OrientationMode, Player, RoundOutcome } from '@/shared/match/types'
import { SeatToasters } from '@/shared/SeatToasters'

export interface MatchOverlaysProps {
  phase: GamePhase
  // The board's own FROZEN orientationMode/p1OnRight (see the round screen) - used for these dialogs' OWN
  // internal zone-split logic, so a dialog's structural layout always matches the board's, never
  // the live physical tilt (which only drives each dialog's own `rotation` prop below).
  orientationMode: OrientationMode
  p1OnRight: boolean
  settingsOpen: boolean
  onSettingsDismiss: () => void
  // Opens the settings dialog - this lives here (not just onSettingsDismiss) because the chip
  // button that triggers it is now rendered here too, see the leftSlot/rightSlot chips below.
  onSettingsOpen: () => void
  confirmVisible: boolean
  cancelBack: () => void
  humanPlayers: Player[]
  colors: Record<Player, string>
  profileNames: Partial<Record<Player, string>>
  roundHistory: RoundOutcome[]
  onOnboardingComplete: () => void
  showResultDialog: boolean
  matchOver: boolean
  // useMatchFlow's controlsVisible - passed down instead of recomputing the same
  // phase/showResultDialog/matchOver expression a second time here, so the two can never drift.
  controlsVisible: boolean
  // Desktop web always takes the corner layout: both players share one screen, keyboard and mouse
  // there, so there's no far seat for the shared-midline chips to stay readable from.
  desktopWeb: boolean
  outcome: RoundOutcome | null
  gameMode: GameMode
  rematchReady: Record<Player, boolean>
  onRequestRematch: (player: Player) => void
  onQuit: () => void
  onExit: () => void
  // Only meaningful during the 'onboarding' phase - see the leftSlot chip below, which is this
  // component's own copy of the round screen's back button (moved here for the same reason as
  // everything else: it needs the same live rotation the countdown next to it already gets).
  onBackPress: () => void
  // useMatchControls' background-pause latch and its resume, for the Paused dialog below.
  backgroundPaused: boolean
  onResume: () => void
}

// Every floating in-match dialog, shared by LightCycles' and Turf's round screens and rendered as
// the board's sibling rather than inside it: this is the one piece that needs LIVE rotation
// tracking (nothing else in a match does), and calling useOrientationState() from a
// genuinely separate component is what actually keeps that live tracking from cascading a
// re-render into the board/touch subtree next to it. A parent re-rendering always re-renders its
// own children too, board included, regardless of whether the board's own props actually changed -
// sibling components don't share that fate, so isolating the live hook to its own subtree is a
// structural fix, not just a memoization optimization that could regress if some future prop here
// stopped being stable.
//
// Each dialog rotates its OWN content in place (a plain `rotation` prop, computed from the live
// signal below) rather than being wrapped in a width/height-swapping FakeLandscapeView the way the
// loadout's whole-screen layout is - these dialogs' own zones must stay exactly the shape
// TouchInputLayer's matching (unrotated) hit zones already are, and swapping dimensions around the
// whole overlay distorted a full-width/half-height zone into a narrow, tall sliver that no longer
// lined up with where a player could actually touch. FakeLandscapeView is still the right tool for
// genuinely-whole-screen content with no fixed shape to match - just not this.
export function MatchOverlays({ phase, orientationMode, p1OnRight, settingsOpen, onSettingsDismiss, onSettingsOpen, confirmVisible, cancelBack, humanPlayers, colors, profileNames, roundHistory, onOnboardingComplete, showResultDialog, matchOver, controlsVisible, desktopWeb, outcome, gameMode, rematchReady, onRequestRematch, onQuit, onExit, onBackPress, backgroundPaused, onResume }: MatchOverlaysProps) {
  // The ONE orientation read in this component, feeding both angles below. Lock Orientation freezes
  // it app-wide (see the shell's RootLayout, OrientationBridge), so while that's on, every overlay here
  // holds still together: fixed-zone and single-seat content alike, including a two-player fixed-zone
  // overlay that would otherwise follow a landscape/portrait change.
  const orientation = useOrientationState()
  // getFixedZoneRotation, not getViewRotation directly - this board's own zones are frozen forever
  // at 'faceToFace'/true (see the round screen), never reflowing no matter which way the device is spun
  // while flat, which is exactly the layout getFixedZoneRotation is for (see its own doc): a genuine
  // landscape hold still rotates everything, but a portrait "upside down" reading is ignored rather
  // than adding a spurious 180° flip on top of P2's own fixed one below (getOpposingZoneRotation).
  // Only ever fed to content that's genuinely split into two fixed physical zones (the two-player
  // branch of OnboardingOverlay/RoundOverDialog, and the shared-neutral-zone chips below) - anything
  // with just ONE seat to address has no zone to protect from a spurious 180° flip, and wants
  // singleSeatRotation below instead.
  const rotation = getFixedZoneRotation(orientation.orientationMode, orientation.p1OnRight, orientation.upsideDown)
  // Same reading as `rotation` above, for single-seat content (a centered dialog, or a corner button
  // with no second seat to stay neutral for). getViewRotation, not getFixedZoneRotation: this is for
  // content with no fixed zone to protect, so the portrait "upside down" reading should reposition it
  // too, not be ignored.
  const singleSeatRotation = getViewRotation(orientation.orientationMode, orientation.p1OnRight, orientation.upsideDown)
  const { dark } = useAutoPaperTheme()
  // The chips' own colors, from `dark`: they need the same rotation-in-place treatment as everything
  // else in this component.
  const chipBg = dark ? '#000000' : '#FFFFFF'
  const chipFg = dark ? '#FFFFFF' : '#000000'
  const chipRotation = rotation % 360 !== 0 ? { transform: [{ rotate: `${rotation}deg` }] } : undefined
  // Use the device's raw safe-area insets for the fixed corner buttons so they match the rest of the
  // app, while the split-screen two-player branch stays centered on the shared neutral midline instead
  // of sitting in only the second seat's physical space.
  const insets = useSafeAreaInsets()
  // 2 Player: each seat's half and reading angle, for its countdown, its round card and its unlock
  // toasts alike (see seatToastSpots): on a phone the board's own split, turned to face each seat;
  // at a computer, side by side, left and right, both upright.
  const seatSpots = humanPlayers.length === 2 ? seatToastSpots(orientation, desktopWeb, orientationMode, p1OnRight) : undefined

  // The inverse of @tastic/split-screen's needsSharedNeutralZone - see its own doc for the full
  // reasoning (and why it deliberately isn't keyed on Platform.OS). CornerActionButtons-style fixed
  // top corners are the right reachability answer everywhere EXCEPT the one case that function
  // flags: two-plus players held face-to-face, where the top of the screen always reads upside-down
  // to whichever player is on the far side (see RoundOverDialog's own getOpposingZoneRotation), so
  // the shared vertical midline (leftSlot/rightSlot below) is the only neutral spot for both.
  const useCornerLayout = desktopWeb || !needsSharedNeutralZone(orientation.orientationMode, humanPlayers.length)

  const progressMessage = <RoundHistoryPips roundHistory={roundHistory} p1Color={colors[1]} p2Color={colors[2]} />
  return (
    <>
      {/* Unmounted (rather than merely hidden) while settings, the quit confirmation or the Paused
      dialog is open: OnboardingOverlay's countdown timers are scheduled once on mount with no pause
      hook of their own, so unmounting is what stops them ticking underneath any of those dialogs,
      and remounting on close is what restarts the count from '3' instead of resuming mid-count with
      stale timers. */}
      {/* Both dialogs below branch internally on humanPlayers.length (see each one's own doc): the
      single-card branch (vsCpu) has no second seat to protect, so it gets singleSeatRotation same as
      MatchOverDialog/SettingsDialog below; the two-player, per-seat-split branch keeps the board's
      own fixed-zone `rotation` exactly as before. */}
      {phase === 'onboarding' && !settingsOpen && !confirmVisible && !backgroundPaused && <OnboardingOverlay orientationMode={orientationMode} p1OnRight={p1OnRight} rotation={humanPlayers.length === 1 ? singleSeatRotation : rotation} seatSpots={seatSpots} humanPlayers={humanPlayers} p1Color={colors[1]} p2Color={colors[2]} roundHistory={roundHistory} onComplete={onOnboardingComplete} />}

      {phase === 'roundOver' && showResultDialog && !matchOver && outcome && <RoundOverDialog orientationMode={orientationMode} p1OnRight={p1OnRight} rotation={humanPlayers.length === 1 ? singleSeatRotation : rotation} seatSpots={seatSpots} humanPlayers={humanPlayers} gameMode={gameMode} outcome={outcome} colors={colors} rematchReady={rematchReady} onRequestRematch={onRequestRematch} onQuit={onQuit} />}

      {/* Terminal - either player quitting from the dialog above ends the match outright, so this
      replaces it rather than layering on top, and tallies every round played this streak (see
      roundHistory) rather than just the one that just finished. Always ONE centered card regardless
      of humanPlayers.length (see this dialog's own doc), so it always wants singleSeatRotation. */}
      {matchOver && <MatchOverDialog roundHistory={roundHistory} colors={colors} profileNames={profileNames} gameMode={gameMode} onExit={onExit} rotation={singleSeatRotation} />}

      {/* Shared @tastic/hud ConfirmDialog (fleet convergence) in place of this app's own
      hand-rolled overlay+card shell - trades this dialog's previous secondary-accent Quit button
      and MONO_FONT styling for the shared component's primary accent and default font, an
      approved, deliberate trade-off. The pip row (same component OnboardingOverlay itself uses) is
      kept as the dialog's message content, showing exactly what's at stake instead of a sentence
      restating the round count. */}
      <ConfirmDialog visible={confirmVisible} title='Quit Match?' message={progressMessage} confirmLabel='Quit' cancelLabel='Cancel' icon='alert-circle-outline' destructive={false} onConfirm={safeBack} onCancel={cancelBack} rotation={singleSeatRotation} />
      {/* Shown when the app comes back from the background mid-match (see useBackgroundPause above):
      play stays frozen until Resume, so a match never restarts before the player is back and ready. */}
      <ConfirmDialog visible={backgroundPaused} title='Paused' message={progressMessage} confirmLabel='Resume' cancelLabel='Quit' icon='pause-circle-outline' destructive={false} onConfirm={onResume} onCancel={safeBack} rotation={singleSeatRotation} />

      {/* Back (onboarding only) + Settings chip buttons - here rather than in the round screen for the
      identical reason as every other floating overlay in this component: they need the live
      orientation signal above, and computing that from a hook called directly in the round screen (rather
      than this, its sibling) would cascade a re-render into the board/touch subtree on every tilt.
      Square glyphs in square chips, so rotating the whole button (not just its icon) never distorts
      a hit box the way a non-square zone would - see this component's own doc on why dialogs rotate
      only their inner content instead.
      useCornerLayout: no second seat's zone to stay neutral for (vsCpu, or 2P side-by-side, which
      already gives each seat its own dedicated half - see needsSharedNeutralZone's own doc), so the
      pair stays in the fixed top-left/top-right corners the rest of the app uses instead of drifting
      into the shared neutral zone. !useCornerLayout (2P face-to-face): unchanged - leftSlot/rightSlot
      on the shared vertical midline, glyph-only chipRotation, exactly as before.
      Also shown through matchOver (previously hidden then) - matches BoxHockey's/AirHockey's/Pong's
      identical always-visible back+settings chips, so there's a consistent way to back out (still
      gated behind onBackPress's own "Quit Match?" confirmation mid-match, once roundHistory is non-empty)
      rather than only the MatchOverDialog's own exit button. */}
      {controlsVisible &&
        (useCornerLayout ? (
          <>
            <View style={[styles.cornerLeftSlot, { top: 8 + insets.top, left: 8 + insets.left }]}>
              <IconButton icon='arrow-left' iconColor={chipFg} containerColor={chipBg} style={styles.chipButton} size={22} onPress={onBackPress} accessibilityLabel='Back' />
            </View>
            <View style={[styles.cornerRightSlot, { top: 8 + insets.top, right: 8 + insets.right }]}>
              <IconButton icon='cog' iconColor={chipFg} containerColor={chipBg} style={styles.chipButton} size={22} onPress={onSettingsOpen} accessibilityLabel='Settings' />
            </View>
          </>
        ) : (
          <>
            <View style={styles.leftSlot}>
              <IconButton icon='arrow-left' iconColor={chipFg} containerColor={chipBg} style={[styles.chipButton, chipRotation]} size={22} onPress={onBackPress} accessibilityLabel='Back' />
            </View>
            <View style={styles.rightSlot}>
              <IconButton icon='cog' iconColor={chipFg} containerColor={chipBg} style={[styles.chipButton, chipRotation]} size={22} onPress={onSettingsOpen} accessibilityLabel='Settings' />
            </View>
          </>
        ))}

      <SettingsDialog visible={settingsOpen} onDismiss={onSettingsDismiss} rotation={singleSeatRotation} />

      {/* 2 Player's unlock toasts, a Toaster per seat in that seat's half of the board, turned to
      face it the way its RoundOverDialog card is (see seatSpots above, and MatchScreen's handleRoundOutcome); every other
      toast stays on the app's main Toaster (the shell's RootLayout). */}
      {seatSpots && <SeatToasters spots={seatSpots} />}
    </>
  )
}

const styles = StyleSheet.create({
  // Cancels IconButton's own built-in 6px margin (react-native-paper's default Surface spacing),
  // same reasoning as BoxHockey's identical chipButton style - otherwise a visible gap opens up
  // between the solid chip and its slot now that there's a background to see the edge of.
  chipButton: { margin: 0 },
  // The useCornerLayout counterpart to leftSlot/rightSlot below - pinned in the app's standard
  // top-left/top-right corners instead of the shared neutral midline, matching the rest of the app.
  cornerLeftSlot: { position: 'absolute' },
  cornerRightSlot: { position: 'absolute' },
  // top: 0 + bottom: 0 + justifyContent: 'center' centers the button on the board's vertical
  // midline regardless of its height, instead of pinning it a fixed distance from the top the way
  // cornerLeftSlot/cornerRightSlot above do for the other layout mode. A bare View here doesn't
  // claim any touch of its own, so it can span the full board height without stealing swipes from
  // TouchInputLayer underneath - only the IconButton it wraps is actually touchable.
  leftSlot: { bottom: 0, justifyContent: 'center', left: 4, position: 'absolute', top: 0 },
  rightSlot: { bottom: 0, justifyContent: 'center', position: 'absolute', right: 4, top: 0 }
})
