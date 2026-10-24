import { getBlendedColor, useAutoPaperTheme } from '@rific/auto-paper'
import { useMemo, useState } from 'react'
import { View } from 'react-native'

import { MatchOverlays } from '@/components/MatchOverlays'
import TouchInputLayer from '@/components/TouchInputLayer'
import { GRID_CELL_PX, scaleMsForCellPx } from '@/constants/game'
import { useMatchControls, useMatchFlow } from '@/hooks/useMatchFlow'
import { useSettings } from '@/hooks/useSettings'
import type { Direction, OrientationMode, Player, RoundOutcome, Settings } from '@/types'
import { humanPlayersFor } from '@/utils/gameParams'
import { safeBack } from '@/utils/navigation'

import { TURF_RESULT_HOLD_MS, TURF_SPEED_INTERVAL_MS, withTurfDefaults } from './constants'
import TurfBoardHost from './TurfBoardHost'
import { TurfHud } from './TurfHud'
import { useTurfState } from './useTurfState'

export interface TurfRoundProps {
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

// A Turf match on LightCycles' game screen: Turf's own state, board and score badges, inside the same
// match as LightCycles (useMatchControls, useMatchFlow and MatchOverlays: the countdown, the round
// cards, Play Again, Quit Match?, the Paused dialog and Settings), steered with the same swipes and
// keys.
export function TurfRound({ width: widthAtMount, height: heightAtMount, liveWidth, liveHeight, settings, colors, profileNames, orientationMode: orientationModeAtMount, p1OnRight: p1OnRightAtMount, roundHistory, onRoundOutcome }: TurfRoundProps) {
  const [width] = useState(widthAtMount)
  const [height] = useState(heightAtMount)
  const [orientationMode] = useState(orientationModeAtMount)
  const [p1OnRight] = useState(p1OnRightAtMount)

  const controls = useMatchControls(roundHistory)
  const cellPx = GRID_CELL_PX[settings.gridSizeTier]
  const intervalMs = scaleMsForCellPx(TURF_SPEED_INTERVAL_MS[settings.speedTier], cellPx)
  const options = useMemo(() => withTurfDefaults(settings.turf), [settings.turf])
  const { state, turn, activate, beginPlaying, rematch, timeLeftMs } = useTurfState({ width, height, cellPx, intervalMs, layout: orientationMode, p1OnRight, options, cpu: settings.gameMode === 'vsCpu' ? settings.cpuDifficulty : null, paused: controls.paused })

  const humanPlayers = useMemo(() => humanPlayersFor(settings), [settings])
  const currentDirections = useMemo<Record<Player, Direction>>(() => ({ 1: state.players[1].direction, 2: state.players[2].direction }), [state.players])
  // Tangle reverses a person's swipes and keys in the input layer, as Hack does in LightCycles.
  const tangled = useMemo<Record<Player, boolean>>(() => ({ 1: state.players[1].effects.reverse !== null, 2: state.players[2].effects.reverse !== null }), [state.players])
  const held = useMemo(() => ({ 1: state.players[1].held, 2: state.players[2].held }), [state.players])
  const { settings: userSettings, setSettings: setUserSettings } = useSettings()
  const flow = useMatchFlow({ controls, phase: state.phase, outcome: state.outcome, humanPlayers, rematch, onRoundOutcome, resultDelayMs: () => TURF_RESULT_HOLD_MS })

  const { colors: themeColors, dark } = useAutoPaperTheme()
  // The edge in LightCycles' neutral board-structure color (see GameRound's obstacleColor).
  const edgeColor = getBlendedColor(themeColors.tertiary, themeColors.outline, 0.5)
  const boardScale = Math.min(liveWidth / width, liveHeight / height)

  return (
    <>
      <View style={{ width, height, transform: [{ scale: boardScale }] }}>
        <TurfBoardHost grid={state.grid} cellPx={cellPx} owner={state.owner} players={state.players} colors={colors} phase={state.phase} background={dark ? '#000000' : '#FFFFFF'} edgeColor={edgeColor} pickups={state.pickups} pickupColor={themeColors.tertiary} />
        <TouchInputLayer orientationMode={orientationMode} p1OnRight={p1OnRight} humanPlayers={humanPlayers} enabled={state.phase === 'playing' && !controls.paused} onTurn={turn} onActivate={activate} controlInverted={tangled} currentDirections={currentDirections} keyScheme={settings.keyScheme} />
      </View>

      {state.phase !== 'onboarding' && <TurfHud ground={state.ground} totalCells={state.grid.cols * state.grid.rows} timeLeftMs={timeLeftMs} colors={colors} humanPlayers={humanPlayers} held={held} powerupsOn={options.powerups.length > 0} />}

      <MatchOverlays phase={state.phase} orientationMode={orientationMode} p1OnRight={p1OnRight} settingsOpen={controls.settingsOpen} onSettingsDismiss={() => controls.setSettingsOpen(false)} onSettingsOpen={() => controls.setSettingsOpen(true)} userSettings={userSettings} setUserSettings={setUserSettings} confirmVisible={controls.confirmVisible} cancelBack={controls.cancelBack} humanPlayers={humanPlayers} colors={colors} profileNames={profileNames} roundHistory={roundHistory} onOnboardingComplete={beginPlaying} showResultDialog={flow.showResultDialog} matchOver={controls.matchOver} controlsVisible={flow.controlsVisible} desktopWeb={flow.isDesktopWeb} outcome={state.outcome} gameMode={settings.gameMode} rematchReady={flow.rematchReady} onRequestRematch={flow.handleRequestRematch} onQuit={flow.handleQuit} onExit={safeBack} onBackPress={controls.requestBack} backgroundPaused={controls.backgroundPaused} onResume={controls.resume} />
    </>
  )
}
