import { useAutoPaperTheme } from '@rific/auto-paper'
import { useVibration } from '@rific/feedback-press'
import { safeBack } from '@tastic/shell'
import { useEffect, useMemo, useRef, useState } from 'react'
import { View } from 'react-native'

import { MatchOverlays } from '@/shared/match/MatchOverlays'
import { type MatchRoundProps, MatchScreen } from '@/shared/match/MatchScreen'
import { boardStructureColor } from '@/shared/match/structureColor'
import TouchInputLayer from '@/shared/match/TouchInputLayer'
import { type Direction, humanPlayersFor, type Player } from '@/shared/match/types'
import { useMatchControls, useMatchFlow } from '@/shared/match/useMatchFlow'
import { useGameSound } from '@/shared/useGameSound'

import { TAG_CELL_PX, TAG_RESULT_HOLD_MS, TAG_SPEED_INTERVAL_MS } from './constants'
import { freezeLeft } from './engine'
import { DEFAULT_SETTINGS } from './settings'
import { tagStats } from './stats'
import TagBoardHost from './TagBoardHost'
import { TagHud } from './TagHud'
import type { TagOptions, TagSeat, TagSettings } from './types'
import { useTagState } from './useTagState'

// A Tag match inside the shared frame (MatchScreen): Tag's own state, board and badges, in the same
// match as every game (useMatchControls, useMatchFlow and MatchOverlays), steered with the same swipes
// and keys. The seats take turns starting as It, seat 2 first.
function TagRound({ width: widthAtMount, height: heightAtMount, liveWidth, liveHeight, settings, gameMode, colors, profileNames, orientationMode: orientationModeAtMount, p1OnRight: p1OnRightAtMount, roundHistory, onRoundOutcome }: MatchRoundProps<TagSettings>) {
  const [width] = useState(widthAtMount)
  const [height] = useState(heightAtMount)
  const [orientationMode] = useState(orientationModeAtMount)
  const [p1OnRight] = useState(p1OnRightAtMount)

  const controls = useMatchControls(roundHistory)
  const options = useMemo<TagOptions>(() => ({ rule: settings.rule, arena: settings.arena, roundSeconds: settings.roundSeconds, powerups: settings.powerups }), [settings.rule, settings.arena, settings.roundSeconds, settings.powerups])
  const cellPx = TAG_CELL_PX[settings.gridSizeTier]
  const intervalMs = TAG_SPEED_INTERVAL_MS[settings.speedTier]
  const startingIt: TagSeat = roundHistory.length % 2 === 0 ? 2 : 1
  const { state, turn, activate, beginPlaying, rematch, timeLeftMs } = useTagState({ width, height, cellPx, intervalMs, layout: orientationMode, p1OnRight, options, startingIt, cpu: gameMode === 'vsCpu' ? settings.cpuDifficulty : null, paused: controls.paused })

  const humanPlayers = useMemo(() => humanPlayersFor(gameMode), [gameMode])
  const currentDirections = useMemo<Record<Player, Direction>>(() => ({ 1: state.players[1].direction, 2: state.players[2].direction }), [state.players])
  // Tangle reverses a person's swipes and keys in the input layer, as Hack does in LightCycles.
  const tangled = useMemo<Record<Player, boolean>>(() => ({ 1: state.players[1].effects.reverse !== null, 2: state.players[2].effects.reverse !== null }), [state.players])
  const held = useMemo(() => ({ 1: state.players[1].held, 2: state.players[2].held }), [state.players])
  const flow = useMatchFlow({ controls, phase: state.phase, outcome: state.outcome, humanPlayers, rematch, onRoundOutcome, resultDelayMs: () => TAG_RESULT_HOLD_MS })

  // A tag lands with a sound and a buzz.
  const playTag = useGameSound(require('../../../assets/sounds/notification.wav'))
  const vibration = useVibration()
  const feedbackRef = useRef({ playTag, vibration })
  useEffect(() => {
    feedbackRef.current = { playTag, vibration }
  }, [playTag, vibration])
  useEffect(() => {
    if (state.events.tagged === null) return
    feedbackRef.current.playTag()
    feedbackRef.current.vibration.notification()
  }, [state.events])

  const { colors: themeColors } = useAutoPaperTheme()
  const structureColor = boardStructureColor(themeColors)
  const boardScale = Math.min(liveWidth / width, liveHeight / height)

  return (
    <>
      <View style={{ width, height, transform: [{ scale: boardScale }] }}>
        <TagBoardHost grid={state.grid} cellPx={cellPx} pillars={state.pillars} portals={state.portals} tunnels={state.tunnels} players={state.players} it={state.it} orientationMode={orientationMode} p1OnRight={p1OnRight} freezeLeft={freezeLeft(state)} colors={colors} phase={state.phase} tick={state.tick} intervalMs={intervalMs} structureColor={structureColor} pickups={state.pickups} pickupColor={themeColors.tertiary} />
        <TouchInputLayer orientationMode={orientationMode} p1OnRight={p1OnRight} humanPlayers={humanPlayers} enabled={state.phase === 'playing' && !controls.paused} onTurn={turn} onActivate={activate} controlInverted={tangled} currentDirections={currentDirections} keyScheme={settings.controlScheme} />
      </View>

      {state.phase !== 'onboarding' && <TagHud it={state.it} itTicks={state.itTicks} intervalMs={intervalMs} rule={options.rule} timeLeftMs={timeLeftMs} colors={colors} humanPlayers={humanPlayers} held={held} powerupsOn={options.powerups.length > 0} />}

      <MatchOverlays phase={state.phase} orientationMode={orientationMode} p1OnRight={p1OnRight} settingsOpen={controls.settingsOpen} onSettingsDismiss={() => controls.setSettingsOpen(false)} onSettingsOpen={() => controls.setSettingsOpen(true)} confirmVisible={controls.confirmVisible} cancelBack={controls.cancelBack} humanPlayers={humanPlayers} colors={colors} profileNames={profileNames} roundHistory={roundHistory} onOnboardingComplete={beginPlaying} showResultDialog={flow.showResultDialog} matchOver={controls.matchOver} controlsVisible={flow.controlsVisible} desktopWeb={flow.isDesktopWeb} outcome={state.outcome} gameMode={gameMode} rematchReady={flow.rematchReady} onRequestRematch={flow.handleRequestRematch} onQuit={flow.handleQuit} onExit={safeBack} onBackPress={controls.requestBack} backgroundPaused={controls.backgroundPaused} onResume={controls.resume} />
    </>
  )
}

// Tag's play screen: the shared match frame (MatchScreen) around TagRound.
export default function PlayScreen() {
  const { recordRoundOutcome } = tagStats.useDuelStats()
  return <MatchScreen gameId='tag' defaults={DEFAULT_SETTINGS} Round={TagRound} recordRoundOutcome={recordRoundOutcome} />
}
