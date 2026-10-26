import { useAutoPaperTheme } from '@rific/auto-paper'
import { useMemo, useState } from 'react'
import { View } from 'react-native'

import { GRID_CELL_PX, scaleMsForCellPx } from '@/shared/match/constants'
import { MatchOverlays } from '@/shared/match/MatchOverlays'
import { type MatchRoundProps, MatchScreen } from '@/shared/match/MatchScreen'
import TouchInputLayer from '@/shared/match/TouchInputLayer'
import { type Direction, humanPlayersFor, type Player } from '@/shared/match/types'
import { useMatchControls, useMatchFlow } from '@/shared/match/useMatchFlow'
import { safeBack } from '@/shell/navigation'

import { TURF_RESULT_HOLD_MS, TURF_SPEED_INTERVAL_MS } from './constants'
import { DEFAULT_SETTINGS } from './settings'
import { turfStats } from './stats'
import TurfBoardHost from './TurfBoardHost'
import { TurfHud } from './TurfHud'
import type { TurfOptions, TurfSettings } from './types'
import { useTurfState } from './useTurfState'

// A Turf match inside the shared frame (MatchScreen): Turf's own state, board and score badges, in the
// same match as every game (useMatchControls, useMatchFlow and MatchOverlays: the countdown, the round
// cards, Play Again, Quit Match?, the Paused dialog and Settings), steered with the same swipes and
// keys.
function TurfRound({ width: widthAtMount, height: heightAtMount, liveWidth, liveHeight, settings, gameMode, colors, profileNames, orientationMode: orientationModeAtMount, p1OnRight: p1OnRightAtMount, roundHistory, onRoundOutcome }: MatchRoundProps<TurfSettings>) {
  const [width] = useState(widthAtMount)
  const [height] = useState(heightAtMount)
  const [orientationMode] = useState(orientationModeAtMount)
  const [p1OnRight] = useState(p1OnRightAtMount)

  const controls = useMatchControls(roundHistory)
  const cellPx = GRID_CELL_PX[settings.gridSizeTier]
  const intervalMs = scaleMsForCellPx(TURF_SPEED_INTERVAL_MS[settings.speedTier], cellPx)
  const options = useMemo<TurfOptions>(() => ({ arena: settings.arena, crash: settings.crash, ownTrailDeadly: settings.ownTrailDeadly, powerups: settings.powerups, roundSeconds: settings.roundSeconds }), [settings.arena, settings.crash, settings.ownTrailDeadly, settings.powerups, settings.roundSeconds])
  const { state, turn, activate, beginPlaying, rematch, timeLeftMs } = useTurfState({ width, height, cellPx, intervalMs, layout: orientationMode, p1OnRight, options, cpu: gameMode === 'vsCpu' ? settings.cpuDifficulty : null, paused: controls.paused })

  const humanPlayers = useMemo(() => humanPlayersFor(gameMode), [gameMode])
  const currentDirections = useMemo<Record<Player, Direction>>(() => ({ 1: state.players[1].direction, 2: state.players[2].direction }), [state.players])
  // Tangle reverses a person's swipes and keys in the input layer, as Hack does in LightCycles.
  const tangled = useMemo<Record<Player, boolean>>(() => ({ 1: state.players[1].effects.reverse !== null, 2: state.players[2].effects.reverse !== null }), [state.players])
  const held = useMemo(() => ({ 1: state.players[1].held, 2: state.players[2].held }), [state.players])
  const flow = useMatchFlow({ controls, phase: state.phase, outcome: state.outcome, humanPlayers, rematch, onRoundOutcome, resultDelayMs: () => TURF_RESULT_HOLD_MS })

  const { colors: themeColors, dark } = useAutoPaperTheme()
  const boardScale = Math.min(liveWidth / width, liveHeight / height)

  return (
    <>
      <View style={{ width, height, transform: [{ scale: boardScale }] }}>
        <TurfBoardHost grid={state.grid} cellPx={cellPx} owner={state.owner} obstacles={state.obstacles} portals={state.portals} tunnels={state.tunnels} players={state.players} colors={colors} orientationMode={orientationMode} p1OnRight={p1OnRight} phase={state.phase} tick={state.tick} intervalMs={intervalMs} background={dark ? '#000000' : '#FFFFFF'} pickups={state.pickups} pickupColor={themeColors.tertiary} />
        <TouchInputLayer orientationMode={orientationMode} p1OnRight={p1OnRight} humanPlayers={humanPlayers} enabled={state.phase === 'playing' && !controls.paused} onTurn={turn} onActivate={activate} controlInverted={tangled} currentDirections={currentDirections} keyScheme={settings.controlScheme} />
      </View>

      {state.phase !== 'onboarding' && <TurfHud ground={state.ground} totalCells={state.grid.cols * state.grid.rows - state.blocked.reduce((sum, value) => sum + value, 0)} timeLeftMs={timeLeftMs} colors={colors} humanPlayers={humanPlayers} held={held} powerupsOn={options.powerups.length > 0} />}

      <MatchOverlays phase={state.phase} orientationMode={orientationMode} p1OnRight={p1OnRight} settingsOpen={controls.settingsOpen} onSettingsDismiss={() => controls.setSettingsOpen(false)} onSettingsOpen={() => controls.setSettingsOpen(true)} confirmVisible={controls.confirmVisible} cancelBack={controls.cancelBack} humanPlayers={humanPlayers} colors={colors} profileNames={profileNames} roundHistory={roundHistory} onOnboardingComplete={beginPlaying} showResultDialog={flow.showResultDialog} matchOver={controls.matchOver} controlsVisible={flow.controlsVisible} desktopWeb={flow.isDesktopWeb} outcome={state.outcome} gameMode={gameMode} rematchReady={flow.rematchReady} onRequestRematch={flow.handleRequestRematch} onQuit={flow.handleQuit} onExit={safeBack} onBackPress={controls.requestBack} backgroundPaused={controls.backgroundPaused} onResume={controls.resume} />
    </>
  )
}

// Turf's play screen: the shared match frame (MatchScreen) around TurfRound.
export default function PlayScreen() {
  const { recordRoundOutcome } = turfStats.useDuelStats()
  return <MatchScreen gameId='turf' defaults={DEFAULT_SETTINGS} Round={TurfRound} recordRoundOutcome={recordRoundOutcome} />
}
