import { getBlendedColor, useAutoPaperTheme } from '@rific/auto-paper'
import { useMemo, useState } from 'react'
import { View } from 'react-native'

import GameBoardHost from '@/games/lightcycles/components/GameBoardHost'
import { PowerupHud } from '@/games/lightcycles/components/PowerupHud'
import { deathAnimationDurationMs, TRAIL_SPEED_RATE } from '@/games/lightcycles/constants/game'
import { useGameState } from '@/games/lightcycles/hooks/useGameState'
import { DEFAULT_SETTINGS } from '@/games/lightcycles/redux/settingsSlice'
import { lightCyclesStats } from '@/games/lightcycles/stats'
import type { Direction, Player, RoundSettings, Settings } from '@/games/lightcycles/types'
import { MatchOverlays } from '@/shared/match/MatchOverlays'
import { type MatchRoundProps, MatchScreen } from '@/shared/match/MatchScreen'
import TouchInputLayer from '@/shared/match/TouchInputLayer'
import { humanPlayersFor } from '@/shared/match/types'
import { useMatchControls, useMatchFlow } from '@/shared/match/useMatchFlow'
import { safeBack } from '@/shell/navigation'

// A LightCycles match inside the shared frame (MatchScreen), which mounts it only once the board area
// has been measured, so useGameState's lazy initial state (see useGameState.ts) is always built from
// a real board size. Mounted exactly once for the life of a match - width/height/orientationMode/
// p1OnRight below are all frozen at that single mount via lazy useState, so a later rotation never
// tears the round down, rebuilds the grid, or touches the board/touch layer at all.
function GameRound({ width: widthAtMount, height: heightAtMount, liveWidth, liveHeight, safeAreaInsetsPx: safeAreaInsetsPxAtMount, settings: matchSettings, gameMode, colors, profileNames, orientationMode: orientationModeAtMount, p1OnRight: p1OnRightAtMount, roundHistory, onRoundOutcome }: MatchRoundProps<Settings>) {
  const [settings] = useState<RoundSettings>(() => ({ ...matchSettings, gameMode }))
  const [width] = useState(widthAtMount)
  const [height] = useState(heightAtMount)
  const [safeAreaInsetsPx] = useState(safeAreaInsetsPxAtMount)
  const [orientationMode] = useState(orientationModeAtMount)
  const [p1OnRight] = useState(p1OnRightAtMount)
  // The match's dialogs and pause (see useMatchFlow.ts), ahead of useGameState, which needs `paused`.
  const controls = useMatchControls(roundHistory)
  const { state, turn, activate, beginPlaying, rematch, tickIntervalMs, cellPx } = useGameState(width, height, settings, colors, orientationMode, p1OnRight, safeAreaInsetsPx, controls.paused)

  // Live, not frozen (see liveWidth/liveHeight's own doc on MatchRoundProps) - recomputed every
  // render as the window resizes/gutter changes, so the board+touch subtree below visibly tracks
  // it. Math.min, not independent X/Y scale, so a live aspect ratio that's drifted from the design
  // one (a much shorter or narrower window than the round actually started in) still scales the
  // whole board uniformly and leaves the extra room on one axis as margin, instead of stretching
  // cycles/trails into ovals. Applying this as a transform on the board+touch subtree as one rigid
  // unit, rather than re-deriving cols/rows/cellPx from the live size, is what actually makes this
  // safe: TouchInputLayer's own zones are already percentage-of-parent/pan-translation based, not
  // absolute-pixel (see that file's own doc), so scaling both the canvas and the touch zones
  // together by the exact same factor can never let them disagree about where anything is - unlike
  // the "freeze only the grid, leave the container live" approach width/height's own comment above
  // describes as tried and rejected, which let the two resize independently instead.
  const boardScale = Math.min(liveWidth / width, liveHeight / height)

  const humanPlayers = useMemo(() => humanPlayersFor(gameMode), [gameMode])
  const controlInverted = useMemo<Record<Player, boolean>>(() => ({ 1: state.players[1].effects.control !== null, 2: state.players[2].effects.control !== null }), [state.players])
  // Fed to TouchInputLayer so it can gate turn feedback (sound/haptic) on a swipe that would
  // actually turn the player - see isEffectiveTurn.
  const currentDirections = useMemo<Record<Player, Direction>>(() => ({ 1: state.players[1].direction, 2: state.players[2].direction }), [state.players])

  // The board reacts to the round's end at once - each crashed player's own PlayerTrail (see
  // GameBoard.tsx) starts its explosion-then-wipe death sequence the instant its `alive` flips false -
  // and the result card waits for the slower of those sequences (both, on a draw), so it never covers
  // a still-wiping trail. Read once, when the round ends: a dead player's trail never changes again
  // that round, and GameBoard.tsx computes the same number from deathAnimationDurationMs.
  const resultDelayMs = () => {
    const deadPlayers = ([1, 2] as Player[]).filter((p) => !state.players[p].alive)
    return deadPlayers.length > 0 ? Math.max(...deadPlayers.map((p) => deathAnimationDurationMs(state.players[p].trail.length).totalMs)) : 0
  }
  const flow = useMatchFlow({ controls, phase: state.phase, outcome: state.outcome, humanPlayers, rematch, onRoundOutcome, resultDelayMs })

  const { colors: themeColors } = useAutoPaperTheme()
  // themeColors.outline on its own is already blended 45% toward player 1's own primary color (see
  // auto-paper's useComputedTheme.ts), which reads as "belongs to player 1" rather than a neutral
  // board marker - per explicit user feedback. Blending it further with tertiary (the same neutral,
  // belongs-to-neither-player role pickups already render in) pulls obstacle/portal/tunnel geometry
  // back toward "inert board structure" instead.
  const obstacleColor = getBlendedColor(themeColors.tertiary, themeColors.outline, 0.5)

  return (
    <>
      {/* Fixed at the frozen design width/height (not liveWidth/liveHeight) and scaled as one rigid
      unit via boardScale above - see that comment for why this, not resizing the pieces
      independently, is what keeps the canvas and the touch zones from ever disagreeing. transform's
      default origin (center) is exactly what keeps this centered inside boardArea's own live,
      already-centered bounds (see MatchScreen's boardArea style) as boardScale
      changes, with no separate positioning math needed here. */}
      <View style={{ width, height, transform: [{ scale: boardScale }] }}>
        <GameBoardHost players={state.players} phase={state.phase} tickIntervalMs={tickIntervalMs} cellPx={cellPx} grid={state.grid} orientationMode={orientationMode} p1OnRight={p1OnRight} tick={state.tick} pickups={state.pickups} pickupColor={themeColors.tertiary} obstacles={state.obstacles} obstacleColor={obstacleColor} portals={state.portals} tunnels={state.tunnels} trailSpeedRate={TRAIL_SPEED_RATE[settings.trailSpeedTier]} wrapEdges={settings.wrapEdges} />
        <TouchInputLayer orientationMode={orientationMode} p1OnRight={p1OnRight} humanPlayers={humanPlayers} enabled={state.phase === 'playing' && !controls.paused} onTurn={turn} onActivate={activate} controlInverted={controlInverted} currentDirections={currentDirections} keyScheme={settings.controlScheme} />
      </View>

      {/* Deliberately OUTSIDE the scaled View above, unlike GameBoardHost/TouchInputLayer - a held
      powerup's badge is UI chrome, not part of the rendered world, and needs to stay a legible,
      comfortably-tappable fixed size (see PowerupHud's own 12px corner insets) regardless of
      whatever size the board itself is currently scaled to. */}
      {state.phase === 'playing' && settings.enabledPowerups.length > 0 && <PowerupHud players={state.players} orientationMode={orientationMode} p1OnRight={p1OnRight} desktopWeb={flow.isDesktopWeb} />}

      {/* Every floating dialog, and the back and settings chips, live in MatchOverlays, the board's
      sibling, so their live rotation tracking can never re-render the board/touch subtree above (see
      that component's own doc). Also outside the scaled View, same reason as PowerupHud: a dialog
      shouldn't shrink just because the board did. */}
      <MatchOverlays phase={state.phase} orientationMode={orientationMode} p1OnRight={p1OnRight} settingsOpen={controls.settingsOpen} onSettingsDismiss={() => controls.setSettingsOpen(false)} onSettingsOpen={() => controls.setSettingsOpen(true)} confirmVisible={controls.confirmVisible} cancelBack={controls.cancelBack} humanPlayers={humanPlayers} colors={colors} profileNames={profileNames} roundHistory={roundHistory} onOnboardingComplete={beginPlaying} showResultDialog={flow.showResultDialog} matchOver={controls.matchOver} controlsVisible={flow.controlsVisible} desktopWeb={flow.isDesktopWeb} outcome={state.outcome ?? null} gameMode={gameMode} rematchReady={flow.rematchReady} onRequestRematch={flow.handleRequestRematch} onQuit={flow.handleQuit} onExit={safeBack} onBackPress={controls.requestBack} backgroundPaused={controls.backgroundPaused} onResume={controls.resume} />
    </>
  )
}

// LightCycles' play screen: the shared match frame (MatchScreen) around GameRound.
export default function PlayScreen() {
  const { recordRoundOutcome } = lightCyclesStats.useDuelStats()
  return <MatchScreen gameId='lightcycles' defaults={DEFAULT_SETTINGS} Round={GameRound} recordRoundOutcome={recordRoundOutcome} />
}
