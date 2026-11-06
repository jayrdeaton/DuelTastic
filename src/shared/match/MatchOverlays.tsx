import { useAutoPaperTheme } from '@rific/auto-paper'
import { IconButton } from '@rific/feedback-press'
import { useOrientationState } from '@tastic/core'
import { ConfirmDialog } from '@tastic/hud'
import { SettingsDialog } from '@tastic/shell'
import { needsSharedNeutralZone } from '@tastic/split-screen'
import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import MatchOverDialog from '@/shared/match/MatchOverDialog'
import OnboardingOverlay from '@/shared/match/OnboardingOverlay'
import RoundHistoryPips from '@/shared/match/RoundHistoryPips'
import RoundOverDialog from '@/shared/match/RoundOverDialog'
import { seatsSideBySide, seatToastSpots } from '@/shared/match/seatToastSpots'
import { GameMode, GamePhase, OrientationMode, Player, RoundOutcome } from '@/shared/match/types'
import { SeatToasters } from '@/shared/SeatToasters'

export interface MatchOverlaysProps {
  phase: GamePhase
  // The board's own FROZEN orientationMode/p1OnRight (see the round screen) - used for these dialogs' OWN
  // internal zone-split logic, so a dialog's structural layout always matches the board's.
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
  // component's own copy of the round screen's back button.
  onBackPress: () => void
  // useMatchControls' background-pause latch and its resume, for the Paused dialog below.
  backgroundPaused: boolean
  onResume: () => void
  // useMatchControls' quit, for Quit Match?'s and Paused's Quit.
  onConfirmQuit: () => void
}

