import { useKeepAwake } from '@rific/core'
import { useVibration } from '@rific/feedback-press'
import { useToast } from '@rific/toaster'
import { useBackgroundPause } from '@tastic/core'
import { useQuitConfirmation } from '@tastic/hud'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Platform, useWindowDimensions } from 'react-native'
import { useDispatch } from 'react-redux'

import { DESKTOP_WEB_MIN_WIDTH, ROUND_OVER_DIALOG_HOLD_MS } from '@/constants/game'
import { useGameSound } from '@/hooks/useGameSound'
import { liveplayActions } from '@/redux/liveplaySlice'
import type { AppDispatch } from '@/redux/store'
import type { GamePhase, Player, RoundOutcome } from '@/types'
import { safeBack } from '@/utils/navigation'

// A match's flow around whichever game is being played: everything a round screen does besides
// running its own game. Split in two because the game's state hook sits between them: it needs
// `paused` from useMatchControls, and useMatchFlow needs the round's phase and outcome from it. Both
// LightCycles' and Turf's round screens use the pair, so the two games' matches behave the same.

export interface MatchControls {
  settingsOpen: boolean
  setSettingsOpen: (open: boolean) => void
  matchOver: boolean
  setMatchOver: (over: boolean) => void
  confirmVisible: boolean
  requestBack: () => void
  cancelBack: () => void
  backgroundPaused: boolean
  resume: () => void
  // Settings, Quit Match? or the Paused dialog is up: the game's steps (and clock) stop.
  paused: boolean
  // Told the round's phase by useMatchFlow, which is the first to know it.
  trackPhase: (phase: GamePhase) => void
}

// Before the game's state hook: the dialogs that pause a match.
export function useMatchControls(roundHistory: RoundOutcome[]): MatchControls {
  const [settingsOpen, setSettingsOpen] = useState(false)
  // True once either player quits from a round card: the match is over, and it stays over.
  const [matchOver, setMatchOver] = useState(false)
  // The round's phase, for the background pause below, which reads it only when the app leaves the
  // foreground. Kept here rather than read off the game's state, which is declared after this hook.
  const phaseRef = useRef<GamePhase>('onboarding')
  const trackPhase = useCallback((phase: GamePhase) => {
    phaseRef.current = phase
  }, [])
  // Asked only once there's a score to lose; the first round's back exits at once. Once the match is
  // over its stats are recorded, so back exits at once then too, like the Match Over card's own
  // button (audit F094).
  const { confirmVisible, requestBack, cancelBack } = useQuitConfirmation(() => roundHistory.length > 0 && !matchOver, safeBack)
  // Leaving the app mid-match latches a pause that only the Paused dialog's Resume clears (see
  // @tastic/core's useBackgroundPause). Skipped once the round is over, or while a dialog already
  // holds the pause.
  const { backgroundPaused, resume } = useBackgroundPause(() => phaseRef.current !== 'roundOver' && !settingsOpen && !confirmVisible)
  // Keeps the screen awake while a match is up, unless Keep Awake is off in Settings (@rific/core's,
  // from Providers.tsx's KeepAwakeBridge). The OS auto-lock only counts touches, so keyboard
  // steering or watching the CPU could otherwise let a release build lock mid-match.
  useKeepAwake('game')
  return { settingsOpen, setSettingsOpen, matchOver, setMatchOver, confirmVisible, requestBack, cancelBack, backgroundPaused, resume, paused: settingsOpen || confirmVisible || backgroundPaused, trackPhase }
}

export interface UseMatchFlowParams {
  controls: MatchControls
  phase: GamePhase
  outcome: RoundOutcome | null
  humanPlayers: Player[]
  rematch: () => void
  onRoundOutcome: (outcome: RoundOutcome) => void
  // How long the round's end plays out on the board before its result card shows, read once when
  // the round ends (LightCycles waits for the slower crashed trail's death sequence).
  resultDelayMs: () => number
}

