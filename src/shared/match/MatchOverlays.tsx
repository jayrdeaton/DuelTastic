import { ConfirmDialog } from '@tastic/hud'
import { MatchChips, SettingsDialog, useAtComputer } from '@tastic/shell'
import { needsSharedNeutralZone } from '@tastic/split-screen'

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

// Every floating in-match dialog, shared by Trap's, Turf's and Tag's round screens and rendered
// as the board's sibling rather than inside it, so the one live read here (whether this is a computer,
// which core re-reads when a browser window is resized) never re-renders the board/touch subtree next
// to it. A parent re-rendering always re-renders its own children too, board included, while
// sibling components don't share that fate.
//
// Nothing here is turned for the device's hold any more: the OS turns the interface (a phone stays
// portrait), so the only turn left is the far seat's 180 in 2 Player face to face (seatToastSpots).
export function MatchOverlays({ phase, orientationMode, p1OnRight, settingsOpen, onSettingsDismiss, onSettingsOpen, confirmVisible, cancelBack, humanPlayers, colors, profileNames, roundHistory, onOnboardingComplete, showResultDialog, matchOver, controlsVisible, outcome, gameMode, rematchReady, onRequestRematch, onQuit, onExit, onBackPress, backgroundPaused, onResume, onConfirmQuit }: MatchOverlaysProps) {
  // The one live read here: only a computer seats 2 Player side by side (the shell's useAtComputer);
  // on a phone or tablet, natively or in its browser, the board's own face-to-face split decides.
  const sideBySide = useAtComputer()
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

      {/* Back + settings: the shell's MatchChips, one rule for every game. Up during the countdown,
      the round's card and once the match is over (controlsVisible), hidden while a round is ridden;
      face to face (not useCornerLayout), on the side edges between the players; else the top corners. */}
      <MatchChips playing={!controlsVisible} faceToFace={!useCornerLayout} onBack={onBackPress} onSettings={onSettingsOpen} />

      <SettingsDialog visible={settingsOpen} onDismiss={onSettingsDismiss} />

      {/* 2 Player's unlock toasts, a Toaster per seat in that seat's half of the board, turned to
      face it the way its RoundOverDialog card is (see seatSpots above, and MatchScreen's handleRoundOutcome); every other
      toast stays on the app's main Toaster (the shell's RootLayout). */}
      {seatSpots && <SeatToasters spots={seatSpots} />}
    </>
  )
}