// Every floating in-match dialog, shared by LightCycles', Turf's and Tag's round screens and rendered
// as the board's sibling rather than inside it, so the one live read here (the window's shape, which
// changes when an iPad turns or a browser window is resized) never re-renders the board/touch subtree
// next to it. A parent re-rendering always re-renders its own children too, board included, while
// sibling components don't share that fate.
//
// Nothing here is turned for the device's hold any more: the OS turns the interface (a phone stays
// portrait), so the only turn left is the far seat's 180 in 2 Player face to face (seatToastSpots).
export function MatchOverlays({ phase, orientationMode, p1OnRight, settingsOpen, onSettingsDismiss, onSettingsOpen, confirmVisible, cancelBack, humanPlayers, colors, profileNames, roundHistory, onOnboardingComplete, showResultDialog, matchOver, controlsVisible, desktopWeb, outcome, gameMode, rematchReady, onRequestRematch, onQuit, onExit, onBackPress, backgroundPaused, onResume, onConfirmQuit }: MatchOverlaysProps) {
  // The window's shape, the one live read here: only a browser window wider than tall seats 2 Player
  // side by side (seatsSideBySide), the board's own split decides everywhere else.
  const { orientationMode: windowMode } = useOrientationState()
  const sideBySide = seatsSideBySide(windowMode, desktopWeb)
  const { dark } = useAutoPaperTheme()
  const chipBg = dark ? '#000000' : '#FFFFFF'
  const chipFg = dark ? '#FFFFFF' : '#000000'
  // Use the device's raw safe-area insets for the fixed corner buttons so they match the rest of the
  // app, while the split-screen two-player branch stays centered on the shared neutral midline instead
  // of sitting in only the second seat's physical space.
  const insets = useSafeAreaInsets()
  // 2 Player: each seat's half and reading angle, for its countdown, its round card and its unlock
  // toasts alike (see seatToastSpots): on a device the board's own split, player 2 turned to face
  // their end; at a computer, side by side, left and right, both upright.
  const seatSpots = humanPlayers.length === 2 ? seatToastSpots(sideBySide, orientationMode, p1OnRight) : undefined

  // The inverse of @tastic/split-screen's needsSharedNeutralZone - see its own doc for the full
  // reasoning (and why it deliberately isn't keyed on Platform.OS). CornerActionButtons-style fixed
  // top corners are the right reachability answer everywhere EXCEPT the one case that function
  // flags: two-plus players held face-to-face, where the top of the screen always reads upside-down
  // to whichever player is on the far side (see seatToastSpots' 180 for player 2), so
  // the shared vertical midline (leftSlot/rightSlot below) is the only neutral spot for both. Keyed on
  // the board's own split, the same one seatSpots uses, so a landscape iPad keeps the midline too.
  const useCornerLayout = sideBySide || !needsSharedNeutralZone(orientationMode, humanPlayers.length)

  const progressMessage = <RoundHistoryPips roundHistory={roundHistory} p1Color={colors[1]} p2Color={colors[2]} />
  return (
    <>
      {/* Unmounted (rather than merely hidden) while settings, the quit confirmation or the Paused
      dialog is open: OnboardingOverlay's countdown timers are scheduled once on mount with no pause
      hook of their own, so unmounting is what stops them ticking underneath any of those dialogs,
      and remounting on close is what restarts the count from '3' instead of resuming mid-count with
      stale timers. */}
      {/* Both dialogs below branch internally on humanPlayers.length (see each one's own doc): one
      upright card for vsCpu, and a card per seat in 2 Player, placed and turned by seatSpots. */}
      {phase === 'onboarding' && !settingsOpen && !confirmVisible && !backgroundPaused && <OnboardingOverlay orientationMode={orientationMode} p1OnRight={p1OnRight} seatSpots={seatSpots} humanPlayers={humanPlayers} p1Color={colors[1]} p2Color={colors[2]} roundHistory={roundHistory} onComplete={onOnboardingComplete} />}

      {phase === 'roundOver' && showResultDialog && !matchOver && outcome && <RoundOverDialog orientationMode={orientationMode} p1OnRight={p1OnRight} seatSpots={seatSpots} humanPlayers={humanPlayers} gameMode={gameMode} outcome={outcome} colors={colors} rematchReady={rematchReady} onRequestRematch={onRequestRematch} onQuit={onQuit} />}

      {/* Terminal - either player quitting from the dialog above ends the match outright, so this
      replaces it rather than layering on top, and tallies every round played this streak (see
      roundHistory) rather than just the one that just finished. Always ONE centered, upright card
      regardless of humanPlayers.length (see this dialog's own doc). */}
      {matchOver && <MatchOverDialog roundHistory={roundHistory} colors={colors} profileNames={profileNames} gameMode={gameMode} onExit={onExit} />}

      {/* Shared @tastic/hud ConfirmDialog (fleet convergence) in place of this app's own
      hand-rolled overlay+card shell - trades this dialog's previous secondary-accent Quit button
      and MONO_FONT styling for the shared component's primary accent and default font, an
      approved, deliberate trade-off. The pip row (same component OnboardingOverlay itself uses) is
      kept as the dialog's message content, showing exactly what's at stake instead of a sentence
      restating the round count. */}
      <ConfirmDialog visible={confirmVisible} title='Quit Match?' message={progressMessage} confirmLabel='Quit' cancelLabel='Cancel' icon='alert-circle-outline' destructive={false} onConfirm={onConfirmQuit} onCancel={cancelBack} />
      {/* Shown when the app comes back from the background mid-match (see useBackgroundPause above):
      play stays frozen until Resume, so a match never restarts before the player is back and ready. */}
      <ConfirmDialog visible={backgroundPaused} title='Paused' message={progressMessage} confirmLabel='Resume' cancelLabel='Quit' icon='pause-circle-outline' destructive={false} onConfirm={onResume} onCancel={onConfirmQuit} />

      {/* Back (onboarding only) + Settings chip buttons - here rather than in the round screen for the
      identical reason as every other floating overlay in this component: they follow the window
      read above, and reading it in the round screen (rather than this, its sibling) would cascade a
      re-render into the board/touch subtree whenever the window changes.
      useCornerLayout: no second seat's zone to stay neutral for (vsCpu, or 2P side by side, which
      already gives each seat its own dedicated half - see needsSharedNeutralZone's own doc), so the
      pair stays in the fixed top-left/top-right corners the rest of the app uses instead of drifting
      into the shared neutral zone. !useCornerLayout (2P face to face): leftSlot/rightSlot on the
      shared vertical midline.
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
              <IconButton icon='arrow-left' iconColor={chipFg} containerColor={chipBg} style={styles.chipButton} size={22} onPress={onBackPress} accessibilityLabel='Back' />
            </View>
            <View style={styles.rightSlot}>
              <IconButton icon='cog' iconColor={chipFg} containerColor={chipBg} style={styles.chipButton} size={22} onPress={onSettingsOpen} accessibilityLabel='Settings' />
            </View>
          </>
        ))}

      <SettingsDialog visible={settingsOpen} onDismiss={onSettingsDismiss} />

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
