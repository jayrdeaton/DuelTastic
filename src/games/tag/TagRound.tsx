import { getBlendedColor, useAutoPaperTheme } from '@rific/auto-paper'
import { useVibration } from '@rific/feedback-press'
import { useEffect, useMemo, useRef, useState } from 'react'
import { View } from 'react-native'

import { MatchOverlays } from '@/components/MatchOverlays'
import TouchInputLayer from '@/components/TouchInputLayer'
import { useGameSound } from '@/hooks/useGameSound'
import { useMatchControls, useMatchFlow } from '@/hooks/useMatchFlow'
import { useSettings } from '@/hooks/useSettings'
import type { Direction, OrientationMode, Player, RoundOutcome, Settings } from '@/types'
import { humanPlayersFor } from '@/utils/gameParams'
import { safeBack } from '@/utils/navigation'

import { TAG_CELL_PX, TAG_RESULT_HOLD_MS, TAG_SPEED_INTERVAL_MS, withTagDefaults } from './constants'
import { freezeLeft } from './engine'
import TagBoardHost from './TagBoardHost'
import { TagHud } from './TagHud'
import type { TagSeat } from './types'
import { useTagState } from './useTagState'

export interface TagRoundProps {
  // The board's size when the match started, which the grid is built from, and its live size, which
  // the board is scaled to (see app/game.tsx's GameRoundProps for why the two are kept apart).
  width: number
  height: number
  liveWidth: number
  liveHeight: number
  settings: Settings
  colors: Record<Player, string>
  profileNames: Partial<Record<Player, string>>
  orientationMode: OrientationMode
  p1OnRight: boolean
  roundHistory: RoundOutcome[]
  onRoundOutcome: (outcome: RoundOutcome) => void
}

// A Tag match on LightCycles' game screen: Tag's own state, board and badges, inside the same match
// as LightCycles and Turf (useMatchControls, useMatchFlow and MatchOverlays), steered with the same
// swipes and keys. The seats take turns starting as It, seat 2 first.
export function TagRound({ width: widthAtMount, height: heightAtMount, liveWidth, liveHeight, settings, colors, profileNames, orientationMode: orientationModeAtMount, p1OnRight: p1OnRightAtMount, roundHistory, onRoundOutcome }: TagRoundProps) {
  const [width] = useState(widthAtMount)
  const [height] = useState(heightAtMount)
  const [orientationMode] = useState(orientationModeAtMount)
  const [p1OnRight] = useState(p1OnRightAtMount)

  const controls = useMatchControls(roundHistory)
  const options = useMemo(() => withTagDefaults(settings.tag), [settings.tag])
  const cellPx = TAG_CELL_PX[settings.gridSizeTier]
  const intervalMs = TAG_SPEED_INTERVAL_MS[settings.speedTier]
  const startingIt: TagSeat = roundHistory.length % 2 === 0 ? 2 : 1
  const { state, turn, activate, beginPlaying, rematch, timeLeftMs } = useTagState({ width, height, cellPx, intervalMs, layout: orientationMode, p1OnRight, options, startingIt, cpu: settings.gameMode === 'vsCpu' ? settings.cpuDifficulty : null, paused: controls.paused })

  const humanPlayers = useMemo(() => humanPlayersFor(settings), [settings])
  const currentDirections = useMemo<Record<Player, Direction>>(() => ({ 1: state.players[1].direction, 2: state.players[2].direction }), [state.players])
  // Tangle reverses a person's swipes and keys in the input layer, as Hack does in LightCycles.
  const tangled = useMemo<Record<Player, boolean>>(() => ({ 1: state.players[1].effects.reverse !== null, 2: state.players[2].effects.reverse !== null }), [state.players])
  const held = useMemo(() => ({ 1: state.players[1].held, 2: state.players[2].held }), [state.players])
  const { settings: userSettings, setSettings: setUserSettings } = useSettings()
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

  const { colors: themeColors, dark } = useAutoPaperTheme()
  // The edge and the pillars in LightCycles' neutral board-structure color (see GameRound's obstacleColor).
  const structureColor = getBlendedColor(themeColors.tertiary, themeColors.outline, 0.5)
  const boardScale = Math.min(liveWidth / width, liveHeight / height)

  return (
    <>
      <View style={{ width, height, transform: [{ scale: boardScale }] }}>
        <TagBoardHost grid={state.grid} cellPx={cellPx} pillars={state.pillars} players={state.players} it={state.it} freezeLeft={freezeLeft(state)} colors={colors} phase={state.phase} tick={state.tick} intervalMs={intervalMs} background={dark ? '#000000' : '#FFFFFF'} structureColor={structureColor} pickups={state.pickups} pickupColor={themeColors.tertiary} />
        <TouchInputLayer orientationMode={orientationMode} p1OnRight={p1OnRight} humanPlayers={humanPlayers} enabled={state.phase === 'playing' && !controls.paused} onTurn={turn} onActivate={activate} controlInverted={tangled} currentDirections={currentDirections} keyScheme={settings.keyScheme} />
      </View>

      {state.phase !== 'onboarding' && <TagHud it={state.it} itTicks={state.itTicks} intervalMs={intervalMs} rule={options.rule} timeLeftMs={timeLeftMs} colors={colors} humanPlayers={humanPlayers} held={held} powerupsOn={options.powerups.length > 0} />}

      <MatchOverlays phase={state.phase} orientationMode={orientationMode} p1OnRight={p1OnRight} settingsOpen={controls.settingsOpen} onSettingsDismiss={() => controls.setSettingsOpen(false)} onSettingsOpen={() => controls.setSettingsOpen(true)} userSettings={userSettings} setUserSettings={setUserSettings} confirmVisible={controls.confirmVisible} cancelBack={controls.cancelBack} humanPlayers={humanPlayers} colors={colors} profileNames={profileNames} roundHistory={roundHistory} onOnboardingComplete={beginPlaying} showResultDialog={flow.showResultDialog} matchOver={controls.matchOver} controlsVisible={flow.controlsVisible} desktopWeb={flow.isDesktopWeb} outcome={state.outcome} gameMode={settings.gameMode} rematchReady={flow.rematchReady} onRequestRematch={flow.handleRequestRematch} onQuit={flow.handleQuit} onExit={safeBack} onBackPress={controls.requestBack} backgroundPaused={controls.backgroundPaused} onResume={controls.resume} />
    </>
  )
}