// After the game's state hook: what happens when a round ends and how the next one starts.
export function useMatchFlow({ controls, phase, outcome, humanPlayers, rematch, onRoundOutcome, resultDelayMs }: UseMatchFlowParams) {
  const { matchOver, setMatchOver, paused, trackPhase } = controls
  const dispatch = useDispatch<AppDispatch>()

  useEffect(() => {
    trackPhase(phase)
  }, [phase, trackPhase])

  const vibration = useVibration()
  const vibrationRef = useRef(vibration)
  useEffect(() => {
    vibrationRef.current = vibration
  }, [vibration])

  // The crash sound lands the instant the round ends, with the board freezing on that same frame;
  // the win or draw jingle lands later, with the result card.
  const playCrash = useGameSound(require('../../assets/sounds/crash.wav'))
  const playWin = useGameSound(require('../../assets/sounds/win.wav'))
  const playDraw = useGameSound(require('../../assets/sounds/draw.wav'))
  const soundRef = useRef({ playCrash, playWin, playDraw })
  useEffect(() => {
    soundRef.current = { playCrash, playWin, playDraw }
  }, [playCrash, playWin, playDraw])

  // Reports a just-finished round upward, once, on the phase change into roundOver.
  const prevPhaseRef = useRef(phase)
  useEffect(() => {
    if (prevPhaseRef.current !== 'roundOver' && phase === 'roundOver') {
      vibrationRef.current.notification()
      soundRef.current.playCrash()
      if (outcome) onRoundOutcome(outcome)
    }
    prevPhaseRef.current = phase
  }, [phase, outcome, onRoundOutcome])

  // The result card waits for the round's end to play out on the board, then shows. Which humans have
  // pressed Play Again resets with it, so a new round over never opens already "ready".
  const [showResultDialog, setShowResultDialog] = useState(false)
  const [rematchReady, setRematchReady] = useState<Record<Player, boolean>>({ 1: false, 2: false })
  const resultDelayRef = useRef(resultDelayMs)
  useEffect(() => {
    resultDelayRef.current = resultDelayMs
  }, [resultDelayMs])
  useEffect(() => {
    if (phase !== 'roundOver') return
    const timer = setTimeout(() => setShowResultDialog(true), resultDelayRef.current() + ROUND_OVER_DIALOG_HOLD_MS)
    // Reset when the phase next leaves roundOver (Play Again) or on unmount, so the next round over
    // starts hidden and waits its own delay again.
    return () => {
      clearTimeout(timer)
      setShowResultDialog(false)
      setRematchReady({ 1: false, 2: false })
    }
  }, [phase])

  useEffect(() => {
    if (!showResultDialog || !outcome) return
    if (outcome.type === 'win') soundRef.current.playWin()
    else soundRef.current.playDraw()
  }, [showResultDialog, outcome])

  const handleQuit = useCallback(() => setMatchOver(true), [setMatchOver])
  const handleRequestRematch = useCallback((player: Player) => setRematchReady((ready) => ({ ...ready, [player]: true })), [setRematchReady])

  // On a desktop-web page the back and settings chips stay up in the page's top corners for the
  // whole match, so there's always a way out or into Settings; anywhere narrower they only show
  // between rounds.
  const { width: windowWidth } = useWindowDimensions()
  const isDesktopWeb = Platform.OS === 'web' && windowWidth >= DESKTOP_WEB_MIN_WIDTH
  const controlsVisible = isDesktopWeb || phase === 'onboarding' || (phase === 'roundOver' && showResultDialog) || matchOver

  // Live, unpaused play, for Providers.tsx's EdgeGuardBridge (the one useEdgeGestureGuard call).
  // Reset on unmount too, so leaving mid-round by any path can't leave Edge Guard stuck on.
  useEffect(() => {
    dispatch(liveplayActions.setActivelyPlaying(phase === 'playing' && !paused))
    return () => {
      dispatch(liveplayActions.setActivelyPlaying(false))
    }
  }, [phase, paused, dispatch])

  // No toast stays up during live play: a quick Play Again would otherwise carry a round over's
  // unlock toasts past the countdown into the next round.
  const { clear: clearToasts } = useToast()
  useEffect(() => {
    if (phase === 'playing') clearToasts()
  }, [phase, clearToasts])

  // Play Again starts the next round once every human in this one has pressed it (against the CPU,
  // just player 1). Guarded on matchOver so a Quit landing with an agreed rematch still ends it.
  useEffect(() => {
    if (phase !== 'roundOver' || matchOver) return
    if (humanPlayers.every((p) => rematchReady[p])) rematch()
  }, [phase, matchOver, humanPlayers, rematchReady, rematch])

  return { showResultDialog, rematchReady, handleQuit, handleRequestRematch, controlsVisible, isDesktopWeb }
}
